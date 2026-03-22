# Path POS Emulator — reference snippets (P1-14)

Path integration work targets **Emulator 2 Build** only — the firmware you flash is  
`Emulator Build/Emulator 2 Build/ble_service.py` (P1-14 lives there).  
Other trees (e.g. Version 1 PICO) are out of scope unless you explicitly port changes.

This folder holds an **optional copy-paste reference** if you need a standalone snippet; prefer editing the file above directly.

## Merge steps

1. Open `ble_service.py` on the Pico.
2. In `_process_json_message` (or equivalent), add branches for `Cancel` and `GetTransactionStatus` that call the handlers in `ble_service_p1_14_handlers.py`.
3. Ensure your class keeps:
   - `pending_result` — dict when a Sale/Refund is waiting for NFC (P1-10).
   - `last_result_by_req_id` — optional dict to answer status after completion (see snippet).
4. Upload to the device and run the checks in `Docs/15-…` P1-14 checklist.

## Testing

- **Hardware:** Send JSON lines over Nordic UART as in the wire protocol doc.
- **CI (SDK repo):** `EmulatorWireJsonMappingTests` validate JSON → `TransactionResult` mapping without hardware.
