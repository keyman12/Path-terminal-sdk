# 15. Emulator P1-10 to P1-13 Implementation Guide

Step-by-step instructions for implementing the four emulator fixes in `Emulator Build/Emulator 2 Build/`.

---

## BLE Outgoing Chunking (Critical Fix)

**Symptom:** iPad receives ACK, user taps card on emulator, emulator completes, but iPad times out after 30s. The result message never reaches the app.

**Cause:** BLE MTU is typically 20–23 bytes. The emulator was sending the full result (100+ bytes) in one `gatts_notify`, which gets truncated. The iPad receives incomplete data and never sees a complete newline-delimited message.

**Fix:** Chunk outgoing data in `_send_json` at 20 bytes per chunk, with ~20ms delay between chunks (matching the EPOS app’s outgoing chunking). This fix has been applied to `ble_service.py`.

---

## Prerequisites

- Raspberry Pi Pico 2 W with MicroPython
- Thonny IDE (or another way to edit and run `.py` files on the Pico)
- Emulator 2 Build files uploaded to the Pico
- NFC hardware connected (for P1-10 sale flow; optional for testing without card)

---

## P1-10: Fix Sale Flow Ordering (ACK → Wait NFC → Result)

**Current behaviour:** Sale result is sent immediately when the command is received, before any NFC tap.

**Target behaviour:** ACK → show "Tap or Insert Card" → wait for NFC tap (or 30s timeout) → send result.

### Step 1: Add pending result storage to `ble_service.py`

In `BLEService.__init__`, add:

```python
# Pending sale/refund result - sent when NFC completes (or timeout)
self.pending_result = None  # None or {"req_id": str, "cmd": str, "result_data": dict}
```

### Step 2: Change `_process_sale_json` to defer the result

Replace the current `_process_sale_json` body. Instead of calling `_send_result` immediately, store the pending result and return. The main loop will send it when NFC completes.

**Before (lines 298–335):**
```python
def _process_sale_json(self, req_id, args):
    ...
    # Send success result
    result_data = {...}
    self._send_result(req_id, "Sale", "success", result_data)
```

**After:**
```python
def _process_sale_json(self, req_id, args):
    try:
        amount_minor = args.get("amount", 0)
        currency = args.get("currency", "GBP")
        tip_minor = args.get("tip")
        ...
        if self.emulator.state == 2:
            self.emulator.current_transaction = {...}
            self.emulator.tap_progress = 1
            self.emulator.draw_sales_ready_screen()

        # DO NOT send result here - wait for NFC
        result_data = {
            "amount": amount_minor,
            "currency": currency,
            "status": "approved"
        }
        if tip_minor:
            result_data["tip"] = tip_minor

        self.pending_result = {
            "req_id": req_id,
            "cmd": "Sale",
            "result_data": result_data,
            "status": "success"
        }
    except Exception as e:
        self._send_result(req_id, "Sale", "error", {"error": str(e)})
```

### Step 3: Add `send_pending_result` to `ble_service.py`

```python
def send_pending_result(self, approved=True):
    """Send pending sale/refund result. Called from main loop when NFC completes or times out."""
    if self.pending_result is None:
        return
    pr = self.pending_result
    self.pending_result = None
    if not approved:
        pr["result_data"] = {**pr["result_data"], "status": "declined"}
        pr["status"] = "error"
        pr["result_data"]["error"] = "Timeout or cancelled"
    self._send_result(pr["req_id"], pr["cmd"], pr["status"], pr["result_data"])
```

### Step 4: Call `send_pending_result` from `PathEmulator.read_nfc_card`

In `PathEmulator.py`, in `read_nfc_card()`:

- **On success** (after sending `card_read`, before clearing `current_transaction`): call `self.ble_service.send_pending_result(approved=True)`.
- **On timeout/error** (in the `else` branch and `except`): call `self.ble_service.send_pending_result(approved=False)`.

