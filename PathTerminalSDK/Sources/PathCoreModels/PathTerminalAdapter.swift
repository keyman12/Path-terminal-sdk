/// Adapter protocol for terminal communication.
/// Implementations map device-specific protocols to Path canonical models.
import Foundation

public protocol PathTerminalAdapter: Sendable {
    /// Discover available devices (e.g. BLE scan)
    func discoverDevices() async throws -> [DiscoveredDevice]

    /// Connect to a discovered device
    func connect(to device: DiscoveredDevice) async throws

    /// Disconnect from current device
    func disconnect() async throws

    /// Execute sale transaction
    func sale(request: TransactionRequest) async throws -> TransactionResult

    /// Execute refund transaction
    func refund(request: TransactionRequest) async throws -> TransactionResult

    /// Get device capabilities (may throw unsupported_operation if not implemented)
    func getCapabilities() async throws -> DeviceCapabilities

    /// Get device info (may throw unsupported_operation if not implemented)
    func getDeviceInfo() async throws -> DeviceInfo

    /// Get transaction status by request ID (may throw unsupported_operation)
    func getTransactionStatus(requestId: String) async throws -> TransactionResult

    /// Get receipt data for transaction (may throw unsupported_operation)
    func getReceiptData(transactionId: String) async throws -> ReceiptData

    /// Whether currently connected to a device
    var isConnected: Bool { get }
}
