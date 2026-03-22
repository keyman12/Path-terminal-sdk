import XCTest
@testable import PathEmulatorAdapter
import PathCoreModels

/// Validates JSON shapes expected from Path POS Emulator (P1-14 + sale/refund) without BLE.
final class EmulatorWireJsonMappingTests: XCTestCase {
    func testGetTransactionStatusPendingMapsToAuthorizing() {
        let raw: [String: Any] = [
            "status": "success",
            "txn_status": "processing",
            "amount": 100,
            "currency": "GBP",
            "original_req_id": "orig-req-1"
        ]
        let r = EmulatorWireJsonMapping.mapTransactionResult(
            raw,
            defaultState: .approved,
            requestId: "orig-req-1",
            amountFallback: 0,
            currencyFallback: "GBP"
        )
        XCTAssertEqual(r.state, .authorizing)
        XCTAssertEqual(r.amountMinor, 100)
        XCTAssertEqual(r.requestId, "orig-req-1")
    }

    func testSaleApprovedTopLevel() {
        let raw: [String: Any] = [
            "status": "approved",
            "amount": 500,
            "currency": "GBP",
            "txn_id": "txn-1"
        ]
        let r = EmulatorWireJsonMapping.mapTransactionResult(
            raw,
            defaultState: .approved,
            requestId: "req-1",
            amountFallback: 0,
            currencyFallback: "XXX"
        )
        XCTAssertEqual(r.state, .approved)
        XCTAssertEqual(r.transactionId, "txn-1")
    }

    func testUnsupportedOperationThrows() {
        let raw: [String: Any] = [
            "status": "error",
            "error": "Unknown command: GetTransactionStatus"
        ]
        XCTAssertThrowsError(
            try EmulatorWireJsonMapping.throwIfUnsupportedOperation(raw, commandName: "GetTransactionStatus")
        ) { error in
            let pe = error as? PathError
            XCTAssertEqual(pe?.code, .unsupportedOperation)
        }
    }
}
