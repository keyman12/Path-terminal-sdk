import XCTest
import PathCoreModels

final class SupportBundleSnapshotTests: XCTestCase {
    func testEncodeRoundTrip() throws {
        let snap = SupportBundleSnapshotV1(
            generatedAtUtc: "2026-03-20T12:00:00Z",
            integration: "path_sdk",
            sdkVersion: "0.1.0",
            protocolVersion: "0.1",
            connectionState: "ready",
            isReady: true,
            isBluetoothPoweredOn: true,
            lastError: nil,
            logLineCount: 1,
            recentLogLines: ["line"],
            transactionLogCount: 0
        )
        let data = try SupportBundleSnapshotV1.encodeJSON(snap)
        let decoded = try JSONDecoder().decode(SupportBundleSnapshotV1.self, from: data)
        XCTAssertEqual(decoded.integration, "path_sdk")
        XCTAssertEqual(decoded.recentLogLines, ["line"])
    }

    func testPrettyStringContainsIntegration() throws {
        let snap = SupportBundleSnapshotV1(
            generatedAtUtc: "2026-03-20T12:00:00Z",
            integration: "native_ble",
            sdkVersion: nil,
            protocolVersion: "0.1",
            connectionState: "idle",
            isReady: false,
            isBluetoothPoweredOn: true,
            lastError: nil,
            logLineCount: 0,
            recentLogLines: [],
            transactionLogCount: 0
        )
        let pretty = try SupportBundleSnapshotV1.encodePrettyString(snap)
        XCTAssertTrue(pretty.contains("native_ble"))
    }
}
