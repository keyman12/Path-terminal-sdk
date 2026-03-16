# 14. Test Verification Plan

Map of plan tickets to tests and verification steps. Use this to confirm coverage as we go.

---

## Phase 0: Protocol Foundation (DONE)

| Ticket | What to Verify | Test Location | Status |
|--------|----------------|---------------|--------|
| P0-01 | Package builds; all targets resolve | `swift build` | Done |
| P0-02 | Models encode/decode; envelope has all fields | `ModelSerializationTests` | Done |
| P0-03 | PathErrorCode has 13 cases; PathError round-trips | `ModelSerializationTests` | Done |
| P0-04 | DeviceCapabilities, DeviceInfo, ReceiptData round-trip | `ModelSerializationTests` | Done |
| P0-05 | State machine enforces valid transitions; rejects invalid | `TransactionStateMachineTests` | Done |
| P0-06 | All valid transitions tested; all invalid transitions rejected | `TransactionStateMachineTests` | Done |
| P0-07 | All models have encode/decode round-trip | `ModelSerializationTests` | Done |
| P0-08 | JSON schemas exist and are valid | `schemas/*.json` | Done |

**Phase 0 verification:** `cd PathTerminalSDK && swift test` — 24 tests pass.

---

## Phase 1: iOS SDK + Emulator Adapter

| Ticket | What to Verify | Test Location | Status |
|--------|----------------|---------------|--------|
| P1-01 | PathTerminalAdapter protocol exists; discover/connect/send/receive/disconnect | `PathTerminalAdapter.swift` | Done |
| P1-02 | PathTerminal exposes all v0.1 methods; backed by adapter | `PathTerminalTests` | Done |
| P1-03 | PathTerminalEvent enum; AsyncStream delivery | `PathTerminalEvent.swift`, `PathTerminalTests.testDiscoverDevicesEmitsEvents` | Done |
| P1-04 | PathEmulatorAdapter discovers BLE devices; connects to Nordic UART | `BLEPathTerminalAdapter.swift` | Done |
| P1-05 | JSON serialization; envelope wrapping; chunked writes; response parsing; "OK " prefix handled | `BLEPathTerminalAdapter.sendCommand`, `processIncoming` | Done |
| P1-06 | sale() flows through adapter; state machine transitions; returns TransactionResult | `PathTerminalTests.testSaleWithMockAdapter` | Done |
| P1-07 | refund() flows through adapter; returns TransactionResult | `PathTerminalTests.testRefundWithMockAdapter` | Done |
| P1-08 | getCapabilities(), getTransactionStatus() work through adapter | `PathTerminalTests.testGetCapabilitiesWithMockAdapter` | Done |
| P1-09 | getReceiptData() returns ReceiptData (or error if unsupported) | `PathTerminal.getReceiptData` (throws unsupported from BLE adapter) | Done |
| P1-10 | Emulator: sale ACK -> wait NFC -> result (C6 fix) | Manual / emulator repo | Pending |
| P1-11 | Emulator: txn_id, card_last_four in results (C3 fix) | Manual / emulator repo | Pending |
| P1-12 | Emulator: GetCapabilities, GetDeviceInfo commands (C7 fix) | Manual / emulator repo | Pending |
| P1-13 | Emulator: accepts new envelope fields (C2 fix) | Manual / emulator repo | Pending |
| P1-14 | Integration: SDK sale through emulator (happy path) | `PathEmulatorAdapterTests` or separate integration target | Pending |
| P1-15 | Integration: SDK refund through emulator (happy path) | Same | Pending |
| P1-16 | Mock adapter for unit testing without BLE | `MockPathTerminalAdapterTests` | Done |

**Phase 1 verification (SDK only):** `cd PathTerminalSDK && swift test` — 34 tests pass.  
**Phase 1 verification (with emulator):** Run EPOS app, connect to emulator, run sale and refund manually.

---

## Phase 2: EPOS Harness Integration

| Ticket | What to Verify | Test Location | Status |
|--------|----------------|---------------|--------|
| P2-01 | EPOS project has PathTerminalSDK SPM dep; builds | Xcode build | Pending |
| P2-02 | SDKTerminalManager matches BLEUARTManager surface | Manual / UI | Pending |
| P2-03 | CardProcessingView uses SDK; sale works | Manual | Pending |
| P2-04 | RefundView/RefundCardView use SDK; refund works | Manual | Pending |
| P2-05 | SettingsView, DeviceListView use SDK; discovery/connect works | Manual | Pending |
| P2-06 | @EnvironmentObject injection; no singleton | Code review | Pending |
| P2-07 | Developer diagnostics panel shows versions, state, last error | Manual | Pending |
| P2-08 | Cash payment flow unchanged | Manual | Pending |
| P2-09 | End-to-end: EPOS sale through SDK through emulator | Manual | Pending |

**Phase 2 verification:** Build EPOS in Xcode; run on simulator/device; connect to emulator; complete sale and refund.

---

## Phase 3: Emulator Scenario Engine

| Ticket | What to Verify | Test Location | Status |
|--------|----------------|---------------|--------|
| P3-01 | Scenario JSON schema defined | `schemas/scenario.json` | Pending |
| P3-02 | Emulator scenario engine loads and runs scenarios | Emulator repo | Pending |
| P3-03 | ListScenarios, SetScenario BLE commands | Emulator repo | Pending |
| P3-04–09 | Each scenario (sale_approved, sale_declined, etc.) | Emulator + SDK contract tests | Pending |
| P3-10 | SDK contract test per scenario | `PathEmulatorAdapterTests` | Pending |
| P3-11 | Scenario selector in EPOS developer panel | Manual | Pending |

---

## Phase 4: Diagnostics

| Ticket | What to Verify | Test Location | Status |
|--------|----------------|---------------|--------|
| P4-01 | Structured logging; correlation IDs | Unit test log output | Pending |
| P4-02 | exportSupportBundle() returns doc 12 format | `PathDiagnosticsTests` | Pending |
| P4-03 | runHealthCheck() tests init, discovery, connect, etc. | `PathDiagnosticsTests` | Pending |
| P4-04 | explainLastError() returns human-readable | Unit test | Pending |
| P4-05–06 | EPOS UI: export button, health check button | Manual | Pending |

---

## Phase 5: MCP Server

| Ticket | What to Verify | Test Location | Status |
|--------|----------------|---------------|--------|
| P5-01 | MCP server starts; responds to ping | Manual | Pending |
| P5-02 | Resources: protocol, catalog, errors, capabilities | MCP client | Pending |
| P5-03–04 | Tools: list_capabilities, run_sale, etc. | MCP client | Pending |
| P5-05 | Prompts available | MCP client | Pending |
| P5-06 | MCP connects to emulator (BLE bridge/serial) | Manual | Pending |

---

## How to Use This Doc

1. After each ticket: update the Status column.
2. Before phase sign-off: run the phase verification step.
3. Before Phase 2: confirm Phase 1 SDK tests pass and (if possible) manual emulator test.
