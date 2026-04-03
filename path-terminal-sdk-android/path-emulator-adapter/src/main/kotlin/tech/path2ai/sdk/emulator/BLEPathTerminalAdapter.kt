package tech.path2ai.sdk.emulator

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import tech.path2ai.sdk.core.*
import java.util.UUID

/**
 * BLE adapter for the Path POS Emulator using Nordic UART Service.
 * Communicates via newline-delimited JSON over BLE characteristics.
 */
@SuppressLint("MissingPermission")
class BLEPathTerminalAdapter(
    private val context: Context,
    private val sdkVersion: String = "0.1.0",
    private val adapterVersion: String = "0.1.0",
    private val deviceNameFilter: ((String) -> Boolean)? = null,
    private val onLog: ((String) -> Unit)? = null
) : PathTerminalAdapter {

    companion object {
        // Nordic UART Service UUIDs
        private val UART_SERVICE_UUID = UUID.fromString("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
        private val UART_RX_UUID = UUID.fromString("6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
        private val UART_TX_UUID = UUID.fromString("6E400003-B5A3-F393-E0A9-E50E24DCCA9E")
        private val CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        private const val SCAN_TIMEOUT_MS = 5_000L
        private const val CONNECT_TIMEOUT_MS = 10_000L
        private const val RESPONSE_TIMEOUT_MS = 30_000L
        private const val CHUNK_SIZE = 20
        private const val CHUNK_DELAY_MS = 20L
    }

    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter

    private var gatt: BluetoothGatt? = null
    private var rxCharacteristic: BluetoothGattCharacteristic? = null
    private var txCharacteristic: BluetoothGattCharacteristic? = null

    private val mutex = Mutex()
    private var receiveBuffer = StringBuilder()
    private var pendingResponse: CompletableDeferred<String>? = null

    private var _isConnected = false
    override val isConnected: Boolean get() = _isConnected

    override var onHardwareDisconnect: (() -> Unit)? = null

    val isBluetoothPoweredOn: Boolean get() = bluetoothAdapter?.isEnabled == true

    private fun log(msg: String) {
        onLog?.invoke("[BLE] $msg")
    }

    // ── Discovery ────────────────────────────────────────────────────────────

    override suspend fun discoverDevices(): List<DiscoveredDevice> = withContext(Dispatchers.IO) {
        val adapter = bluetoothAdapter ?: throw PathError(
            code = PathErrorCode.CONNECTIVITY,
            message = "Bluetooth is not available on this device",
            recoverable = false
        )

        if (!adapter.isEnabled) throw PathError(
            code = PathErrorCode.CONNECTIVITY,
            message = "Bluetooth is turned off",
            recoverable = true
        )

        if (_isConnected) return@withContext emptyList()

        val scanner = adapter.bluetoothLeScanner ?: throw PathError(
            code = PathErrorCode.CONNECTIVITY,
            message = "BLE scanner not available",
            recoverable = false
        )

        val devices = mutableListOf<DiscoveredDevice>()
        val scanComplete = CompletableDeferred<Unit>()

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val name = result.device.name ?: return
                if (!matchesFilter(name)) return
                val id = result.device.address
                if (devices.none { it.id == id }) {
                    log("Discovered: $name ($id) RSSI=${result.rssi}")
                    devices.add(DiscoveredDevice(id = id, name = name, rssi = result.rssi))
                }
            }

            override fun onScanFailed(errorCode: Int) {
                log("Scan failed: $errorCode")
                scanComplete.completeExceptionally(
                    PathError(
                        code = PathErrorCode.CONNECTIVITY,
                        message = "BLE scan failed (error $errorCode)",
                        recoverable = true
                    )
                )
            }
        }

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        log("Starting BLE scan...")
        scanner.startScan(null, settings, callback)

        try {
            withTimeout(SCAN_TIMEOUT_MS) { scanComplete.await() }
        } catch (_: TimeoutCancellationException) {
            // Expected — scan window elapsed
        } finally {
            scanner.stopScan(callback)
            log("Scan complete, found ${devices.size} device(s)")
        }

        devices
    }

    private fun matchesFilter(name: String): Boolean {
        val customFilter = deviceNameFilter
        if (customFilter != null) return customFilter(name)
        return name == "Path POS Emulator" || name.contains("Path")
    }

    // ── Connection ───────────────────────────────────────────────────────────

    override suspend fun connect(device: DiscoveredDevice): Unit = withContext(Dispatchers.IO) {
        val adapter = bluetoothAdapter ?: throw PathError(
            code = PathErrorCode.CONNECTIVITY,
            message = "Bluetooth not available",
            recoverable = false
        )

        val btDevice = adapter.getRemoteDevice(device.id)
        val connectionReady = CompletableDeferred<Unit>()

        log("Connecting to ${device.name} (${device.id})...")

        val gattCallback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                when (newState) {
                    BluetoothProfile.STATE_CONNECTED -> {
                        log("GATT connected, discovering services...")
                        g.discoverServices()
                    }
                    BluetoothProfile.STATE_DISCONNECTED -> {
                        log("GATT disconnected (status=$status)")
                        handleDisconnect()
                        if (!connectionReady.isCompleted) {
                            connectionReady.completeExceptionally(
                                PathError(
                                    code = PathErrorCode.CONNECTIVITY,
                                    message = "Connection lost (status=$status)",
                                    recoverable = true
                                )
                            )
                        }
                    }
                }
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    connectionReady.completeExceptionally(
                        PathError(
                            code = PathErrorCode.CONNECTIVITY,
                            message = "Service discovery failed (status=$status)",
                            recoverable = true
                        )
                    )
                    return
                }

                val service = g.getService(UART_SERVICE_UUID)
                if (service == null) {
                    connectionReady.completeExceptionally(
                        PathError(
                            code = PathErrorCode.CONNECTIVITY,
                            message = "Nordic UART service not found on device",
                            recoverable = false
                        )
                    )
                    return
                }

                rxCharacteristic = service.getCharacteristic(UART_RX_UUID)
                txCharacteristic = service.getCharacteristic(UART_TX_UUID)

                if (rxCharacteristic == null || txCharacteristic == null) {
                    connectionReady.completeExceptionally(
                        PathError(
                            code = PathErrorCode.CONNECTIVITY,
                            message = "UART characteristics not found",
                            recoverable = false
                        )
                    )
                    return
                }

                // Enable notifications on TX
                log("Enabling TX notifications...")
                g.setCharacteristicNotification(txCharacteristic, true)
                val descriptor = txCharacteristic!!.getDescriptor(CCCD_UUID)
                if (descriptor != null) {
                    descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    g.writeDescriptor(descriptor)
                } else {
                    log("CCCD descriptor not found, proceeding anyway")
                    _isConnected = true
                    gatt = g
                    connectionReady.complete(Unit)
                }
            }

            override fun onDescriptorWrite(g: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
                if (descriptor.uuid == CCCD_UUID) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        log("TX notifications enabled — connection ready")
                        _isConnected = true
                        gatt = g
                        connectionReady.complete(Unit)
                    } else {
                        connectionReady.completeExceptionally(
                            PathError(
                                code = PathErrorCode.CONNECTIVITY,
                                message = "Failed to enable notifications (status=$status)",
                                recoverable = true
                            )
                        )
                    }
                }
            }

            @Deprecated("Deprecated in API 33")
            override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
                if (characteristic.uuid == UART_TX_UUID) {
                    val chunk = characteristic.value?.toString(Charsets.UTF_8) ?: return
                    handleReceivedData(chunk)
                }
            }
        }

        gatt = btDevice.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)

        try {
            withTimeout(CONNECT_TIMEOUT_MS) { connectionReady.await() }
        } catch (e: TimeoutCancellationException) {
            gatt?.close()
            gatt = null
            throw PathError(
                code = PathErrorCode.TIMEOUT,
                message = "Connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s",
                recoverable = true
            )
        }
    }

    override suspend fun disconnect() {
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        _isConnected = false
        rxCharacteristic = null
        txCharacteristic = null
        receiveBuffer.clear()
        log("Disconnected")
    }

    private fun handleDisconnect() {
        _isConnected = false
        rxCharacteristic = null
        txCharacteristic = null
        receiveBuffer.clear()
        pendingResponse?.completeExceptionally(
            PathError(code = PathErrorCode.CONNECTIVITY, message = "Device disconnected", recoverable = true)
        )
        pendingResponse = null
        onHardwareDisconnect?.invoke()
    }

    private fun handleReceivedData(chunk: String) {
        receiveBuffer.append(chunk)
        val content = receiveBuffer.toString()
        val newlineIndex = content.indexOf('\n')
        if (newlineIndex >= 0) {
            val line = content.substring(0, newlineIndex).trim()
            receiveBuffer = StringBuilder(content.substring(newlineIndex + 1))
            if (line.startsWith("OK ")) {
                val jsonStr = line.removePrefix("OK ")
                log("RX: $jsonStr")
                pendingResponse?.complete(jsonStr)
            }
        }
    }

    // ── Command Send/Receive ─────────────────────────────────────────────────

    private suspend fun sendCommand(command: String): String = mutex.withLock {
        val g = gatt ?: throw PathError(code = PathErrorCode.CONNECTIVITY, message = "Not connected", recoverable = true)
        val rx = rxCharacteristic ?: throw PathError(code = PathErrorCode.CONNECTIVITY, message = "RX characteristic not available", recoverable = false)

        val deferred = CompletableDeferred<String>()
        pendingResponse = deferred

        val payload = (command + "\n").toByteArray(Charsets.UTF_8)
        log("TX: $command")

        // Chunk and send
        var offset = 0
        while (offset < payload.size) {
            val end = minOf(offset + CHUNK_SIZE, payload.size)
            val chunk = payload.copyOfRange(offset, end)
            rx.value = chunk
            rx.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            g.writeCharacteristic(rx)
            offset = end
            if (offset < payload.size) delay(CHUNK_DELAY_MS)
        }

        // Wait for response
        try {
            withTimeout(RESPONSE_TIMEOUT_MS) { deferred.await() }
        } catch (e: TimeoutCancellationException) {
            pendingResponse = null
            throw PathError(
                code = PathErrorCode.TIMEOUT,
                message = "No response from terminal after ${RESPONSE_TIMEOUT_MS / 1000}s",
                recoverable = true
            )
        }
    }

    private fun buildCommandJson(reqId: String, cmd: String, args: Map<String, Any?>): String {
        val argsJson = args.entries
            .filter { it.value != null }
            .joinToString(",") { (k, v) ->
                when (v) {
                    is String -> "\"$k\":\"$v\""
                    is Number -> "\"$k\":$v"
                    is Boolean -> "\"$k\":$v"
                    else -> "\"$k\":\"$v\""
                }
            }
        return "{\"req_id\":\"$reqId\",\"cmd\":\"$cmd\",\"args\":{$argsJson}}"
    }

    // ── Transactions ─────────────────────────────────────────────────────────

    override suspend fun sale(request: TransactionRequest): TransactionResult {
        val cmd = buildCommandJson(
            reqId = request.envelope.requestId,
            cmd = "Sale",
            args = mapOf(
                "amount" to request.amountMinor,
                "currency" to request.currency,
                "tip" to request.tipMinor
            )
        )
        val raw = sendCommand(cmd)
        return EmulatorWireJsonMapping.mapResponse(raw, request.envelope.requestId)
    }

    override suspend fun refund(request: TransactionRequest): TransactionResult {
        val cmd = buildCommandJson(
            reqId = request.envelope.requestId,
            cmd = "Refund",
            args = mapOf(
                "amount" to request.amountMinor,
                "currency" to request.currency,
                "original_req_id" to request.originalTransactionId
            )
        )
        val raw = sendCommand(cmd)
        return EmulatorWireJsonMapping.mapResponse(raw, request.envelope.requestId)
    }

    override suspend fun getTransactionStatus(requestId: String): TransactionResult {
        val cmd = buildCommandJson(
            reqId = java.util.UUID.randomUUID().toString(),
            cmd = "GetTransactionStatus",
            args = mapOf("req_id" to requestId)
        )
        val raw = sendCommand(cmd)
        return EmulatorWireJsonMapping.mapResponse(raw, requestId)
    }

    override suspend fun getReceiptData(transactionId: String): ReceiptData {
        val cmd = buildCommandJson(
            reqId = java.util.UUID.randomUUID().toString(),
            cmd = "GetReceipt",
            args = mapOf("txn_id" to transactionId)
        )
        val raw = sendCommand(cmd)
        return EmulatorWireJsonMapping.mapReceiptResponse(raw, transactionId)
    }

    override suspend fun cancelActiveTransaction() {
        val cmd = buildCommandJson(
            reqId = java.util.UUID.randomUUID().toString(),
            cmd = "Cancel",
            args = emptyMap()
        )
        sendCommand(cmd)
    }

    override suspend fun getCapabilities(): DeviceCapabilities {
        throw PathError(
            code = PathErrorCode.UNSUPPORTED_OPERATION,
            message = "GetCapabilities not supported by emulator",
            recoverable = false
        )
    }

    override suspend fun getDeviceInfo(): DeviceInfo {
        throw PathError(
            code = PathErrorCode.UNSUPPORTED_OPERATION,
            message = "GetDeviceInfo not supported by emulator",
            recoverable = false
        )
    }
}
