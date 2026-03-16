# Phase 2: Test Plan and Expected Results

## Prerequisites

- Xcode 15+ with iOS 18.5 SDK
- Path EPOS Demo project at `PathEPOSDemoIOS/PathEPOSDemo/PathEPOSDemo 2.xcodeproj`
- Path SDK at `Path SDK/PathTerminalSDK` (sibling to PathEPOSDemoIOS)
- Emulator on Pico 2 W (optional, for end-to-end)

---

## Test 1: Build Succeeds

**Steps:**
1. Open `PathEPOSDemo 2.xcodeproj` in Xcode
2. File → Packages → Resolve Package Versions
3. Product → Build (Cmd+B)

**Expected:**
- Package resolves without error
- Build completes successfully
- No compiler errors

**If package path fails:** Edit package location to point to `Path SDK/PathTerminalSDK` (relative to project or absolute)

---

## Test 2: Unit Tests Pass

**Steps:**
1. In Xcode, select the PathEPOSDemo scheme
2. Product → Test (Cmd+U)

**Expected:**
- All tests pass (see unit tests below)
- No crashes

---

## Test 3: App Launches (BLE Path)

**Steps:**
1. Run on simulator or device (Cmd+R)
2. Wait for splash, then main EPOS screen appears

**Expected:**
- App launches
- Cart/Inventory UI visible
- Settings gear icon in cart area
- No crash on launch

---

## Test 4: Settings and Device List (BLE)

**Steps:**
1. Tap Settings (gear icon)
2. Tap "Manage Devices"
3. Observe device list

**Expected:**
- Settings shows "Bluetooth Terminal" section
- "Not connected" or "Connected" shown
- Manage Devices shows list (empty if no BLE devices nearby)
- If emulator is advertising: "Path POS Emulator" appears
- Tap Scan: list updates

---

## Test 5: Connect to Emulator (BLE)

**Steps:**
1. Ensure emulator is on and advertising
2. Settings → Manage Devices → Tap "Path POS Emulator"
3. Wait for connection

**Expected:**
- "Connecting…" appears
- After ~2–5 s: "Connected" with green dot
- Settings shows "Connected" with Disconnect button

---

## Test 6: Sale Flow (BLE)

**Steps:**
1. Add item to cart (e.g. Cookie €1.99)
2. Tap "Complete Transaction"
3. Select "Card"
4. Tap "Continue"
5. On emulator: tap SCROLL or present NFC card
6. Wait for result

**Expected:**
- Card Processing sheet: "ACK received. Insert or tap card…"
- Log shows: Message split, Sale JSON, ACK, card_read, result
- "✓ Result received: approved"
- Complete button appears
- Tap Complete → returns to cart (empty)
- Transaction Log shows new sale with Success

---

## Test 7: Refund Flow (BLE)

**Steps:**
1. Settings → Transaction Log
2. Tap "Refund" on a card sale
3. Tap "Continue" (card refund)
4. On emulator: tap SCROLL or present NFC card
5. Wait for result

**Expected:**
- Refund sheet: "ACK received. Refund in progress…"
- "✓ Result received: approved"
- Complete button appears
- Tap Complete → refund complete
- Original sale marked as refunded in log

---

## Test 8: Timeout Flow (BLE)

**Steps:**
1. Start a Sale (card)
2. Do NOT tap card on emulator
3. Wait 26–30 seconds

**Expected:**
- After ~26 s: "Result received: timed_out"
- Complete button appears
- Transaction Log shows "Timed Out" (orange)
- No flash of "Timeout waiting for terminal" dialog

---

## Test 9: Cash Flow Unchanged

**Steps:**
1. Add item to cart
2. Complete Transaction → Cash
3. Enter amount, tap Complete

**Expected:**
- Cash payment completes
- Transaction Log shows sale with "Cash" (no card)
- Refund on cash sale: Cash refund path works

---

## Test 10: Protocol Conformance (Unit)

**Purpose:** Verify BLEUARTManager and SDKTerminalManager conform to TerminalConnectionManager.

**Expected (from unit tests):**
- `BLEUARTManager.shared` can be assigned to `TerminalConnectionManager`
- `SDKTerminalManager()` can be assigned to `TerminalConnectionManager`
- Both expose required properties (state, isReady, devices, etc.)

---

## Test 11: SDK Path (Optional)

**To run the app with SDKTerminalManager instead of direct BLE:**

1. Duplicate the PathEPOSDemo scheme (Product → Scheme → Manage Schemes → Duplicate)
2. Rename to "PathEPOSDemo (SDK)"
3. Edit the scheme → Build → select the PathEPOSDemo target → Build Options
4. Add `USE_SDK_TERMINAL` to **Active Compilation Conditions** (SWIFT_ACTIVE_COMPILATION_CONDITIONS)
5. Build and run with the new scheme

**Expected:**
- App uses PathTerminalSDK via BLEPathTerminalAdapter instead of direct Nordic UART
- Developer Diagnostics shows SDK version "0.1.0"
- Sale/refund flows work the same (requires BLE adapter)

---

## Rollback Test

**If you need to revert to pre–Phase 2:**

1. Remove package: File → Packages → Remove "PathTerminalSDK"
2. Delete `SDKTerminalManager.swift`
3. Revert `TerminalConnectionManager.swift` (or remove if BLEUARTManager was reverted)
4. Revert `BLEUARTManager.swift` (DeviceItem, ConnectionState)
5. Revert views that reference `TerminalDeviceItem` (if any)

**Expected:** App builds and runs with direct BLE only.
