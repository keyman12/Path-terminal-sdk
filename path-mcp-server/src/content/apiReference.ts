// API Reference — generated from Swift source files.
// Covers all public types in PathTerminalSDK and PathCoreModels.

export const API_REFERENCE = `# Path Terminal SDK — API Reference

> iOS / Swift · v0.1.0

---

## PathTerminal

\`\`\`swift
public final class PathTerminal
\`\`\`

The main entry point for the Path Terminal SDK. Wraps a \`PathTerminalAdapter\` and exposes typed async/await APIs with a concurrent event stream. Hold a single instance at app scope using \`@StateObject\`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| \`events\` | \`AsyncStream<PathTerminalEvent>\` | Infinite async stream of typed terminal events. Subscribe with a Task and for-await loop. Never errors — completes only when PathTerminal is deallocated. |
| \`isConnected\` | \`Bool\` | True when the adapter has an active connection to a terminal. |

### Methods

#### \`init(adapter:)\`
\`\`\`swift
public init(adapter: PathTerminalAdapter)
\`\`\`
Initialise with any \`PathTerminalAdapter\` conformance. Use \`BLEPathTerminalAdapter\` for the Pico W emulator or real BLE hardware. Use \`MockPathTerminalAdapter\` for unit testing.

#### \`discoverDevices()\`
\`\`\`swift
public func discoverDevices() async throws -> [DiscoveredDevice]
\`\`\`
Scan for nearby Path terminals. Emits \`.scanning\` and \`.deviceDiscovered\` events. Returns once scanning completes.
- **Returns:** Array of discovered devices. May be empty.
- **Throws:** \`PathError\` with code \`.connectivity\` if Bluetooth is unavailable.

#### \`connect(to:)\`
\`\`\`swift
public func connect(to device: DiscoveredDevice) async throws
\`\`\`
Connect to a specific discovered device. Emits \`.connecting\` then \`.connected\`.
- **Throws:** \`PathError\` with code \`.connectivity\` if connection fails.

#### \`disconnect()\`
\`\`\`swift
public func disconnect() async throws
\`\`\`
Disconnect from the current terminal. Emits \`.disconnected\`. Safe to call when already disconnected.

#### \`sale(request:)\`
\`\`\`swift
public func sale(request: TransactionRequest) async throws -> TransactionResult
\`\`\`
Initiate a card-present sale. Waits for the customer to present their card. On approval, automatically fetches and emits receipt data if available.
- **Returns:** \`TransactionResult\` with final state, transactionId, and receipt availability flag.
- **Throws:** \`PathError\` with codes including \`.timeout\`, \`.decline\`, \`.connectivity\`.

#### \`refund(request:)\`
\`\`\`swift
public func refund(request: TransactionRequest) async throws -> TransactionResult
\`\`\`
Process a card refund. Customer presents their original payment card.
- **Returns:** \`TransactionResult\` with state \`.refunded\` or \`.declined\`.
- **Throws:** \`PathError\`.

#### \`cancelActiveTransaction()\`
\`\`\`swift
public func cancelActiveTransaction() async throws
\`\`\`
⚠️ **Not yet implemented** — throws \`.unsupportedOperation\`. Planned for a future release.

#### \`getTransactionStatus(requestId:)\`
\`\`\`swift
public func getTransactionStatus(requestId: String) async throws -> TransactionResult
\`\`\`
Query the status of a previous transaction by its \`requestId\`. Use for recovery after a connectivity drop.
- **Returns:** Current state of the transaction.
- **Throws:** \`PathError\` if the terminal cannot locate the transaction.

#### \`getReceiptData(transactionId:)\`
\`\`\`swift
public func getReceiptData(transactionId: String) async throws -> ReceiptData
\`\`\`
Fetch full EMV receipt data for a completed transaction. Returns separate merchant and customer copies.
- **Returns:** \`ReceiptData\` with \`merchantReceipt\` and \`customerReceipt\`.
- **Throws:** \`PathError\` if the transaction is not found or receipt is unavailable.

#### \`getCapabilities()\`
\`\`\`swift
public func getCapabilities() async throws -> DeviceCapabilities
\`\`\`
Query what the connected terminal supports. Use before presenting payment options.
- **Returns:** \`DeviceCapabilities\` with NFC, display, receiptPrint, and command list.
- **Throws:** \`PathError\` if not connected.

---

## PathTerminalAdapter

\`\`\`swift
public protocol PathTerminalAdapter: AnyObject, Sendable
\`\`\`

The protocol that all adapters implement. Swap adapters by passing a different conformance to \`PathTerminal.init(adapter:)\`. No other code changes required.

**Available adapters:**
- \`BLEPathTerminalAdapter\` — connects to Path Pico W emulator or BLE terminal (current)
- \`MockPathTerminalAdapter\` — in-memory mock for unit testing
- WiFi and USB adapters — planned for future releases

---

## TransactionRequest

\`\`\`swift
public struct TransactionRequest: Codable, Equatable, Sendable
\`\`\`

Describes a sale or refund. Always use the factory methods — never use the raw initialiser directly.

### Factory Methods

#### \`TransactionRequest.sale(...)\`
\`\`\`swift
public static func sale(
    amountMinor: Int,
    currency: String,
    tipMinor: Int? = nil,
    envelope: RequestEnvelope
) -> TransactionRequest
\`\`\`

#### \`TransactionRequest.refund(...)\`
\`\`\`swift
public static func refund(
    amountMinor: Int,
    currency: String,
    originalTransactionId: String? = nil,
    originalRequestId: String? = nil,
    envelope: RequestEnvelope
) -> TransactionRequest
\`\`\`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| \`amountMinor\` | \`Int\` | Amount in minor currency units. 1250 = £12.50. |
| \`currency\` | \`String\` | ISO 4217 code e.g. "GBP", "EUR", "USD". |
| \`tipMinor\` | \`Int?\` | Optional tip in minor units. Sale only. |
| \`originalTransactionId\` | \`String?\` | For refunds: transactionId of the original sale. |
| \`originalRequestId\` | \`String?\` | For refunds: requestId of the original sale. |
| \`envelope\` | \`RequestEnvelope\` | Traceability metadata. Use \`RequestEnvelope.create()\`. |

---

## TransactionResult

\`\`\`swift
public struct TransactionResult: Codable, Equatable, Sendable
\`\`\`

The outcome of a sale, refund, or status query. Always check \`state\` first.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| \`transactionId\` | \`String?\` | Terminal-issued ID. Present on approval; nil on pre-auth failure. |
| \`requestId\` | \`String\` | Echo of the original RequestEnvelope requestId. |
| \`state\` | \`TransactionState\` | Final canonical state. |
| \`amountMinor\` | \`Int\` | Authorised amount in minor units. |
| \`currency\` | \`String\` | ISO 4217 currency code. |
| \`tipMinor\` | \`Int?\` | Tip amount if included. |
| \`cardLastFour\` | \`String?\` | Last 4 digits of the card number. |
| \`receiptAvailable\` | \`Bool\` | True when getReceiptData() will succeed. |
| \`timestampUtc\` | \`String\` | ISO 8601 timestamp of the terminal outcome. |
| \`error\` | \`PathError?\` | Present when state is .declined, .failed, or .timedOut. |
| \`isApproved\` | \`Bool\` | Computed: true for .approved, .refunded, .reversed, .settled. |
| \`isFinal\` | \`Bool\` | Computed: true when the transaction has reached a terminal outcome. |

---

## TransactionState

\`\`\`swift
public enum TransactionState: String, Codable, Equatable, Sendable
\`\`\`

Canonical transaction lifecycle. States flow forward only. ★ = final state (isFinal == true).

| Case | Raw value | Description |
|------|-----------|-------------|
| \`.created\` | created | Request created, not yet sent to device |
| \`.pendingDevice\` | pending_device | Sent to terminal, awaiting card |
| \`.cardPresented\` | card_presented | Card detected by reader |
| \`.cardRead\` | card_read | Card data read successfully |
| \`.authorizing\` | authorizing | Authorization request in flight to issuer |
| \`.approved\` ★ | approved | Issuer approved |
| \`.declined\` ★ | declined | Issuer declined |
| \`.cancelled\` ★ | cancelled | Cancelled by operator or customer |
| \`.timedOut\` ★ | timed_out | No card within timeout window |
| \`.failed\` ★ | failed | Terminal or adapter fault |
| \`.reversalPending\` | reversal_pending | Reversal initiated |
| \`.reversed\` ★ | reversed | Reversal approved |
| \`.refundPending\` | refund_pending | Refund initiated, awaiting card |
| \`.refunded\` ★ | refunded | Refund approved |
| \`.settlementPending\` | settlement_pending | Queued for settlement |
| \`.settled\` ★ | settled | Included in settlement batch |

---

## PathTerminalEvent

\`\`\`swift
public enum PathTerminalEvent: Sendable
\`\`\`

Typed events published on \`PathTerminal.events\`.

| Case | Associated value | When it fires |
|------|-----------------|---------------|
| \`.deviceDiscovered(_:)\` | \`DiscoveredDevice\` | A terminal is found during discoverDevices() |
| \`.connectionStateChanged(_:)\` | \`ConnectionState\` | BLE lifecycle changes |
| \`.transactionStateChanged(_:)\` | \`TransactionState\` | Transaction moves through states |
| \`.prompt(_:)\` | \`String\` | Terminal requests operator action |
| \`.error(_:)\` | \`PathError\` | Non-fatal error (did not abort the call) |
| \`.receiptReady(_:)\` | \`ReceiptData\` | Auto-emitted after approved sale if receipt is available |

### ConnectionState

| Case | Description |
|------|-------------|
| \`.idle\` | No operation in progress |
| \`.scanning\` | Scanning for devices |
| \`.connecting\` | Connection attempt in progress |
| \`.connected\` | Active connection — terminal is ready |
| \`.disconnected\` | Connection ended |
| \`.error(String)\` | Connection error with message |

---

## PathError

\`\`\`swift
public struct PathError: Codable, Equatable, Sendable, Error, LocalizedError
\`\`\`

All SDK errors. Check \`code\` for machine-readable classification and \`recoverable\` to decide on retry.

| Property | Type | Description |
|----------|------|-------------|
| \`code\` | \`PathErrorCode\` | Machine-readable error category |
| \`message\` | \`String\` | Human-readable description for logs (not for end-user display) |
| \`adapterErrorCode\` | \`String?\` | Raw error from the underlying adapter. Useful for diagnostics. |
| \`recoverable\` | \`Bool\` | True if the operation can be retried without user intervention |

### PathErrorCode values

validation · connectivity · capability · terminal_busy · timeout · user_cancelled · decline · terminal_fault · adapter_fault · protocol_mismatch · recovery_required · configuration_error · unsupported_operation

Call \`explain_error\` MCP tool with any of these codes for full details, causes, and recovery guidance.

---

## ReceiptData

\`\`\`swift
public struct ReceiptData: Codable, Equatable, Sendable
\`\`\`

Full receipt payload. Render fields exactly as received — do not edit regulated content.

| Property | Type | Description |
|----------|------|-------------|
| \`transactionId\` | \`String\` | Terminal transaction identifier |
| \`requestId\` | \`String?\` | Echo of the original requestId |
| \`merchantReceipt\` | \`CardReceiptFields\` | Merchant copy — full MID/TID |
| \`customerReceipt\` | \`CardReceiptFields\` | Cardholder copy — masked MID/TID |
| \`timestampUtc\` | \`String\` | ISO 8601 timestamp |

### CardReceiptFields (16 regulated fields)

copyLabel · txnType · amount · currency · cardScheme · maskedPan · entryMode · aid · verification · authCode · merchantId · terminalId · txnRef · timestamp · status · retainMessage

---

## RequestEnvelope

\`\`\`swift
public struct RequestEnvelope: Codable, Equatable, Sendable
\`\`\`

Traceability metadata attached to every request. Use \`RequestEnvelope.create()\` — it auto-generates requestId, idempotencyKey, correlationId, and timestamp.

\`\`\`swift
public static func create(
    idempotencyKey: String? = nil,
    merchantReference: String? = nil,
    terminalSessionId: String? = nil,
    correlationId: String? = nil,
    sdkVersion: String,
    adapterVersion: String
) -> RequestEnvelope
\`\`\`

Pass your own \`idempotencyKey\` to enable safe retries — same key = same logical operation.

---

## DeviceCapabilities

\`\`\`swift
public struct DeviceCapabilities: Codable, Equatable, Sendable
\`\`\`

| Property | Type | Description |
|----------|------|-------------|
| \`commands\` | \`[String]\` | List of supported command names |
| \`nfc\` | \`Bool\` | Contactless/NFC available |
| \`display\` | \`Bool\` | Terminal has a customer display |
| \`receiptPrint\` | \`Bool?\` | Terminal can print receipts |

\`caps.supports("SALE")\` — convenience method to check if a specific command is available.

---

## DiscoveredDevice

\`\`\`swift
public struct DiscoveredDevice: Identifiable, Equatable, Sendable, Codable
\`\`\`

| Property | Type | Description |
|----------|------|-------------|
| \`id\` | \`UUID\` | Unique BLE peripheral identifier |
| \`name\` | \`String\` | Device display name |
| \`rssi\` | \`Int\` | Signal strength in dBm (negative; closer to 0 = stronger) |

---

## MockPathTerminalAdapter

\`\`\`swift
public final class MockPathTerminalAdapter: PathTerminalAdapter
\`\`\`

Configurable mock for unit testing without BLE hardware.

\`\`\`swift
let mock = MockPathTerminalAdapter()
mock.saleResult = .success(approvedResult)   // or .failure(...)
mock.delayMs = 500                           // simulate latency

let terminal = PathTerminal(adapter: mock)
\`\`\`

Configure \`discoverResult\`, \`connectError\`, \`saleResult\`, \`refundResult\`, \`capabilitiesResult\`, \`receiptDataResult\`, and \`delayMs\` to cover all test scenarios without a physical device.
`;
