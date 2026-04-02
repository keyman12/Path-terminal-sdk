// Canonical Swift code examples — sourced from TerminalSDKTab.tsx (the single source of truth).
// Any fix to an example must be made here AND in the Dashboard component.

export const EXAMPLES: Record<string, string> = {
  install: `// In Xcode: File → Add Package Dependencies
// Enter the repository URL:
https://github.com/keyman12/path-terminal-sdk

// Select PathTerminalSDK and PathEmulatorAdapter targets.`,

  init: `import PathTerminalSDK
import PathEmulatorAdapter
import PathCoreModels

// Wrap the terminal in an ObservableObject so SwiftUI
// views can react to connection and transaction state.
@MainActor
final class TerminalManager: ObservableObject {

    let terminal: PathTerminal

    init() {
        // BLEPathTerminalAdapter connects to the Path POS Emulator over Bluetooth.
        // Additional adapters (WiFi, USB) will be available in future releases.
        // Swapping adapters requires only changing this one line.
        let adapter = BLEPathTerminalAdapter(
            sdkVersion: "0.1.0",
            adapterVersion: "0.1.0"
        )
        terminal = PathTerminal(adapter: adapter)
    }
}

// In your SwiftUI App struct or root view:
@StateObject private var manager = TerminalManager()`,

  discover: `// 1. Scan — returns once scanning completes.
let devices = try await terminal.discoverDevices()

// 2. Connect — pick from the list, or auto-connect to the first.
if let device = devices.first {
    try await terminal.connect(to: device)
}

// The terminal.events stream will emit .connectionStateChanged(.connected) when ready.`,

  sale: `// Build the request — amounts in minor units (pence/cents).
let envelope = RequestEnvelope.create(
    merchantReference: "ORDER-001",   // your own order ref (optional)
    sdkVersion: "0.1.0",
    adapterVersion: "0.1.0"
)
let request = TransactionRequest.sale(
    amountMinor: 1250,   // £12.50 in pence — never pass decimals
    currency: "GBP",
    envelope: envelope
)

do {
    let result = try await terminal.sale(request: request)

    switch result.state {
    case .approved:
        print("Approved — txn: \\(result.transactionId ?? "-")")
    case .declined:
        print("Declined — \\(result.error?.message ?? "unknown")")
    case .timedOut:
        print("No card presented — timed out")
    case .failed:
        print("Terminal fault: \\(result.error?.message ?? "")")
    default:
        print("State: \\(result.state)")
    }
} catch let error as PathError {
    print("Error [\\(error.code)]: \\(error.message)")
    if error.recoverable { /* safe to retry with a new idempotencyKey */ }
}`,

  refund: `let envelope = RequestEnvelope.create(
    sdkVersion: "0.1.0",
    adapterVersion: "0.1.0"
)
let request = TransactionRequest.refund(
    amountMinor: 1250,
    currency: "GBP",
    originalTransactionId: result.transactionId, // from the original sale result
    envelope: envelope
)

do {
    let refundResult = try await terminal.refund(request: request)
    print("Refund state: \\(refundResult.state)")
} catch let error as PathError {
    print("Refund error [\\(error.code)]: \\(error.message)")
}`,

  receipt: `// Fetch full receipt data after a successful transaction.
guard let txnId = result.transactionId else { return }

let receiptData = try await terminal.getReceiptData(transactionId: txnId)

// Two copies — always use both:
// receiptData.merchantReceipt — for your records (full MID/TID)
// receiptData.customerReceipt — to show / print / email (masked MID/TID)

print("Card: \\(receiptData.customerReceipt.maskedPan)")
print("Auth: \\(receiptData.customerReceipt.authCode)")
print("Amount: \\(receiptData.customerReceipt.amount)")
print("Scheme: \\(receiptData.customerReceipt.cardScheme)")`,

  events: `// Observe all terminal events via AsyncStream.
// Start this Task at the same time as initialisation — not per-transaction.
Task {
    for await event in terminal.events {
        switch event {
        case .connectionStateChanged(let state):
            print("Connection: \\(state)")
        case .transactionStateChanged(let state):
            print("Transaction: \\(state)")
        case .receiptReady(let data):
            print("Receipt ready — \\(data.transactionId)")
        case .deviceDiscovered(let device):
            print("Found: \\(device.name)")
        case .prompt(let message):
            print("Terminal prompt: \\(message)")
        case .error(let error):
            print("Non-fatal error: \\(error.message)")
        }
    }
}`,

  capabilities: `// Query what the connected terminal supports before presenting payment options.
let caps = try await terminal.getCapabilities()

print("NFC: \\(caps.nfc)")
print("Display: \\(caps.display)")
print("Receipt print: \\(caps.receiptPrint ?? false)")
print("Commands: \\(caps.commands)")

// Adapt your UI:
if caps.nfc {
    showContactlessOption()
}`,
};
