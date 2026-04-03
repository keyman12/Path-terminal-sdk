package tech.path2ai.sdk.emulator

import kotlinx.serialization.json.*
import tech.path2ai.sdk.core.*
import java.time.Instant

/**
 * Maps emulator wire-protocol JSON responses to [TransactionResult].
 * The wire format uses snake_case keys and string status values.
 */
internal object EmulatorWireJsonMapping {

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Parse a raw JSON response string (after stripping "OK " prefix) into a [TransactionResult].
     */
    fun mapResponse(raw: String, requestId: String): TransactionResult {
        val obj = json.parseToJsonElement(raw).jsonObject

        val status = obj["status"]?.jsonPrimitive?.contentOrNull ?: "error"
        val txnStatus = obj["txn_status"]?.jsonPrimitive?.contentOrNull
            ?: obj["transaction_status"]?.jsonPrimitive?.contentOrNull
            ?: "failed"
        val txnId = obj["txn_id"]?.jsonPrimitive?.contentOrNull
        val amount = obj["amount"]?.jsonPrimitive?.intOrNull ?: 0
        val currency = obj["currency"]?.jsonPrimitive?.contentOrNull ?: "GBP"
        val tip = obj["tip"]?.jsonPrimitive?.intOrNull
        val cardLastFour = obj["card_last_four"]?.jsonPrimitive?.contentOrNull
        val receiptAvailable = obj["receipt_available"]?.jsonPrimitive?.booleanOrNull ?: false
        val errorMessage = obj["error"]?.jsonPrimitive?.contentOrNull

        val state = mapTxnStatus(txnStatus)

        val pathError = if (status == "error" || state == TransactionState.FAILED || state == TransactionState.DECLINED) {
            PathError(
                code = if (state == TransactionState.DECLINED) PathErrorCode.DECLINE else PathErrorCode.TERMINAL_FAULT,
                message = errorMessage ?: "Transaction $txnStatus",
                recoverable = false
            )
        } else null

        return TransactionResult(
            transactionId = txnId,
            requestId = requestId,
            state = state,
            amountMinor = amount,
            currency = currency,
            tipMinor = tip,
            cardLastFour = cardLastFour,
            receiptAvailable = receiptAvailable,
            timestampUtc = Instant.now().toString(),
            error = pathError
        )
    }

    /**
     * Map receipt JSON response to [ReceiptData].
     */
    fun mapReceiptResponse(raw: String, transactionId: String): ReceiptData {
        val obj = json.parseToJsonElement(raw).jsonObject
        val receiptObj = obj["receipt"]?.jsonObject ?: obj

        return ReceiptData(
            transactionId = transactionId,
            requestId = receiptObj["request_id"]?.jsonPrimitive?.contentOrNull,
            merchantReceipt = mapReceiptFields(receiptObj["merchant_receipt"]?.jsonObject ?: JsonObject(emptyMap())),
            customerReceipt = mapReceiptFields(receiptObj["customer_receipt"]?.jsonObject ?: JsonObject(emptyMap())),
            timestampUtc = Instant.now().toString()
        )
    }

    private fun mapReceiptFields(obj: JsonObject): CardReceiptFields {
        return CardReceiptFields(
            copyLabel = obj["copy_label"]?.jsonPrimitive?.contentOrNull ?: "",
            txnType = obj["txn_type"]?.jsonPrimitive?.contentOrNull ?: "",
            amount = obj["amount"]?.jsonPrimitive?.intOrNull ?: 0,
            currency = obj["currency"]?.jsonPrimitive?.contentOrNull ?: "GBP",
            cardScheme = obj["card_scheme"]?.jsonPrimitive?.contentOrNull ?: "",
            maskedPan = obj["masked_pan"]?.jsonPrimitive?.contentOrNull ?: "",
            entryMode = obj["entry_mode"]?.jsonPrimitive?.contentOrNull ?: "",
            aid = obj["aid"]?.jsonPrimitive?.contentOrNull ?: "",
            verification = obj["verification"]?.jsonPrimitive?.contentOrNull ?: "",
            authCode = obj["auth_code"]?.jsonPrimitive?.contentOrNull ?: "",
            merchantId = obj["merchant_id"]?.jsonPrimitive?.contentOrNull ?: "",
            terminalId = obj["terminal_id"]?.jsonPrimitive?.contentOrNull ?: "",
            txnRef = obj["txn_ref"]?.jsonPrimitive?.contentOrNull ?: "",
            timestamp = obj["timestamp"]?.jsonPrimitive?.contentOrNull ?: "",
            status = obj["status"]?.jsonPrimitive?.contentOrNull ?: "",
            retainMessage = obj["retain_message"]?.jsonPrimitive?.contentOrNull
        )
    }

    private fun mapTxnStatus(status: String): TransactionState {
        return when (status.lowercase()) {
            "approved" -> TransactionState.APPROVED
            "declined" -> TransactionState.DECLINED
            "cancelled", "canceled" -> TransactionState.CANCELLED
            "timed_out", "timedout" -> TransactionState.TIMED_OUT
            "failed", "error" -> TransactionState.FAILED
            "processing", "authorizing" -> TransactionState.AUTHORIZING
            "refunded" -> TransactionState.REFUNDED
            "reversed" -> TransactionState.REVERSED
            "pending_device" -> TransactionState.PENDING_DEVICE
            "card_presented" -> TransactionState.CARD_PRESENTED
            "card_read" -> TransactionState.CARD_READ
            else -> TransactionState.FAILED
        }
    }
}