Insert before clearing the transaction (around line 842):

```python
# Before: self.current_transaction = None
if self.ble_service:
    self.ble_service.send_pending_result(approved=True)
self.current_transaction = None
```

And in the error/timeout branches (around lines 854, 867):

```python
if self.ble_service:
    self.ble_service.send_pending_result(approved=False)
```

### Step 5: Add 30s timeout for Sale when no NFC

The main loop already calls `check_nfc_auto_read()` every 300ms. You need a timeout: if no card is read within 30 seconds, send a declined result.

In `ble_service.__init__`, add:

```python
self.pending_result_time = None  # time.ticks_ms() when pending_result was set
```

In `ble_service._process_sale_json`, when setting `pending_result`, also set:

```python
import time
self.pending_result_time = time.ticks_ms()
```

In `PathEmulator.py`, in the main loop inside the `STATE_SALES_READY` block (after `check_nfc_auto_read()`), add:

```python
# Timeout: if pending result and no NFC within 30s, send declined
if self.ble_service and self.ble_service.pending_result and self.ble_service.pending_result_time:
    if time.ticks_diff(time.ticks_ms(), self.ble_service.pending_result_time) > 30000:
        self.ble_service.send_pending_result(approved=False)
        self.ble_service.pending_result_time = None
        self.current_transaction = None
        self.draw_sales_ready_screen()
```

### Step 6: Apply the same pattern to Refund

In `_process_refund_json`, store a pending result instead of calling `_send_result` immediately. Reuse the same `pending_result` and `send_pending_result` flow. Refund also waits for NFC (or timeout) before sending the result.

---

## P1-11: Add `txn_id` and `card_last_four` to Results

**Current behaviour:** Results have no `txn_id` or `card_last_four`.

**Target behaviour:** Every Sale/Refund result includes `txn_id` (UUID-like) and `card_last_four` (from NFC UID or simulated).

### Step 1: Generate `txn_id` in `ble_service.py`

MicroPython does not have `uuid`, so use a simple unique ID:

```python
import urandom
def _generate_txn_id(self):
    h = ''.join(['%02x' % urandom.getrandbits(8) for _ in range(8)])
    return h[:8] + '-' + h[8:12] + '-' + h[12:16] + '-' + h[16:20] + '-' + h[20:]
```

Or simpler: `return '%08x-%04x-%04x-%04x-%08x' % tuple(urandom.getrandbits(16) for _ in range(5))`.

### Step 2: Add `txn_id` and `card_last_four` to result data

When building `result_data` in `_process_sale_json` and `_process_refund_json`, add:

```python
result_data["txn_id"] = self._generate_txn_id()
result_data["card_last_four"] = "0000"  # Will be overwritten when NFC completes
```

### Step 3: Update `card_last_four` when NFC completes

In `PathEmulator.read_nfc_card`, when you have `card_data`:

```python
uid_hex = card_data.get('uid_hex', '00000000')
# Last 4 hex digits (e.g. "57A4C906" -> "C906" or last 4 chars)
card_last_four = uid_hex[-4:] if len(uid_hex) >= 4 else "0000"
```

Before calling `send_pending_result(approved=True)`, update the pending result:

```python
if self.ble_service.pending_result and self.last_card_data:
    uid_hex = self.last_card_data.get('uid_hex', '00000000')
    card_last_four = uid_hex[-4:] if len(uid_hex) >= 4 else "0000"
    self.ble_service.pending_result["result_data"]["card_last_four"] = card_last_four
```

---

## P1-12: Add GetCapabilities and GetDeviceInfo Commands

**Current behaviour:** These commands return "Unknown command".

**Target behaviour:** Return hardcoded JSON per `Docs/13-contradiction-resolutions.md`.

### Step 1: Add handlers in `_process_json_message`

In `ble_service.py`, in `_process_json_message`, extend the `if cmd == ...` chain:

