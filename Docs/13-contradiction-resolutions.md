# 13. Contradiction Resolutions

Contradictions between planning docs and current code, with decided resolutions.

## C1: State Machine Mismatch

**Doc says:** Canonical states: created -> pending_device -> card_presented -> card_read -> authorizing -> approved/declined/cancelled/timed_out/failed
**Code does:** Emulator has STATE_SPLASH/MAIN_MENU/SALES_READY with card_read_status sub-states.

**Resolution:** The SDK owns the canonical state machine. The emulator's internal display states are separate from the protocol states. The emulator adapter maps emulator events (ACK, NFC tap, result) to canonical state transitions. The emulator's display states are not exposed through the SDK.

## C2: Missing Envelope Fields

**Doc says:** Every request must include idempotencyKey, merchantReference, terminalSessionId, correlationId, sdkVersion, adapterVersion, timestampUtc.
**Code does:** Only req_id is sent.

**Resolution:** Add envelope fields incrementally. The SDK always populates the full envelope. The emulator adapter includes them in the JSON payload. The emulator must accept and ignore unknown fields gracefully (it already does since it only reads specific keys from `args`). Phase 1 adds these fields to the SDK; the emulator does not need to change for this.

## C3: Missing Result Fields (txn_id, card_last_four)

**Doc says:** Results should include transaction identifiers, terminal metadata.
**Code does:** No txn_id from emulator. EPOS generates random cardLastFour.

**Resolution:** Phase 1 emulator update (P1-11): emulator generates a UUID-based `txn_id` and a simulated `card_last_four` (e.g. "0000" or derived from NFC UID last 4 hex digits). The SDK adapter maps these into the canonical TransactionResult. Until the emulator is updated, the adapter should handle missing fields gracefully with sensible defaults.

## C4: No Scenario Engine

**Doc says:** Named scenario files (sale_approved.json, sale_declined.json, etc.).
**Code does:** Hardcoded behavior in ble_service.py.

**Resolution:** Deferred to Phase 3 (P3-01 through P3-11). Phase 1 works with the current hardcoded happy path. The scenario engine is additive and does not block SDK development.

## C5: "Order Champ" vs "PathEPOSDemo" Naming

**Doc says:** "Order Champ integration."
**Code does:** App is PathEPOSDemoIOS, branded "Path Cafe."

**Resolution:** Use current name "PathEPOSDemo" / "Path Cafe" in all new code and docs. "Order Champ" was a working title. Update doc references to say "EPOS demo app" or "PathEPOSDemo." No code change needed.

## C6: Sale Result Sent Before NFC Tap

**Doc says:** Canonical flow is: command received -> card_presented -> card_read -> authorizing -> result.
**Code does:** Emulator sends success result immediately on receiving the Sale command. NFC card_read is a separate, unrelated event.

**Resolution:** Fix in Phase 1 (P1-10). The emulator must:
1. Receive Sale command
2. Send ACK
3. Wait for NFC tap (or timeout after 30s)
4. Send result (approved/declined) after card interaction

This is a critical fix because it affects the entire state machine and event ordering. The SDK's state machine expects transitions in the canonical order. Until fixed, the emulator adapter should treat the immediate result as the final outcome and skip card-related states.

## C7: Missing Device Commands (GetCapabilities, GetDeviceInfo, GetStatus)

**Doc says:** Phase 1 requires getCapabilities, getDeviceInfo.
**Code does:** Emulator returns "Unknown command" for these.

**Resolution:** Add in Phase 1 (P1-12). These are simple commands that return hardcoded JSON from the emulator:
- `GetCapabilities`: `{"commands":["Sale","Refund","Login","Logout"],"nfc":true,"display":true}`
- `GetDeviceInfo`: `{"model":"Path POS Emulator","firmware":"1.0.0","serial":"<unique>","protocol_version":"0.1"}`
- `GetStatus`: `{"state":"ready"|"busy","battery":100,"ble_connected":true}`

## C8: "OK " Prefix on BLE Messages

**Code does:** Emulator may prefix responses with "OK " before JSON.
**Docs:** Not documented anywhere in protocol docs.

**Resolution:** Remove from emulator in Phase 1 (cleanup). The SDK adapter should handle the prefix for backward compatibility with older emulator firmware, but new emulator code should not send it. This is a protocol normalization, not a breaking change.

## C9: No Support Bundle

**Doc says:** Support bundle with manifest.json, versions.json, recent-logs.ndjson, state-trace.json, etc.
**Code does:** Nothing exists.

**Resolution:** Deferred to Phase 4 (P4-01 through P4-06). This is purely additive and does not block Phases 0-2.
