/// Transaction request for sale or refund.
/// Amounts in minor units (pence/cents); currency as ISO 4217.
import Foundation

public struct TransactionRequest: Codable, Equatable, Sendable {
    public let amountMinor: Int
    public let currency: String
    public let tipMinor: Int?
    public let originalTransactionId: String?
    public let originalRequestId: String?
    public let envelope: RequestEnvelope

    public init(
        amountMinor: Int,
        currency: String,
        tipMinor: Int? = nil,
        originalTransactionId: String? = nil,
        originalRequestId: String? = nil,
        envelope: RequestEnvelope
    ) {
        self.amountMinor = amountMinor
        self.currency = currency
        self.tipMinor = tipMinor
        self.originalTransactionId = originalTransactionId
        self.originalRequestId = originalRequestId
        self.envelope = envelope
    }

    /// Sale request
    public static func sale(
        amountMinor: Int,
        currency: String,
        tipMinor: Int? = nil,
        envelope: RequestEnvelope
    ) -> TransactionRequest {
        TransactionRequest(
            amountMinor: amountMinor,
            currency: currency,
            tipMinor: tipMinor,
            originalTransactionId: nil,
            originalRequestId: nil,
            envelope: envelope
        )
    }

    /// Refund request
    public static func refund(
        amountMinor: Int,
        currency: String,
        originalTransactionId: String? = nil,
        originalRequestId: String? = nil,
        envelope: RequestEnvelope
    ) -> TransactionRequest {
        TransactionRequest(
            amountMinor: amountMinor,
            currency: currency,
            tipMinor: nil,
            originalTransactionId: originalTransactionId,
            originalRequestId: originalRequestId,
            envelope: envelope
        )
    }
}