```python
elif cmd == "GetCapabilities":
    self._process_get_capabilities(req_id)
elif cmd == "GetDeviceInfo":
    self._process_get_device_info(req_id)
elif cmd == "GetStatus":
    self._process_get_status(req_id)
```

### Step 2: Implement the handlers

```python
def _process_get_capabilities(self, req_id):
    data = {
        "commands": ["Sale", "Refund", "Login", "Logout"],
        "nfc": True,
        "display": True
    }
    self._send_result(req_id, "GetCapabilities", "success", data)

def _process_get_device_info(self, req_id):
    import urandom
    data = {
        "model": "Path POS Emulator",
        "firmware": "1.0.0",
        "serial": "EMU-%08x" % urandom.getrandbits(32),
        "protocol_version": "0.1"
    }
    self._send_result(req_id, "GetDeviceInfo", "success", data)

def _process_get_status(self, req_id):
    data = {
        "state": "busy" if self.pending_result else "ready",
        "battery": 100,
        "ble_connected": self.connected
    }
    self._send_result(req_id, "GetStatus", "success", data)
```

Use `import urandom` at the top if needed for the serial.

---

## P1-13: Accept New Envelope Fields

**Current behaviour:** The emulator only uses `cmd`, `req_id`, and `args` from the JSON. Extra fields are ignored.

**Target behaviour:** Same; no change required. `ujson.loads` and `msg.get()` already ignore unknown keys. The SDK can send `idempotencyKey`, `merchantReference`, `correlationId`, etc.; the emulator will not use them and will not error.

**Verification:** Send a Sale request that includes extra top-level fields. The emulator should still process the sale and return a result.

---

## C8: Remove "OK " Prefix (Optional Cleanup)

**Current behaviour:** The emulator does not add "OK " in `_send_json`. The "OK " handling is in the receive path (`_handle_rx_data`). So there is nothing to remove on the emulator side. The SDK adapter already handles the prefix for backward compatibility.

**Action:** None required for the emulator.

---

## Testing Checklist

### P1-10

1. Connect EPOS (or SDK test app) to the emulator.
2. Start a Sale. Confirm you see "Tap or Insert Card" on the emulator.
3. Tap an NFC card. Confirm the result is sent only after the card is read.
4. Start a Sale and do not tap a card. After 30 seconds, confirm a declined result is sent.

### P1-11

1. Complete a Sale with NFC. Inspect the result JSON for `txn_id` and `card_last_four`.
2. Confirm `card_last_four` matches the last 4 hex digits of the card UID.

### P1-12

1. Send `{"req_id":"...","args":{},"cmd":"GetCapabilities"}`. Confirm a success result with `commands`, `nfc`, `display`.
2. Send `{"req_id":"...","args":{},"cmd":"GetDeviceInfo"}`. Confirm a success result with `model`, `firmware`, `serial`, `protocol_version`.
3. Send `{"req_id":"...","args":{},"cmd":"GetStatus"}`. Confirm a success result with `state`, `battery`, `ble_connected`.

### P1-13

1. Send a Sale with extra fields, e.g. `{"req_id":"...","idempotencyKey":"test","merchantReference":"M1","args":{...},"cmd":"Sale"}`.
2. Confirm the sale still completes successfully.

---

## File Summary

| File | Changes |
|------|---------|
| `ble_service.py` | `pending_result`, `send_pending_result`, defer result in `_process_sale_json`/`_process_refund_json`, add `GetCapabilities`/`GetDeviceInfo`/`GetStatus`, add `txn_id`/`card_last_four` to results |
| `PathEmulator.py` | Call `send_pending_result` from `read_nfc_card`, add 30s timeout in main loop, pass `card_last_four` from NFC UID |

---

## Deployment

1. Edit the files on your machine.
2. Use Thonny to connect to the Pico and upload the modified `ble_service.py` and `PathEmulator.py`.
3. Restart the Pico (or run `PathEmulator.py` again).
4. Run through the testing checklist above.
