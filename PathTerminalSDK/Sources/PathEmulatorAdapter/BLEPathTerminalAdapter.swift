/// BLE Nordic UART adapter for Path POS Emulator (Pico 2 W).
/// Per cursor/rules/70-emulator-wire-protocol.mdc
import Foundation
import CoreBluetooth
import PathCoreModels

private let serviceUUID = CBUUID(string: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
private let rxUUID = CBUUID(string: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
private let txUUID = CBUUID(string: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E")
private let defaultEmulatorName = "Path POS Emulator"

/// Default filter: exact "Path POS Emulator" or name contains "Path".
private func defaultDeviceNameFilter(_ name: String) -> Bool {
    name == defaultEmulatorName || name.contains("Path")
}

public final class BLEPathTerminalAdapter: NSObject, PathTerminalAdapter, @unchecked Sendable {
    public private(set) var isConnected: Bool = false
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var rxCharacteristic: CBCharacteristic?
    private var txCharacteristic: CBCharacteristic?
    private var peripheralById: [UUID: CBPeripheral] = [:]
    private var receiveBuffer = Data()
    private let queue = DispatchQueue(label: "path.ble.adapter")
    private var responseContinuation: CheckedContinuation<[String: Any], Error>?
    private var connectContinuation: CheckedContinuation<Void, Error>?
    private var connectTimeoutWorkItem: DispatchWorkItem?
    private var disconnectContinuation: CheckedContinuation<Void, Error>?
    /// True while a graceful app-initiated disconnect is in progress, so that
    /// didDisconnectPeripheral can distinguish hardware drops from intentional teardown.
    private var isDisconnecting = false
    /// True after RX/TX handles are known until TX notifications are confirmed (Nordic UART).
    private var connectAwaitingNotify = false
    private let sdkVersion: String
    private let adapterVersion: String
    private let deviceNameFilter: @Sendable (String) -> Bool
    /// Called when the hardware initiates a disconnect. Wired by PathTerminal.connect().
    public var onHardwareDisconnect: (@Sendable () -> Void)?
    /// Optional. When set, protocol-level log lines (TX/RX, chunks, result type) are reported here. Can be set after init to avoid capturing uninitialized self in the app.
    public var onLog: (@Sendable (String) -> Void)?
    /// Called when `CBCentralManager` power/authorization state changes.
    public var onBluetoothStateChange: (@Sendable () -> Void)?

    /// - Parameters:
    ///   - sdkVersion: SDK version string.
    ///   - adapterVersion: Adapter version string.
    ///   - deviceNameFilter: Optional. If provided, only peripherals whose name passes this predicate are discovered. If nil, default is used (exact "Path POS Emulator" or name contains "Path"). Use `{ _ in true }` to show all BLE devices.
    ///   - onLog: Optional. When set, protocol-level log lines are reported here. Can also be set later via the `onLog` property.
    public init(
        sdkVersion: String = "0.1.0",
        adapterVersion: String = "0.1.0",
        deviceNameFilter: (@Sendable (String) -> Bool)? = nil,
        onLog: (@Sendable (String) -> Void)? = nil
    ) {
        self.sdkVersion = sdkVersion
        self.adapterVersion = adapterVersion
        self.deviceNameFilter = deviceNameFilter ?? defaultDeviceNameFilter
        self.onLog = onLog
        super.init()
        self.central = CBCentralManager(delegate: self, queue: queue)
    }

    /// Whether Bluetooth is powered on and available (reads CoreBluetooth state on the adapter queue).
    public var isBluetoothPoweredOn: Bool {
        queue.sync { central.state == .poweredOn }
    }

    private var discoveredRSSI: [UUID: Int] = [:]

    public func discoverDevices() async throws -> [DiscoveredDevice] {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[DiscoveredDevice], Error>) in
            queue.async { [weak self] in
                guard let self else { return }
                guard self.central.state == .poweredOn else {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Bluetooth not powered on", recoverable: true))
                    return
                }
                // Scanning while already connected can drop the active GATT session on some stacks (iOS + Pico).
                // Return the current peripheral without starting a new scan.
                if self.isConnected, let p = self.peripheral {
                    self.onLog?("discoverDevices: already connected — skipping scan (returns current device only)")
                    let rssi = self.discoveredRSSI[p.identifier] ?? -50
                    let name = p.name ?? "Unknown"
                    cont.resume(returning: [DiscoveredDevice(id: p.identifier, name: name, rssi: rssi)])
                    return
                }
                self.peripheralById.removeAll()
                self.discoveredRSSI.removeAll()
                self.central.scanForPeripherals(withServices: nil)
                self.queue.asyncAfter(deadline: .now() + 5) { [weak self] in
                    self?.central.stopScan()
                    let devices = self?.peripheralById.map {
                        DiscoveredDevice(id: $0.key, name: $0.value.name ?? "Unknown", rssi: self?.discoveredRSSI[$0.key] ?? -50)
                    } ?? []
                    cont.resume(returning: devices)
                }
            }
        }
    }

    public func connect(to device: DiscoveredDevice) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self else {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Adapter deallocated", recoverable: false))
                    return
                }
                guard let p = self.peripheralById[device.id] else {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Device not found", recoverable: true))
                    return
                }
                // A second connect() before the first finishes overwrites connectContinuation and leaks the
                // first CheckedContinuation (Swift TASK CONTINUATION MISUSE), leaving CoreBluetooth in a bad state.
                if self.connectContinuation != nil {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Another connection attempt is already in progress", recoverable: true))
                    return
                }
                if self.isConnected, self.peripheral?.identifier == device.id {
                    cont.resume()
                    return
                }
                if self.isConnected {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Already connected to a device. Disconnect first.", recoverable: true))
                    return
                }
                self.cancelConnectTimeout()
                self.isDisconnecting = false
                self.connectAwaitingNotify = false
                self.central.stopScan()
                self.connectContinuation = cont
                self.peripheral = p
                p.delegate = self
                self.central.connect(p)
                let work = DispatchWorkItem { [weak self] in
                    guard let self else { return }
                    guard let cc = self.connectContinuation else { return }
                    self.connectContinuation = nil
                    if !self.isConnected {
                        cc.resume(throwing: PathError(code: .timeout, message: "Connection timeout", recoverable: true))
                        self.central.cancelPeripheralConnection(p)
                    }
                }
                self.connectTimeoutWorkItem = work
                self.queue.asyncAfter(deadline: .now() + 10, execute: work)
            }
        }
    }

    private func cancelConnectTimeout() {
        connectTimeoutWorkItem?.cancel()
        connectTimeoutWorkItem = nil
    }

    public func disconnect() async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self else { cont.resume(); return }
                guard let p = self.peripheral else {
                    // Already disconnected — nothing to do.
                    cont.resume()
                    return
                }
                self.isDisconnecting = true
                self.disconnectContinuation = cont
                self.central.cancelPeripheralConnection(p)
                // didDisconnectPeripheral will resolve disconnectContinuation.
            }
        }
    }

    /// Tears down all connection state and fires pending continuations with a connectivity error.
    /// Called from didDisconnectPeripheral and centralManagerDidUpdateState when hardware causes a drop.
    /// Fails an in-flight `connect` and cancels the link. Must be called on `queue`.
    /// Uses `isDisconnecting` so `didDisconnectPeripheral` does not treat this as a hardware drop
    /// (avoids spurious `onHardwareDisconnect` / disconnected events).
    private func failPendingConnection(message: String) {
        cancelConnectTimeout()
        connectAwaitingNotify = false
        connectContinuation?.resume(throwing: PathError(code: .connectivity, message: message, recoverable: true))
        connectContinuation = nil
        guard let p = peripheral else { return }
        isDisconnecting = true
        central.cancelPeripheralConnection(p)
    }

    /// Must be called on `queue`.
    private func handleHardwareDisconnect(error: Error?) {
        cancelConnectTimeout()
        connectAwaitingNotify = false
        isConnected = false
        rxCharacteristic = nil
        txCharacteristic = nil
        peripheral = nil
        isDisconnecting = false

        let pathError = PathError(
            code: .connectivity,
            message: error.map { "Peripheral disconnected: \($0.localizedDescription)" } ?? "Peripheral disconnected",
            recoverable: true
        )
        if let cc = connectContinuation {
            connectContinuation = nil
            cc.resume(throwing: pathError)
        }
        if let rc = responseContinuation {
            responseContinuation = nil
            rc.resume(throwing: pathError)
        }
        if let dc = disconnectContinuation {
            disconnectContinuation = nil
            dc.resume()
        }
        onHardwareDisconnect?()
    }

    private func sendCommand(_ cmd: String, args: [String: Any], reqId: String) async throws -> [String: Any] {
        let payload: [String: Any] = [
            "req_id": reqId,
            "args": args,
            "cmd": cmd
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)
        guard var line = String(data: data, encoding: .utf8) else {
            throw PathError(code: .adapterFault, message: "JSON encoding failed", recoverable: false)
        }
        line += "\n"
        let lineData = line.data(using: .utf8)!
        onLog?("TX: \(cmd) req_id=\(reqId) \(compactArgs(args))")
        try await sendData(lineData)
        return try await receiveResponse(reqId: reqId)
    }

    private func compactArgs(_ args: [String: Any]) -> String {
        let parts = args.map { "\($0.key)=\($0.value)" }
        return parts.isEmpty ? "" : parts.joined(separator: " ")
    }

    private func sendData(_ data: Data) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self, let rx = self.rxCharacteristic, let p = self.peripheral else {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Not connected", recoverable: true))
                    return
                }
                let chunkSize = 20
                let numChunks = (data.count + chunkSize - 1) / chunkSize
                self.onLog?("TX: \(data.count) bytes in \(numChunks) chunk(s)")
                var offset = 0
                while offset < data.count {
                    let end = min(offset + chunkSize, data.count)
                    let chunk = data.subdata(in: offset..<end)
                    p.writeValue(chunk, for: rx, type: .withoutResponse)
                    offset = end
                    if offset < data.count { Thread.sleep(forTimeInterval: 0.02) }
                }
                cont.resume()
            }
        }
    }

    private func receiveResponse(reqId: String) async throws -> [String: Any] {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[String: Any], Error>) in
            queue.async { [weak self] in
                guard let self else { return }
                if self.responseContinuation != nil {
                    // A second command was issued before the first response arrived.
                    // The adapter is single-slot by design — this is a usage fault.
                    cont.resume(throwing: PathError(code: .adapterFault, message: "Command issued while response already pending", recoverable: false))
                    return
                }
                self.responseContinuation = cont
                // 30-second hard ceiling. If the emulator is silent for this long the
                // connection is effectively dead regardless of BLE link state.
                self.queue.asyncAfter(deadline: .now() + 30) { [weak self] in
                    guard let self, let rc = self.responseContinuation else { return }
                    self.responseContinuation = nil
                    rc.resume(throwing: PathError(code: .timeout, message: "No response from terminal (req_id: \(reqId))", recoverable: true))
                }
            }
        }
    }

    private func processIncoming(_ data: Data) {
        receiveBuffer.append(data)
        while let range = receiveBuffer.firstRange(of: Data([0x0A])) {
            let lineData = receiveBuffer.subdata(in: 0..<range.lowerBound)
            receiveBuffer.removeSubrange(0..<range.upperBound)
            guard !lineData.isEmpty else { continue }
            guard var line = String(data: lineData, encoding: .utf8) else { continue }
            line = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.hasPrefix("OK ") { line = String(line.dropFirst(3)) }
            guard let json = try? JSONSerialization.jsonObject(with: line.data(using: .utf8)!) as? [String: Any] else { continue }
            let type = json["type"] as? String ?? "?"
            logReceived(type: type, json: json)
            if type == "result" {
                responseContinuation?.resume(returning: json)
                responseContinuation = nil
            }
        }
    }

    private func logReceived(type: String, json: [String: Any]) {
        switch type {
        case "result":
            let status = json["status"] as? String ?? "?"
            let txnId = (json["txn_id"] as? String).map { " txn_id=\($0)" } ?? ""
            onLog?("RX: result status=\(status)\(txnId)")
        case "ack", "card_read":
            onLog?("RX: \(type)")
        default:
            onLog?("RX: \(type)")
        }
    }

    public func sale(request: TransactionRequest) async throws -> TransactionResult {
        var args: [String: Any] = ["amount": request.amountMinor, "currency": request.currency]
        if let tip = request.tipMinor { args["tip"] = tip }
        let reqId = request.envelope.requestId
        let raw = try await sendCommand("Sale", args: args, reqId: reqId)
        return mapResult(raw, request: request, defaultState: .approved)
    }

    public func refund(request: TransactionRequest) async throws -> TransactionResult {
        var args: [String: Any] = ["amount": request.amountMinor, "currency": request.currency]
        if let orig = request.originalRequestId { args["original_req_id"] = orig }
        let reqId = request.envelope.requestId
        let raw = try await sendCommand("Refund", args: args, reqId: reqId)
        return mapResult(raw, request: request, defaultState: .refunded)
    }

    private func mapResult(_ raw: [String: Any], request: TransactionRequest, defaultState: TransactionState) -> TransactionResult {
        EmulatorWireJsonMapping.mapTransactionResult(
            raw,
            defaultState: defaultState,
            requestId: request.envelope.requestId,
            amountFallback: request.amountMinor,
            currencyFallback: request.currency
        )
    }

    private func parseCardReceiptFields(from dict: [String: Any]) throws -> CardReceiptFields {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return try JSONDecoder().decode(CardReceiptFields.self, from: data)
    }

    public func getCapabilities() async throws -> DeviceCapabilities {
        return DeviceCapabilities(
            commands: ["Sale", "Refund", "Login", "Logout", "Cancel", "GetTransactionStatus", "GetReceipt"],
            nfc: true,
            display: true
        )
    }

    public func getDeviceInfo() async throws -> DeviceInfo {
        throw PathError(code: .unsupportedOperation, message: "GetDeviceInfo not yet supported by emulator", recoverable: false)
    }

    public func cancelActiveTransaction() async throws {
        let reqId = UUID().uuidString
        let raw = try await sendCommand("Cancel", args: [:], reqId: reqId)
        try EmulatorWireJsonMapping.throwIfUnsupportedOperation(raw, commandName: "Cancel")
        let top = (raw["status"] as? String)?.lowercased() ?? ""
        guard top != "error" else {
            let msg = raw["error"] as? String ?? "Cancel failed"
            throw PathError(code: .terminalFault, message: msg, recoverable: false)
        }
    }

    public func getTransactionStatus(requestId: String) async throws -> TransactionResult {
        let reqId = UUID().uuidString
        let raw = try await sendCommand("GetTransactionStatus", args: ["req_id": requestId], reqId: reqId)
        try EmulatorWireJsonMapping.throwIfUnsupportedOperation(raw, commandName: "GetTransactionStatus")
        return EmulatorWireJsonMapping.mapTransactionResult(
            raw,
            defaultState: .approved,
            requestId: requestId,
            amountFallback: 0,
            currencyFallback: "GBP"
        )
    }

    public func getReceiptData(transactionId: String) async throws -> ReceiptData {
        let reqId = UUID().uuidString
        let raw = try await sendCommand("GetReceipt", args: ["txn_id": transactionId], reqId: reqId)
        let status = (raw["status"] as? String)?.lowercased() ?? ""
        guard status == "success" else {
            let msg = raw["error"] as? String ?? "GetReceipt failed"
            throw PathError(code: .adapterFault, message: msg, recoverable: false)
        }
        guard let merchantDict = raw["merchant_receipt"] as? [String: Any],
              let customerDict = raw["customer_receipt"] as? [String: Any] else {
            throw PathError(code: .adapterFault, message: "Invalid GetReceipt response", recoverable: false)
        }
        let merchantReceipt = try parseCardReceiptFields(from: merchantDict)
        let customerReceipt = try parseCardReceiptFields(from: customerDict)
        let timestampUtc = merchantReceipt.timestamp
        return ReceiptData(
            transactionId: transactionId,
            requestId: nil,
            merchantReceipt: merchantReceipt,
            customerReceipt: customerReceipt,
            timestampUtc: timestampUtc
        )
    }
}

