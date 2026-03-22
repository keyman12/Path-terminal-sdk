# Starter Backlog

## Protocol foundation
- [x] Define transaction schema (`schemas/transaction.json`)
- [x] Define receipt schema (`schemas/receipt.json`)
- [x] Define capability schema (`schemas/capabilities.json`)
- [x] Define error schema (`schemas/error.json`)
- [x] Publish protocol v0.1 draft (`Docs/protocol-v0.1-draft.md`)

## iOS SDK
- [x] Create Swift package skeleton
- [x] Add initialize/discover/connect
- [x] Add sale
- [x] Add refund
- [x] Add status (`getTransactionStatus` — firmware P1-14 or `unsupportedOperation`)
- [x] Add receipt data
- [x] Support bundle export (`SupportBundleSnapshotV1`; EPOS Diagnostics)
- [x] cancelActiveTransaction (SDK + EPOS; firmware P1-14)

## Emulator
- [ ] Add scenario engine
- [x] Refund support (wire + SDK; emulator behaviour per P1-10+ guides)
- [ ] Add decline and timeout scenarios
- [ ] Add disconnect / recovery scenarios
- [ ] Add structured logs
- [x] P1-14 reference handlers (`emulator-reference/` — merge into Pico `ble_service.py`)

## Order Champ / EPOS
- [ ] Replace simulated payment flow with SDK flow (where still simulated)
- [x] Developer diagnostics panel + support bundle copy
- [ ] Add emulator scenario selector (optional)

## MCP
- [x] Resources for docs / examples / API reference (`path-mcp-server/`)
- [ ] `list_scenarios` (when emulator scenario engine exists)
- [ ] `run_sale` / `run_refund` against live emulator API (if/when exposed)
- [ ] `inspect_log_bundle` (align with support bundle format)
- [ ] Publish `path-terminal-init` to npm when feature set stabilises
