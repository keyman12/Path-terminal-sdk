import XCTest
@testable import PathEmulatorAdapter
import PathCoreModels

final class MockPathTerminalAdapterTests: XCTestCase {
    func testSaleReturnsDefaultApproved() async throws {
        let adapter = MockPathTerminalAdapter()
        let envelope = RequestEnvelope.create(sdkVersion: "0.1.0", adapterVersion: "0.1.0")
        let request = TransactionRequest.sale(amountMinor: 1000, currency: "USD", envelope: envelope)
        let result = try await adapter.sale(request: request)
        XCTAssertEqual(result.state, .approved)
        XCTAssertEqual(result.amountMinor, 1000)
        XCTAssertEqual(result.currency, "USD")
    }

    func testRefundReturnsDefaultRefunded() async throws {
        let adapter = MockPathTerminalAdapter()
        let envelope = RequestEnvelope.create(sdkVersion: "0.1.0", adapterVersion: "0.1.0")
        let request = TransactionRequest.refund(amountMinor: 500, currency: "GBP", envelope: envelope)
        let result = try await adapter.refund(request: request)
        XCTAssertEqual(result.state, .refunded)
    }

    func testConnectSetsIsConnected() async throws {
        let adapter = MockPathTerminalAdapter()
        adapter.discoverResult = .success([DiscoveredDevice(id: UUID(), name: "Test", rssi: -50)])
        let devices = try await adapter.discoverDevices()
        try await adapter.connect(to: devices[0])
        XCTAssertTrue(adapter.isConnected)
        try await adapter.disconnect()
        XCTAssertFalse(adapter.isConnected)
    }

    func testCancelSucceedsByDefault() async throws {
        let adapter = MockPathTerminalAdapter()
        try await adapter.cancelActiveTransaction()
    }

    func testCancelPropagatesError() async throws {
        let adapter = MockPathTerminalAdapter()
        adapter.cancelError = PathError(code: .terminalBusy, message: "Terminal busy", recoverable: true)
        do {
            try await adapter.cancelActiveTransaction()
            XCTFail("expected error")
        } catch let e as PathError {
            XCTAssertEqual(e.code, .terminalBusy)
        }
    }

    func testSaleWithCustomResult() async throws {
        let adapter = MockPathTerminalAdapter()
        let envelope = RequestEnvelope.create(sdkVersion: "0.1.0", adapterVersion: "0.1.0")
        adapter.saleResult = .success(TransactionResult(
            transactionId: "custom-txn",
            requestId: envelope.requestId,
            state: .declined,
            amountMinor: 999,
            currency: "EUR",
            tipMinor: nil,
            cardLastFour: nil,
            receiptAvailable: false,
            timestampUtc: ISO8601DateFormatter().string(from: Date()),
            error: PathError(code: .decline, message: "Insufficient funds", recoverable: false)
        ))
        let request = TransactionRequest.sale(amountMinor: 999, currency: "EUR", envelope: envelope)
        let result = try await adapter.sale(request: request)
        XCTAssertEqual(result.state, .declined)
        XCTAssertEqual(result.transactionId, "custom-txn")
    }
}
