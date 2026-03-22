/// Main entry point for Path Terminal SDK.
/// Wraps an adapter and exposes typed async APIs with event stream.
import Foundation
import PathCoreModels

public final class PathTerminal {
    private var adapter: PathTerminalAdapter
    private let eventContinuation: AsyncStream<PathTerminalEvent>.Continuation
    public let events: AsyncStream<PathTerminalEvent>

    public init(adapter: PathTerminalAdapter) {
        self.adapter = adapter
        var continuation: AsyncStream<PathTerminalEvent>.Continuation!
        self.events = AsyncStream { continuation = $0 }
        self.eventContinuation = continuation
    }

    deinit {
        eventContinuation.finish()
    }

    private func emit(_ event: PathTerminalEvent) {
        eventContinuation.yield(event)
    }

    public func discoverDevices() async throws -> [DiscoveredDevice] {
        emit(.connectionStateChanged(.scanning))
        let devices = try await adapter.discoverDevices()
        for d in devices { emit(.deviceDiscovered(d)) }
        // Do not emit `.idle` when a BLE session is still active — that reads as "disconnected"
        // to apps that map idle → not ready (e.g. re-scanning from settings while connected).
        emit(.connectionStateChanged(adapter.isConnected ? .connected : .idle))
        return devices
    }

    public func connect(to device: DiscoveredDevice) async throws {
        emit(.connectionStateChanged(.connecting))
        adapter.onHardwareDisconnect = { [weak self] in
            self?.emit(.connectionStateChanged(.disconnected))
        }
        try await adapter.connect(to: device)
        emit(.connectionStateChanged(.connected))
    }

    public func disconnect() async throws {
        try await adapter.disconnect()
        emit(.connectionStateChanged(.disconnected))
    }

    public func sale(request: TransactionRequest) async throws -> TransactionResult {
        let sm = TransactionStateMachine { [weak self] t in
            self?.emit(.transactionStateChanged(t.to))
        }
        sm.transition(to: .pendingDevice)
        let result = try await adapter.sale(request: request)
        sm.transition(to: result.state)
        if result.receiptAvailable, let txnId = result.transactionId {
            let receipt = try? await adapter.getReceiptData(transactionId: txnId)
            if let r = receipt { emit(.receiptReady(r)) }
        }
        return result
    }

    public func refund(request: TransactionRequest) async throws -> TransactionResult {
        let sm = TransactionStateMachine { [weak self] t in
            self?.emit(.transactionStateChanged(t.to))
        }
        sm.transition(to: .pendingDevice)
        sm.transition(to: .refundPending)
        let result = try await adapter.refund(request: request)
        sm.transition(to: result.state)
        return result
    }

    public func cancelActiveTransaction() async throws {
        try await adapter.cancelActiveTransaction()
        emit(.transactionStateChanged(.cancelled))
    }

    public func getTransactionStatus(requestId: String) async throws -> TransactionResult {
        try await adapter.getTransactionStatus(requestId: requestId)
    }

    public func getReceiptData(transactionId: String) async throws -> ReceiptData {
        try await adapter.getReceiptData(transactionId: transactionId)
    }

    public func getCapabilities() async throws -> DeviceCapabilities {
        try await adapter.getCapabilities()
    }

    public var isConnected: Bool { adapter.isConnected }
}
