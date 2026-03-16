import XCTest
@testable import PathCoreModels

final class ModelSerializationTests: XCTestCase {
    func testRequestEnvelopeRoundTrip() throws {
        let envelope = RequestEnvelope(
            requestId: "req-123",
            idempotencyKey: "idem-456",
            merchantReference: "MERCH-001",
            terminalSessionId: "sess-789",
            correlationId: "corr-abc",
            sdkVersion: "0.1.0",
            adapterVersion: "0.1.0",
            timestampUtc: "2025-01-15T12:00:00Z"
        )
        let data = try JSONEncoder().encode(envelope)
        let decoded = try JSONDecoder().decode(RequestEnvelope.self, from: data)
        XCTAssertEqual(envelope, decoded)
    }

    func testTransactionStateRoundTrip() throws {
        for state in [TransactionState.created, .approved, .declined, .refunded] {
            let data = try JSONEncoder().encode(state)
            let decoded = try JSONDecoder().decode(TransactionState.self, from: data)
            XCTAssertEqual(state, decoded)
        }
    }

    func testPathErrorRoundTrip() throws {
        let error = PathError(
            code: .timeout,
            message: "Connection timed out",
            adapterErrorCode: "BLE-001",
            recoverable: true
        )
        let data = try JSONEncoder().encode(error)
        let decoded = try JSONDecoder().decode(PathError.self, from: data)
        XCTAssertEqual(error, decoded)
    }

    func testPathErrorCodeRoundTrip() throws {
        for code in [PathErrorCode.validation, .connectivity, .terminalBusy] {
            let data = try JSONEncoder().encode(code)
            let decoded = try JSONDecoder().decode(PathErrorCode.self, from: data)
            XCTAssertEqual(code, decoded)
        }
    }

    func testTransactionRequestRoundTrip() throws {
        let envelope = RequestEnvelope(
            requestId: "req-1",
            idempotencyKey: "idem-1",
            merchantReference: nil,
            terminalSessionId: nil,
            correlationId: "corr-1",
            sdkVersion: "0.1.0",
            adapterVersion: "0.1.0",
            timestampUtc: "2025-01-15T12:00:00Z"
        )
        let request = TransactionRequest.sale(
            amountMinor: 2550,
            currency: "GBP",
            tipMinor: 500,
            envelope: envelope
        )
        let data = try JSONEncoder().encode(request)
        let decoded = try JSONDecoder().decode(TransactionRequest.self, from: data)
        XCTAssertEqual(request, decoded)
    }

    func testTransactionResultRoundTrip() throws {
        let result = TransactionResult(
            transactionId: "txn-123",
            requestId: "req-456",
            state: .approved,
            amountMinor: 2550,
            currency: "GBP",
            tipMinor: 500,
            cardLastFour: "1234",
            receiptAvailable: true,
            timestampUtc: "2025-01-15T12:00:00Z",
            error: nil
        )
        let data = try JSONEncoder().encode(result)
        let decoded = try JSONDecoder().decode(TransactionResult.self, from: data)
        XCTAssertEqual(result, decoded)
    }

    func testDeviceCapabilitiesRoundTrip() throws {
        let caps = DeviceCapabilities(
            commands: ["Sale", "Refund"],
            nfc: true,
            display: true,
            receiptPrint: false
        )
        let data = try JSONEncoder().encode(caps)
        let decoded = try JSONDecoder().decode(DeviceCapabilities.self, from: data)
        XCTAssertEqual(caps, decoded)
    }

    func testDeviceInfoRoundTrip() throws {
        let info = DeviceInfo(
            model: "Path POS Emulator",
            firmware: "1.0.0",
            serial: "SN-001",
            protocolVersion: "0.1"
        )
        let data = try JSONEncoder().encode(info)
        let decoded = try JSONDecoder().decode(DeviceInfo.self, from: data)
        XCTAssertEqual(info, decoded)
    }

    func testDiscoveredDeviceRoundTrip() throws {
        let device = DiscoveredDevice(id: UUID(), name: "Path POS Emulator", rssi: -60)
        let data = try JSONEncoder().encode(device)
        let decoded = try JSONDecoder().decode(DiscoveredDevice.self, from: data)
        XCTAssertEqual(device.id, decoded.id)
        XCTAssertEqual(device.name, decoded.name)
        XCTAssertEqual(device.rssi, decoded.rssi)
    }

    func testReceiptDataRoundTrip() throws {
        let merchant = CardReceiptFields(
            copyLabel: "MERCHANT COPY",
            txnType: "SALE",
            amount: 1000,
            currency: "GBP",
            cardScheme: "Visa",
            maskedPan: "**** **** **** 1234",
            entryMode: "Contactless",
            aid: "A0000000031010",
            verification: "None",
            authCode: "938238",
            merchantId: "M987654321",
            terminalId: "T1234567",
            txnRef: "5f8c1e7b-44c2",
            timestamp: "2025-01-15 12:00",
            status: "APPROVED",
            retainMessage: nil
        )
        let customer = CardReceiptFields(
            copyLabel: "CARDHOLDER COPY",
            txnType: "SALE",
            amount: 1000,
            currency: "GBP",
            cardScheme: "Visa",
            maskedPan: "**** **** **** 1234",
            entryMode: "Contactless",
            aid: "A0000000031010",
            verification: "None",
            authCode: "938238",
            merchantId: "**7321",
            terminalId: "****4567",
            txnRef: "5f8c1e7b-44c2",
            timestamp: "2025-01-15 12:00",
            status: "APPROVED",
            retainMessage: "PLEASE RETAIN RECEIPT"
        )
        let receipt = ReceiptData(
            transactionId: "txn-1",
            requestId: "req-1",
            merchantReceipt: merchant,
            customerReceipt: customer,
            timestampUtc: "2025-01-15T12:00:00Z"
        )
        let data = try JSONEncoder().encode(receipt)
        let decoded = try JSONDecoder().decode(ReceiptData.self, from: data)
        XCTAssertEqual(receipt.transactionId, decoded.transactionId)
        XCTAssertEqual(receipt.merchantReceipt.copyLabel, decoded.merchantReceipt.copyLabel)
        XCTAssertEqual(receipt.customerReceipt.retainMessage, decoded.customerReceipt.retainMessage)
    }
}
