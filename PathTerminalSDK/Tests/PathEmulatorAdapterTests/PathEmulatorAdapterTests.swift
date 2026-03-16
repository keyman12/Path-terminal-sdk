import XCTest
@testable import PathEmulatorAdapter

final class PathEmulatorAdapterTests: XCTestCase {
    func testAdapterVersion() {
        XCTAssertFalse(PathEmulatorAdapter.adapterVersion.isEmpty)
    }
}
