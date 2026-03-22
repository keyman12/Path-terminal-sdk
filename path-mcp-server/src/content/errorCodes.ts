export interface ErrorCodeInfo {
  code: string;
  meaning: string;
  commonCauses: string[];
  recoverable: boolean;
  suggestedFix: string;
}

export const ERROR_CODES: Record<string, ErrorCodeInfo> = {
  validation: {
    code: "validation",
    meaning: "Request parameters failed validation before being sent to the terminal.",
    commonCauses: [
      "Amount is zero or negative",
      "Currency code is not a valid ISO 4217 code",
      "Missing or malformed RequestEnvelope",
      "Using raw TransactionRequest init instead of .sale() or .refund() factory methods",
    ],
    recoverable: true,
    suggestedFix:
      "Check the request parameters. Use TransactionRequest.sale(...) or TransactionRequest.refund(...) factory methods. Ensure amountMinor is a positive integer in minor units (pence/cents). Use RequestEnvelope.create() to build the envelope.",
  },
  connectivity: {
    code: "connectivity",
    meaning: "BLE connection failed, was lost, or could not be established.",
    commonCauses: [
      "Bluetooth is not powered on",
      "App does not have Bluetooth permission (NSBluetoothAlwaysUsageDescription missing from Info.plist)",
      "Emulator is out of BLE range or powered off",
      "Connection dropped mid-transaction",
    ],
    recoverable: true,
    suggestedFix:
      "Verify Bluetooth is enabled on the device. Check Info.plist for NSBluetoothAlwaysUsageDescription. Ensure the emulator is powered on and within range. Call discoverDevices() again and reconnect before retrying the operation.",
  },
  capability: {
    code: "capability",
    meaning: "The terminal does not support the requested operation.",
    commonCauses: [
      "Requesting NFC when the terminal does not have NFC hardware",
      "Calling an operation not listed in DeviceCapabilities.commands",
    ],
    recoverable: false,
    suggestedFix:
      "Call getCapabilities() first and check caps.commands before attempting the operation. Use caps.nfc, caps.display, and caps.receiptPrint to adapt your UI.",
  },
  terminal_busy: {
    code: "terminal_busy",
    meaning: "The terminal is currently processing another transaction.",
    commonCauses: [
      "A previous sale or refund is still in progress",
      "The terminal was not properly reset after a prior operation",
    ],
    recoverable: true,
    suggestedFix:
      "Wait for the current transaction to complete before starting a new one. Call getTransactionStatus() to check the state of the in-progress transaction. Do not start concurrent transactions.",
  },
  timeout: {
    code: "timeout",
    meaning: "No card was presented within the terminal's timeout window, or the terminal did not respond in time.",
    commonCauses: [
      "Customer did not present card within 30 seconds",
      "Terminal became unresponsive",
      "BLE connection degraded during the transaction",
    ],
    recoverable: true,
    suggestedFix:
      "Inform the customer the payment timed out and offer to retry. Call getTransactionStatus() with the original requestId before retrying to confirm the transaction was not partially processed. Use a new idempotencyKey for a retry.",
  },
  user_cancelled: {
    code: "user_cancelled",
    meaning: "The transaction was cancelled by the operator or cardholder.",
    commonCauses: [
      "Operator pressed cancel in the app",
      "Customer cancelled on the terminal",
    ],
    recoverable: true,
    suggestedFix:
      "No recovery needed — this is an intentional cancellation. Offer the operator the option to start a new transaction.",
  },
  decline: {
    code: "decline",
    meaning: "The card issuer declined the transaction.",
    commonCauses: [
      "Insufficient funds",
      "Card blocked or expired",
      "Issuer fraud prevention triggered",
    ],
    recoverable: false,
    suggestedFix:
      "Do not retry the same card. Display a polite declined message to the customer. Offer alternative payment methods. Never expose the raw decline reason to the customer.",
  },
  terminal_fault: {
    code: "terminal_fault",
    meaning: "A hardware or firmware fault occurred on the terminal itself.",
    commonCauses: [
      "Terminal firmware issue",
      "NFC reader hardware fault",
      "Terminal requires a restart",
    ],
    recoverable: false,
    suggestedFix:
      "Power cycle the terminal. If the fault persists, export a support bundle and contact Path support. Do not retry financial operations after a terminal fault without confirming the terminal is healthy.",
  },
  adapter_fault: {
    code: "adapter_fault",
    meaning: "A fault in the SDK adapter layer — unexpected behaviour from the BLE layer or adapter code.",
    commonCauses: [
      "Malformed response from the emulator",
      "Protocol version mismatch between SDK and emulator",
      "Emulator firmware bug",
    ],
    recoverable: false,
    suggestedFix:
      "Check the SDK and emulator firmware versions are compatible. Reconnect and retry. If it persists, export a support bundle. Check path://docs/13-contradiction-resolutions for known issues.",
  },
  protocol_mismatch: {
    code: "protocol_mismatch",
    meaning: "The terminal responded with an unexpected message format or an unrecognised command.",
    commonCauses: [
      "Emulator firmware is out of date",
      "SDK version is ahead of the emulator version",
    ],
    recoverable: false,
    suggestedFix:
      "Update both the SDK and the emulator firmware to compatible versions. Check path://docs/15-emulator-p1-10-to-p1-13-guide for emulator update instructions.",
  },
  recovery_required: {
    code: "recovery_required",
    meaning: "A previous transaction is in an unknown state. The terminal requires status confirmation before a new transaction can proceed.",
    commonCauses: [
      "App crashed or was killed mid-transaction",
      "BLE dropped immediately after sale was sent but before result was received",
    ],
    recoverable: true,
    suggestedFix:
      "Call getTransactionStatus(requestId:) with the original requestId to resolve the state before proceeding. Only start a new transaction once the previous state is confirmed. Never assume a transaction was declined just because the result was not received.",
  },
  configuration_error: {
    code: "configuration_error",
    meaning: "The SDK or adapter is misconfigured.",
    commonCauses: [
      "sdkVersion or adapterVersion strings are empty or malformed",
      "BLEPathTerminalAdapter initialised with invalid parameters",
    ],
    recoverable: false,
    suggestedFix:
      "Review the adapter initialisation. Use BLEPathTerminalAdapter(sdkVersion: \"0.1.0\", adapterVersion: \"0.1.0\"). Ensure PathTerminal is initialised with a valid adapter before any operations are called.",
  },
  unsupported_operation: {
    code: "unsupported_operation",
    meaning: "The method has not yet been implemented in this release of the SDK.",
    commonCauses: [
      "Calling cancelActiveTransaction() — not implemented in v0.1",
    ],
    recoverable: false,
    suggestedFix:
      "Check the API reference for the current implementation status. cancelActiveTransaction() is planned for a future release. See path://docs/10-delivery-plan for the roadmap.",
  },
};
