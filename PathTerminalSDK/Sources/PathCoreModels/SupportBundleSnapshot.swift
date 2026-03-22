/// Redacted support bundle for diagnostics (no PAN or full card numbers).
import Foundation

public struct SupportBundleSnapshotV1: Codable, Sendable, Equatable {
    public var bundleVersion: String
    public var generatedAtUtc: String
    /// `path_sdk` or `native_ble`
    public var integration: String
    public var sdkVersion: String?
    public var protocolVersion: String?
    public var connectionState: String
    public var isReady: Bool
    public var isBluetoothPoweredOn: Bool
    public var lastError: String?
    public var logLineCount: Int
    public var recentLogLines: [String]
    public var transactionLogCount: Int

    public init(
        bundleVersion: String = "1",
        generatedAtUtc: String,
        integration: String,
        sdkVersion: String?,
        protocolVersion: String?,
        connectionState: String,
        isReady: Bool,
        isBluetoothPoweredOn: Bool,
        lastError: String?,
        logLineCount: Int,
        recentLogLines: [String],
        transactionLogCount: Int
    ) {
        self.bundleVersion = bundleVersion
        self.generatedAtUtc = generatedAtUtc
        self.integration = integration
        self.sdkVersion = sdkVersion
        self.protocolVersion = protocolVersion
        self.connectionState = connectionState
        self.isReady = isReady
        self.isBluetoothPoweredOn = isBluetoothPoweredOn
        self.lastError = lastError
        self.logLineCount = logLineCount
        self.recentLogLines = recentLogLines
        self.transactionLogCount = transactionLogCount
    }

    public static func encodeJSON(_ snapshot: SupportBundleSnapshotV1) throws -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        return try enc.encode(snapshot)
    }

    public static func encodePrettyString(_ snapshot: SupportBundleSnapshotV1) throws -> String {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try enc.encode(snapshot)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