extension BLEPathTerminalAdapter: CBCentralManagerDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        onBluetoothStateChange?()
        // Only tear down on definitive host failures. Treating every non-.poweredOn state
        // (including .unknown at startup and transient .resetting) as disconnect caused
        // immediate connect-then-drop when the stack briefly reported non-poweredOn.
        switch central.state {
        case .poweredOn:
            break
        case .poweredOff, .unauthorized, .unsupported:
            handleHardwareDisconnect(error: nil)
        case .unknown, .resetting:
            break
        @unknown default:
            break
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
        if deviceNameFilter(name) {
            peripheralById[peripheral.identifier] = peripheral
            discoveredRSSI[peripheral.identifier] = RSSI.intValue
        }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices([serviceUUID])
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        cancelConnectTimeout()
        connectContinuation?.resume(throwing: PathError(code: .connectivity, message: error?.localizedDescription ?? "Connection failed", recoverable: true))
        connectContinuation = nil
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let errDesc = error.map { "\($0)" } ?? "nil"
        onLog?("BLE: didDisconnectPeripheral isDisconnecting=\(isDisconnecting) error=\(errDesc)")
        if isDisconnecting {
            // App-initiated teardown: resolve the disconnect continuation and clean up.
            isConnected = false
            rxCharacteristic = nil
            txCharacteristic = nil
            self.peripheral = nil
            isDisconnecting = false
            let dc = disconnectContinuation
            disconnectContinuation = nil
            dc?.resume()
        } else {
            // Hardware-initiated drop: emulator reset, out of range, or firmware disconnect.
            handleHardwareDisconnect(error: error)
        }
    }
}

