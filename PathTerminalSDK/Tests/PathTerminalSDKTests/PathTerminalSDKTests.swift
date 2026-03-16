import XCTest
@testable import PathTerminalSDK

final class PathTerminalSDKTests: XCTestCase {
    func testVersion() {
        XCTAssertFalse(PathTerminalSDK.version.isEmpty)
    }
}
