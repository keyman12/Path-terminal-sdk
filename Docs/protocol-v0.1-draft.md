# Path Protocol — v0.1 draft

**Status:** draft (partner review)  
**Date:** 2026-03-20  
**Scope:** Phase 1 — iOS SDK, BLE emulator (Nordic UART), MCP integration assistant

## What “v0.1” includes

- **Domain models** in `PathCoreModels`: requests, results, states, errors, receipts, diagnostics snapshot.
- **Transport:** BLE Nordic UART, newline-delimited JSON (see `.cursor/rules/70-emulator-wire-protocol.mdc`).
- **Operations:** Sale, Refund, Cancel, GetTransactionStatus, GetReceipt, GetCapabilities (adapter may return hardcoded capabilities until firmware matches).
- **Explicitly out of v0.1:** Reversal, settlement, Android/Windows SDKs (see `Docs/10-delivery-plan.md` Phase 2+).

## Artifacts

| Artifact | Location |
|----------|----------|
| JSON Schemas | `schemas/` (`README.md` index) |
| State machine & errors | `Docs/04-protocol-state-errors.md` |
| BLE wire protocol | `.cursor/rules/70-emulator-wire-protocol.mdc` |
| Emulator P1-14 (Cancel, GetTransactionStatus) | `emulator-reference/README.md` |
| iOS public API | `PathTerminalSDK`, `PathEmulatorAdapter` |

## Versioning

- **Protocol document:** bump this file and list changes below.
- **Schemas:** treat additive changes as minor; breaking renames require a new major draft and SDK semver.

## Changelog (v0.1 draft)

- **2026-03-20:** Initial published draft index; `transaction.json`, `receipt.json`; emulator P1-14 reference; wire mapping tests.
