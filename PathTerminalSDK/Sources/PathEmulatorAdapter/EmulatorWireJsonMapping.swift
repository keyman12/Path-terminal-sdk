/// Maps Nordic UART newline-delimited JSON `result` objects to ``TransactionResult``.
/// Shared so unit tests can validate fixtures without BLE hardware.
import Foundation
import PathCoreModels

enum EmulatorWireJsonMapping {
    static func mapTransactionResult(
        _ raw: [String: Any],
        defaultState: TransactionState,
        requestId: String,
        amountFallback: Int,
        currencyFallback: String
    ) -> TransactionResult {
        let topStatus = (raw["status"] as? String)?.lowercased() ?? ""
        let txnStatus = (raw["txn_status"] as? String) ?? (raw["transaction_status"] as? String)
        let paymentStatus: String? = {
            if let t = txnStatus, !t.isEmpty { return t.lowercased() }
            if topStatus == "success" || topStatus == "error" { return nil }
            return topStatus.isEmpty ? nil : topStatus
        }()

        let state: TransactionState
        let error: PathError?

        if topStatus == "error" {
            let msg = raw["error"] as? String ?? "Terminal error"
            state = .declined
            error = PathError(code: .decline, message: msg, recoverable: false)
        } else if let ps = paymentStatus, !ps.isEmpty {
            switch ps {
            case "approved", "success":
                state = defaultState
                error = nil
            case "refunded":
                state = .refunded
                error = nil
            case "cancelled", "canceled":
                state = .cancelled
                error = nil
            case "timed_out", "timedout":
                state = .timedOut
                error = PathError(code: .timeout, message: raw["error"] as? String ?? "Transaction timed out", recoverable: true)
            case "declined":
                state = .declined
                error = PathError(code: .decline, message: raw["error"] as? String ?? "Declined", recoverable: false)
            case "processing", "pending", "pending_device", "busy", "authorizing":
                state = .authorizing
                error = nil
            default:
                state = .declined
                error = PathError(code: .decline, message: raw["error"] as? String ?? "Declined", recoverable: false)
            }
        } else if topStatus == "approved" || topStatus == "success" {
            state = defaultState
            error = nil
        } else if topStatus == "refunded" {
            state = .refunded
            error = nil
        } else if topStatus == "cancelled" || topStatus == "canceled" {
            state = .cancelled
            error = nil
        } else if topStatus == "timed_out" {
            state = .timedOut
            error = PathError(code: .timeout, message: raw["error"] as? String ?? "Transaction timed out", recoverable: true)
        } else {
            state = .declined
            error = PathError(code: .decline, message: raw["error"] as? String ?? "Declined", recoverable: false)
        }

        let amount = raw["amount"] as? Int ?? amountFallback
        let currency = raw["currency"] as? String ?? currencyFallback
        let tip = raw["tip"] as? Int
        let txnId = raw["txn_id"] as? String
        let cardLastFour = raw["card_last_four"] as? String
        let receiptAvailable = raw["receipt_available"] as? Bool ?? false
        let now = ISO8601DateFormatter().string(from: Date())
        let resolvedRequestId = (raw["original_req_id"] as? String) ?? (raw["request_id"] as? String) ?? requestId
        return TransactionResult(
            transactionId: txnId,
            requestId: resolvedRequestId,
            state: state,
            amountMinor: amount,
            currency: currency,
            tipMinor: tip,
            cardLastFour: cardLastFour,
            receiptAvailable: receiptAvailable,
            timestampUtc: now,
            error: error
        )
    }

    static func throwIfUnsupportedOperation(_ raw: [String: Any], commandName: String) throws {
        let top = (raw["status"] as? String)?.lowercased() ?? ""
        guard top == "error" else { return }
        let msg = raw["error"] as? String ?? ""
        if msg.contains("Unknown command") {
            throw PathError(
                code: .unsupportedOperation,
                message: "\(commandName) not supported by this terminal firmware",
                recoverable: false
            )
        }
    }
}
