/// Request envelope with all required metadata per Doc 04.
/// Every request must include these fields for traceability and idempotency.
import Foundation

public struct RequestEnvelope: Codable, Equatable, Sendable {
    public let requestId: String
    public let idempotencyKey: String
    public let merchantReference: String?
    public let terminalSessionId: String?
    public let correlationId: String
    public let sdkVersion: String
    public let adapterVersion: String
    public let timestampUtc: String

    public init(
        requestId: String,
        idempotencyKey: String,
        merchantReference: String? = nil,
        terminalSessionId: String? = nil,
        correlationId: String,
        sdkVersion: String,
        adapterVersion: String,
        timestampUtc: String
    ) {
        self.requestId = requestId
        self.idempotencyKey = idempotencyKey
        self.merchantReference = merchantReference
        self.terminalSessionId = terminalSessionId
        self.correlationId = correlationId
        self.sdkVersion = sdkVersion
        self.adapterVersion = adapterVersion
        self.timestampUtc = timestampUtc
    }

    /// Creates envelope with SDK-generated requestId and idempotencyKey if not provided.
    public static func create(
        idempotencyKey: String? = nil,
        merchantReference: String? = nil,
        terminalSessionId: String? = nil,
        correlationId: String? = nil,
        sdkVersion: String,
        adapterVersion: String
    ) -> RequestEnvelope {
        let requestId = UUID().uuidString
        let idemKey = idempotencyKey ?? requestId
        let corrId = correlationId ?? requestId
        let now = ISO8601DateFormatter().string(from: Date())
        return RequestEnvelope(
            requestId: requestId,
            idempotencyKey: idemKey,
            merchantReference: merchantReference,
            terminalSessionId: terminalSessionId,
            correlationId: corrId,
            sdkVersion: sdkVersion,
            adapterVersion: adapterVersion,
            timestampUtc: now
        )
    }
}
