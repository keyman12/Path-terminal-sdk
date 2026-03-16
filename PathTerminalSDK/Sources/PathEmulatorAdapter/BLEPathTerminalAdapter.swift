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
    private let sdkVersion: String
    private let adapterVersion: String
    private let deviceNameFilter: @Sendable (String) -> Bool
    /// Optional. When set, protocol-level log lines (TX/RX, chunks, result type) are reported here. Can be set after init to avoid capturing uninitialized self in the app.
    public var onLog: (@Sendable (String) -> Void)?

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

    private var discoveredRSSI: [UUID: Int] = [:]

    public func discoverDevices() async throws -> [DiscoveredDevice] {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[DiscoveredDevice], Error>) in
            queue.async { [weak self] in
                guard let self else { return }
                guard self.central.state == .poweredOn else {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Bluetooth not powered on", recoverable: true))
                    return
                }
                self.peripheralById.removeAll()
                self.discoveredRSSI.removeAll()
                central.scanForPeripherals(withServices: nil)
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
                guard let self, let p = self.peripheralById[device.id] else {
                    cont.resume(throwing: PathError(code: .connectivity, message: "Device not found", recoverable: true))
                    return
                }
                self.central.stopScan()
                self.connectContinuation = cont
                self.peripheral = p
                p.delegate = self
                self.central.connect(p)
                self.queue.asyncAfter(deadline: .now() + 10) { [weak self] in
                    guard let self, let cc = self.connectContinuation else { return }
                    self.connectContinuation = nil
                    if !self.isConnected {
                        cc.resume(throwing: PathError(code: .timeout, message: "Connection timeout", recoverable: true))
                    }
                }
            }
        }
    }

    public func disconnect() async throws {
        queue.async { [weak self] in
            if let p = self?.peripheral {
                self?.central.cancelPeripheralConnection(p)
            }
            self?.peripheral = nil
            self?.rxCharacteristic = nil
            self?.txCharacteristic = nil
            self?.isConnected = false
        }
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
                self?.responseContinuation = cont
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
        let status = (raw["status"] as? String)?.lowercased() ?? ""
        let state: TransactionState
        let error: PathError?
        if status == "approved" || status == "success" {
            state = defaultState
            error = nil
        } else if status == "timed_out" {
            state = .timedOut
            error = PathError(code: .timeout, message: raw["error"] as? String ?? "Transaction timed out", recoverable: true)
        } else {
            state = .declined
            error = PathError(code: .decline, message: raw["error"] as? String ?? "Declined", recoverable: false)
        }
        let amount = raw["amount"] as? Int ?? request.amountMinor
        let currency = raw["currency"] as? String ?? request.currency
        let tip = raw["tip"] as? Int
        let txnId = raw["txn_id"] as? String
        let cardLastFour = raw["card_last_four"] as? String
        let receiptAvailable = raw["receipt_available"] as? Bool ?? false
        let now = ISO8601DateFormatter().string(from: Date())
        return TransactionResult(
            transactionId: txnId,
            requestId: request.envelope.requestId,
            state: state,
            amountMinor: amount,
            currency: currency,
            tipMinor: tip,
            cardLastFour: cardLastFour,
            receiptAvailable: receiptAvailable,
            timestampUtc: now,
            error: error
        )
    }

    private func parseCardReceiptFields(from dict: [String: Any]) throws -> CardReceiptFields {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return try JSONDecoder().decode(CardReceiptFields.self, from: data)
    }

    public func getCapabilities() async throws -> DeviceCapabilities {
        // Emulator doesn't support until P1-12; return hardcoded for now
        return DeviceCapabilities(commands: ["Sale", "Refund", "Login", "Logout"], nfc: true, display: true)
    }

    public func getDeviceInfo() async throws -> DeviceInfo {
        throw PathError(code: .unsupportedOperation, message: "GetDeviceInfo not yet supported by emulator", recoverable: false)
    }

    public func getTransactionStatus(requestId: String) async throws -> TransactionResult {
        throw PathError(code: .unsupportedOperation, message: "getTransactionStatus not yet supported by emulator", recoverable: false)
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
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {}

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
        connectContinuation?.resume(throwing: PathError(code: .connectivity, message: error?.localizedDescription ?? "Connection failed", recoverable: true))
        connectContinuation = nil
    }
}

extension BLEPathTerminalAdapter: CBPeripheralDelegate {
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for svc in services where svc.uuid == serviceUUID {
            peripheral.discoverCharacteristics([rxUUID, txUUID], for: svc)
            break
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics else { return }
        for c in chars {
            if c.uuid == rxUUID { rxCharacteristic = c }
            if c.uuid == txUUID {
                txCharacteristic = c
                peripheral.setNotifyValue(true, for: c)
            }
        }
        if rxCharacteristic != nil && txCharacteristic != nil {
            isConnected = true
            connectContinuation?.resume()
            connectContinuation = nil
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == txUUID, let data = characteristic.value else { return }
        processIncoming(data)
    }
}
