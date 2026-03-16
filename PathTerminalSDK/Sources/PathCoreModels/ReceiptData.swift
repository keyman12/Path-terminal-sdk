/// Receipt data for transaction receipts.
/// Structured card receipt fields (EMV-style) from terminal; EPOS renders without editing.
import Foundation

/// Structured fields for one copy of the card receipt (merchant or customer).
/// Map from terminal GetReceipt response (snake_case).
public struct CardReceiptFields: Codable, Equatable, Sendable {
    public let copyLabel: String
    public let txnType: String
    public let amount: Int
    public let currency: String
    public let cardScheme: String
    public let maskedPan: String
    public let entryMode: String
    public let aid: String
    public let verification: String
    public let authCode: String
    public let merchantId: String
    public let terminalId: String
    public let txnRef: String
    public let timestamp: String
    public let status: String
    public let retainMessage: String?

    public init(
        copyLabel: String,
        txnType: String,
        amount: Int,
        currency: String,
        cardScheme: String,
        maskedPan: String,
        entryMode: String,
        aid: String,
        verification: String,
        authCode: String,
        merchantId: String,
        terminalId: String,
        txnRef: String,
        timestamp: String,
        status: String,
        retainMessage: String? = nil
    ) {
        self.copyLabel = copyLabel
        self.txnType = txnType
        self.amount = amount
        self.currency = currency
        self.cardScheme = cardScheme
        self.maskedPan = maskedPan
        self.entryMode = entryMode
        self.aid = aid
        self.verification = verification
        self.authCode = authCode
        self.merchantId = merchantId
        self.terminalId = terminalId
        self.txnRef = txnRef
        self.timestamp = timestamp
        self.status = status
        self.retainMessage = retainMessage
    }

    enum CodingKeys: String, CodingKey {
        case copyLabel = "copy_label"
        case txnType = "txn_type"
        case amount, currency, status, timestamp
        case cardScheme = "card_scheme"
        case maskedPan = "masked_pan"
        case entryMode = "entry_mode"
        case aid, verification
        case authCode = "auth_code"
        case merchantId = "merchant_id"
        case terminalId = "terminal_id"
        case txnRef = "txn_ref"
        case retainMessage = "retain_message"
    }
}

/// Receipt data: both merchant and customer card receipt copies for a transaction.
public struct ReceiptData: Codable, Equatable, Sendable {
    public let transactionId: String
    public let requestId: String?
    public let merchantReceipt: CardReceiptFields
    public let customerReceipt: CardReceiptFields
    public let timestampUtc: String

    public init(
        transactionId: String,
        requestId: String? = nil,
        merchantReceipt: CardReceiptFields,
        customerReceipt: CardReceiptFields,
        timestampUtc: String
    ) {
        self.transactionId = transactionId
        self.requestId = requestId
        self.merchantReceipt = merchantReceipt
        self.customerReceipt = customerReceipt
        self.timestampUtc = timestampUtc
    }
}