extension BLEPathTerminalAdapter: CBPeripheralDelegate {
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            failPendingConnection(message: "Service discovery failed: \(error.localizedDescription)")
            return
        }
        guard let services = peripheral.services else {
            failPendingConnection(message: "No GATT services from peripheral")
            return
        }
        var found = false
        for svc in services where svc.uuid == serviceUUID {
            found = true
            peripheral.discoverCharacteristics([rxUUID, txUUID], for: svc)
            break
        }
        if !found {
            failPendingConnection(message: "Nordic UART service not found on this peripheral")
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error {
            failPendingConnection(message: "Characteristic discovery failed: \(error.localizedDescription)")
            return
        }
        guard let chars = service.characteristics else {
            failPendingConnection(message: "No characteristics for UART service")
            return
        }
        var rx: CBCharacteristic?
        var tx: CBCharacteristic?
        for c in chars {
            if c.uuid == rxUUID { rx = c }
            if c.uuid == txUUID { tx = c }
        }
        guard let rxChar = rx, let txChar = tx else {
            failPendingConnection(message: "Nordic UART RX/TX characteristics not found")
            return
        }
        rxCharacteristic = rxChar
        txCharacteristic = txChar
        // Discover descriptors on TX first, then subscribe. Some stacks (CYW43 + NimBLE) drop the
        // link if setNotify races internal CCCD setup; Core Bluetooth’s implicit path can CBError 6.
        connectAwaitingNotify = true
        onLog?("BLE: discovering TX descriptors…")
        peripheral.discoverDescriptors(for: txChar)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverDescriptorsFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == txUUID else { return }
        guard connectAwaitingNotify else { return }
        if let error {
            connectAwaitingNotify = false
            failPendingConnection(message: "TX descriptor discovery failed: \(error.localizedDescription)")
            return
        }
        onLog?("BLE: subscribing to TX notifications…")
        peripheral.setNotifyValue(true, for: characteristic)
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == txUUID else { return }
        guard connectAwaitingNotify else { return }
        if let error {
            connectAwaitingNotify = false
            failPendingConnection(message: "TX notify failed: \(error.localizedDescription)")
            return
        }
        guard characteristic.isNotifying else {
            connectAwaitingNotify = false
            failPendingConnection(message: "TX notify failed: notifications not enabled on characteristic")
            return
        }
        connectAwaitingNotify = false
        cancelConnectTimeout()
        isConnected = true
        onLog?("BLE: TX notifications enabled — link ready")
        connectContinuation?.resume()
        connectContinuation = nil
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil else { return }
        guard characteristic.uuid == txUUID, let data = characteristic.value else { return }
        processIncoming(data)
    }
}
