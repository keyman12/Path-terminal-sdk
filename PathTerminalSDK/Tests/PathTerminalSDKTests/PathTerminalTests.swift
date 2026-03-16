import XCTest
@testable import PathTerminalSDK
@testable import PathEmulatorAdapter
import PathCoreModels

final class PathTerminalTests: XCTestCase {
    func testSaleWithMockAdapter() async throws {
        let adapter = MockPathTerminalAdapter()
        let terminal = PathTerminal(adapter: adapter)
        let envelope = RequestEnvelope.create(sdkVersion: "0.1.0", adapterVersion: "0.1.0")
        let request = TransactionRequest.sale(amountMinor: 2550, currency: "GBP", tipMinor: 500, envelope: envelope)
        let result = try await terminal.sale(request: request)
        XCTAssertEqual(result.state, .approved)
        XCTAssertEqual(result.amountMinor, 2550)
        XCTAssertEqual(result.currency, "GBP")
        XCTAssertTrue(result.isApproved)
    }

    func testRefundWithMockAdapter() async throws {
        let adapter = MockPathTerminalAdapter()
        let terminal = PathTerminal(adapter: adapter)
        let envelope = RequestEnvelope.create(sdkVersion: "0.1.0", adapterVersion: "0.1.0")
        let request = TransactionRequest.refund(amountMinor: 1000, currency: "GBP", envelope: envelope)
        let result = try await terminal.refund(request: request)
        XCTAssertEqual(result.state, .refunded)
        XCTAssertEqual(result.amountMinor, 1000)
        XCTAssertTrue(result.isApproved)
    }

    func testGetCapabilitiesWithMockAdapter() async throws {
        let adapter = MockPathTerminalAdapter()
        adapter.capabilitiesResult = .success(DeviceCapabilities(commands: ["Sale", "Refund"], nfc: true, display: true))
        let terminal = PathTerminal(adapter: adapter)
        let caps = try await terminal.getCapabilities()
        XCTAssertTrue(caps.supports("Sale"))
        XCTAssertTrue(caps.supports("Refund"))
        XCTAssertTrue(caps.nfc)
    }

    func testDiscoverDevicesEmitsEvents() async throws {
        let adapter = MockPathTerminalAdapter()
        adapter.discoverResult = .success([
            DiscoveredDevice(id: UUID(), name: "Path POS Emulator", rssi: -60)
        ])
        let terminal = PathTerminal(adapter: adapter)
        var events: [PathTerminalEvent] = []
        let task = Task {
            for await event in terminal.events {
                events.append(event)
                if events.count >= 3 { break }
            }
        }
        _ = try await terminal.discoverDevices()
        try await Task.sleep(nanoseconds: 100_000_000)
        task.cancel()
        XCTAssertTrue(events.contains { if case .deviceDiscovered = $0 { return true }; return false })
    }

    func testSaleWithDeclineFromMockAdapter() async throws {
        let adapter = MockPathTerminalAdapter()
        let envelope = RequestEnvelope.create(sdkVersion: "0.1.0", adapterVersion: "0.1.0")
        adapter.saleResult = .success(TransactionResult(
            transactionId: nil,
            requestId: envelope.requestId,
            state: .declined,
            amountMinor: 2550,
            currency: "GBP",
            tipMinor: nil,
            cardLastFour: nil,
            receiptAvailable: false,
            timestampUtc: ISO8601DateFormatter().string(from: Date()),
            error: PathError(code: .decline, message: "Card declined", recoverable: false)
        ))
        let terminal = PathTerminal(adapter: adapter)
        let request = TransactionRequest.sale(amountMinor: 2550, currency: "GBP", envelope: envelope)
        let result = try await terminal.sale(request: request)
        XCTAssertEqual(result.state, .declined)
        XCTAssertFalse(result.isApproved)
    }

    func testGetReceiptDataWithMockAdapter() async throws {
        let adapter = MockPathTerminalAdapter()
        let merchant = CardReceiptFields(
            copyLabel: "MERCHANT COPY",
            txnType: "SALE",
            amount: 670,
            currency: "GBP",
            cardScheme: "Visa",
            maskedPan: "**** **** **** 1234",
            entryMode: "Contactless",
            aid: "A0000000031010",
            verification: "None",
            authCode: "381942",
            merchantId: "M987654321",
            terminalId: "T1234567",
            txnRef: "5f8c1e7b-44c2",
            timestamp: "2026-03-16 14:22",
            status: "APPROVED",
            retainMessage: nil
        )
        let customer = CardReceiptFields(
            copyLabel: "CARDHOLDER COPY",
            txnType: "SALE",
            amount: 670,
            currency: "GBP",
            cardScheme: "Visa",
            maskedPan: "**** **** **** 1234",
            entryMode: "Contactless",
            aid: "A0000000031010",
            verification: "None",
            authCode: "381942",
            merchantId: "**4321",
            terminalId: "****4567",
            txnRef: "5f8c1e7b-44c2",
            timestamp: "2026-03-16 14:22",
            status: "APPROVED",
            retainMessage: "PLEASE RETAIN RECEIPT"
        )
        let receiptData = ReceiptData(
            transactionId: "txn-abc",
            requestId: nil,
            merchantReceipt: merchant,
            customerReceipt: customer,
            timestampUtc: "2026-03-16T14:22:00Z"
        )
        adapter.receiptDataResult = .success(receiptData)
        let terminal = PathTerminal(adapter: adapter)
        let receipt = try await terminal.getReceiptData(transactionId: "txn-abc")
        XCTAssertEqual(receipt.transactionId, "txn-abc")
        XCTAssertEqual(receipt.merchantReceipt.status, "APPROVED")
        XCTAssertEqual(receipt.customerReceipt.retainMessage, "PLEASE RETAIN RECEIPT")
    }
}
