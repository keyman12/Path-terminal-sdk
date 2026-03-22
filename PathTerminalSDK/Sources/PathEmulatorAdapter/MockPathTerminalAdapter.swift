/// Mock adapter for unit testing without BLE.
/// Configurable to return success, failure, or delay.
import Foundation
import PathCoreModels

public final class MockPathTerminalAdapter: PathTerminalAdapter, @unchecked Sendable {
    public var isConnected: Bool { _isConnected }
    private var _isConnected = false

    public var onHardwareDisconnect: (@Sendable () -> Void)?

    public var discoverResult: Result<[DiscoveredDevice], Error> = .success([])
    public var connectError: Error?
    public var saleResult: Result<TransactionResult, Error>?
    public var refundResult: Result<TransactionResult, Error>?
    public var capabilitiesResult: Result<DeviceCapabilities, Error> = .failure(PathError(code: .unsupportedOperation, message: "Not implemented"))
    public var deviceInfoResult: Result<DeviceInfo, Error> = .failure(PathError(code: .unsupportedOperation, message: "Not implemented"))
    public var transactionStatusResult: Result<TransactionResult, Error> = .failure(PathError(code: .unsupportedOperation, message: "Not implemented"))
    public var receiptDataResult: Result<ReceiptData, Error> = .failure(PathError(code: .unsupportedOperation, message: "Not implemented"))
    public var cancelError: Error?

    public var delayMs: UInt64 = 0

    public init() {}

    public func discoverDevices() async throws -> [DiscoveredDevice] {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        switch discoverResult {
        case .success(let devices): return devices
        case .failure(let error): throw error
        }
    }

    public func connect(to device: DiscoveredDevice) async throws {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        if let error = connectError { throw error }
        _isConnected = true
    }

    public func disconnect() async throws {
        _isConnected = false
    }

    /// Simulates a hardware-initiated disconnect (e.g. emulator goes out of range).
    /// Use in tests to verify the SDK handles unexpected drops correctly.
    public func simulateHardwareDisconnect() {
        _isConnected = false
        onHardwareDisconnect?()
    }

    public func sale(request: TransactionRequest) async throws -> TransactionResult {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        if let result = saleResult {
            switch result {
            case .success(let r): return r
            case .failure(let e): throw e
            }
        }
        let now = ISO8601DateFormatter().string(from: Date())
        return TransactionResult(
            transactionId: "mock-txn-\(UUID().uuidString.prefix(8))",
            requestId: request.envelope.requestId,
            state: .approved,
            amountMinor: request.amountMinor,
            currency: request.currency,
            tipMinor: request.tipMinor,
            cardLastFour: "0000",
            receiptAvailable: false,
            timestampUtc: now,
            error: nil
        )
    }

    public func refund(request: TransactionRequest) async throws -> TransactionResult {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        if let result = refundResult {
            switch result {
            case .success(let r): return r
            case .failure(let e): throw e
            }
        }
        let now = ISO8601DateFormatter().string(from: Date())
        return TransactionResult(
            transactionId: "mock-txn-refund-\(UUID().uuidString.prefix(8))",
            requestId: request.envelope.requestId,
            state: .refunded,
            amountMinor: request.amountMinor,
            currency: request.currency,
            tipMinor: nil,
            cardLastFour: nil,
            receiptAvailable: false,
            timestampUtc: now,
            error: nil
        )
    }

    public func getCapabilities() async throws -> DeviceCapabilities {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        switch capabilitiesResult {
        case .success(let c): return c
        case .failure(let e): throw e
        }
    }

    public func getDeviceInfo() async throws -> DeviceInfo {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        switch deviceInfoResult {
        case .success(let i): return i
        case .failure(let e): throw e
        }
    }

    public func getTransactionStatus(requestId: String) async throws -> TransactionResult {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        switch transactionStatusResult {
        case .success(let r): return r
        case .failure(let e): throw e
        }
    }

    public func getReceiptData(transactionId: String) async throws -> ReceiptData {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        switch receiptDataResult {
        case .success(let r): return r
        case .failure(let e): throw e
        }
    }

    public func cancelActiveTransaction() async throws {
        if delayMs > 0 { try await Task.sleep(nanoseconds: delayMs * 1_000_000) }
        if let cancelError { throw cancelError }
    }
}
