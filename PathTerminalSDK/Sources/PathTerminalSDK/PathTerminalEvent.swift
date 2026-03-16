/// Typed events from the terminal for device updates, transaction state, prompts, errors.
import Foundation
import PathCoreModels

public enum PathTerminalEvent: Sendable {
    case deviceDiscovered(DiscoveredDevice)
    case connectionStateChanged(ConnectionState)
    case transactionStateChanged(TransactionState)
    case prompt(String)
    case error(PathError)
    case receiptReady(ReceiptData)
}

public enum ConnectionState: Equatable, Sendable {
    case idle
    case scanning
    case connecting
    case connected
    case disconnected
    case error(String)
}
