# Bluetooth terminal – detailed steps to try it out

End-to-end steps to run the Path EPOS Demo on iPad with the Bluetooth emulator (direct BLE path).

---

## 1. Prerequisites

- **Xcode** 15+ with iOS 18.5 SDK  
- **Path EPOS Demo** at `PathEPOSDemoIOS/PathEPOSDemo/PathEPOSDemo 2.xcodeproj`  
- **Path SDK** at `Path SDK/PathTerminalSDK` (used as package; path must resolve from the project)  
- **Emulator**: Raspberry Pi Pico 2 W with MicroPython, running the emulator code from `Emulator Build/Emulator 2 Build/` (see [15-emulator-p1-10-to-p1-13-guide.md](15-emulator-p1-10-to-p1-13-guide.md) for emulator setup)

---

## 2. Build and run the app

1. Open **PathEPOSDemo 2.xcodeproj** in Xcode.  
2. **File → Packages → Resolve Package Versions** (so PathTerminalSDK resolves).  
3. Select the **PathEPOSDemo** scheme.  
4. Choose an **iPad** simulator or a physical **iPad** as the run destination.  
5. **Product → Run** (or Cmd+R).  
6. Wait for the splash screen, then the main EPOS screen (inventory + cart) appears.

---

## 3. Connect to the emulator (BLE)

1. On the EPOS screen, tap the **Settings** (gear) icon in the cart area.  
2. Under **Bluetooth Terminal**, tap **Manage Devices**.  
3. Ensure the **Pico 2 W emulator is on** and running the emulator firmware (advertising as **Path POS Emulator** or similar).  
4. If the list is empty, tap **Scan** and wait a few seconds.  
5. When **Path POS Emulator** (or your emulator name) appears, **tap it**.  
6. Wait for **Connecting…** then **Connected** (green dot).  
7. Tap **Close** or back to return to Settings; you should see **Connected** and a **Disconnect** option.

You’re now using the “new Bluetooth thing” – the app is talking to the terminal over BLE (Nordic UART service).

---

## 4. Run a card sale

1. From the main EPOS screen, add an item to the cart (e.g. Cookie €1.99).  
2. Tap **Complete Transaction**.  
3. Choose **Card**, then tap **Continue**.  
4. The **Card Processing** sheet appears. You should see **ACK received. Insert or tap card…**.  
5. On the **emulator**: tap **SCROLL** (or present NFC card if wired).  
6. Wait for the emulator to complete; the app should show **✓ Result received: approved** and a **Complete** button.  
7. Tap **Complete**. You return to the cart (empty) and the sale is in the transaction log.

---

## 5. Check the transaction log

1. Tap **Settings** (gear).  
2. Under **Transactions**, tap **Transaction Log**.  
3. Confirm the sale appears with **Success** (and card last four if the emulator sends it).

---

## 6. Run a refund (optional)

1. In **Settings → Transaction Log**, find the card sale you just did.  
2. Tap **Refund** on that row.  
3. On the refund screen, tap **Continue** (card refund).  
4. On the **emulator**: tap **SCROLL** (or present NFC) again.  
5. When the result appears, tap **Complete**.  
6. Back in the log, the original sale should show as refunded and a refund entry should appear.

---

## 7. Use Developer Diagnostics (logs, copy, clear)

1. **Settings → Developer → Diagnostics**.  
2. Check **Versions** (Protocol 0.1; SDK shows — for direct BLE).  
3. Check **Connection** (e.g. Ready, Bluetooth On).  
4. In **Logs**:  
   - **Tap and drag** in the log text to select; use the **system menu** (Select / Copy).  
   - **Copy all** copies the full log (with timestamps) to the clipboard (e.g. for email).  
   - **Clear logs** clears the log after a double confirmation.  
5. Logs older than 7 days are pruned automatically; you can clear manually anytime.

---

## 8. Optional: try the SDK path instead of direct BLE

To run the same app using **PathTerminalSDK** (and BLEPathTerminalAdapter) instead of direct Nordic UART:

1. **Product → Scheme → Manage Schemes**.  
2. **Duplicate** the PathEPOSDemo scheme and rename to **PathEPOSDemo (SDK)**.  
3. **Edit** the new scheme → **Build** → select the PathEPOSDemo target.  
4. Under **Build Options** (or **Swift Compiler - Custom Flags**), add **Active Compilation Condition**: `USE_SDK_TERMINAL`.  
5. Build and run with **PathEPOSDemo (SDK)**.  
6. In **Settings → Developer → Diagnostics**, **SDK** should show **0.1.0** instead of —.  
7. Sale/refund flows are the same; only the stack (SDK vs direct BLE) changes.

---

## 9. Cash flow (no terminal)

1. Add an item, tap **Complete Transaction**, choose **Cash**.  
2. Enter amount received; **Complete Transaction** stays fixed at the bottom.  
3. Tap **Complete Transaction**; the sale is recorded as cash in the Transaction Log.

---

## Troubleshooting

- **Emulator not in list:** Ensure it’s powered, running the emulator code, and advertising. Tap **Scan** and hold the iPad near the Pico.  
- **Connecting hangs:** Restart the emulator and try again; ensure only one central is connecting (no other app using the same service).  
- **Sale times out:** On the emulator, tap SCROLL (or present NFC) within ~26 seconds so the result is sent before the app’s 30s timeout.  
- **Package not found:** In Xcode, **File → Packages** and set PathTerminalSDK to the correct path (`Path SDK/PathTerminalSDK` relative to the project or absolute).

For the full test plan and expected results, see [17-phase-2-test-plan.md](17-phase-2-test-plan.md).
