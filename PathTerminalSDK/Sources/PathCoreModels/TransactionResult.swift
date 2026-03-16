/// Transaction result with canonical status and identifiers.
/// Per SDK contract rules: final/in-progress state, transaction IDs, receipt availability.
import Foundation

public struct TransactionResult: Codable, Equatable, Sendable {
    public let transactionId: String?
    public let requestId: String
    public let state: TransactionState
    public let amountMinor: Int
    public let currency: String
    public let tipMinor: Int?
    public let cardLastFour: String?
    public let receiptAvailable: Bool
    public let timestampUtc: String
    public let error: PathError?

    public init(
        transactionId: String?,
        requestId: String,
        state: TransactionState,
        amountMinor: Int,
        currency: String,
        tipMinor: Int? = nil,
        cardLastFour: String? = nil,
        receiptAvailable: Bool = false,
        timestampUtc: String,
        error: PathError? = nil
    ) {
        self.transactionId = transactionId
        self.requestId = requestId
        self.state = state
        self.amountMinor = amountMinor
        self.currency = currency
        self.tipMinor = tipMinor
        self.cardLastFour = cardLastFour
        self.receiptAvailable = receiptAvailable
        self.timestampUtc = timestampUtc
        self.error = error
    }

    /// True if transaction reached a successful terminal outcome
    public var isApproved: Bool { state == .approved || state == .refunded || state == .reversed || state == .settled }

    /// True if transaction reached a terminal outcome (success or failure)
    public var isFinal: Bool {
        switch state {
        case .approved, .declined, .cancelled, .timedOut, .failed, .reversed, .refunded, .settled:
            return true
        default:
            return false
        }
    }
}
