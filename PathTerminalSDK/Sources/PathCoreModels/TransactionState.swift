/// Canonical transaction states per Doc 04 (Protocol, State, and Errors).
/// No hidden jumps; every transition must be explicit and logged.
import Foundation

public enum TransactionState: String, Codable, Equatable, Sendable {
    /// Transaction created, not yet sent to device
    case created
    /// Sent to device, awaiting card interaction
    case pendingDevice = "pending_device"
    /// Card presented to reader
    case cardPresented = "card_presented"
    /// Card read successfully
    case cardRead = "card_read"
    /// Authorization in progress
    case authorizing
    /// Terminal outcomes (final for sale)
    case approved
    case declined
    case cancelled
    case timedOut = "timed_out"
    case failed
    /// Reversal flow
    case reversalPending = "reversal_pending"
    case reversed
    /// Refund flow
    case refundPending = "refund_pending"
    case refunded
    /// Settlement flow
    case settlementPending = "settlement_pending"
    case settled
}
