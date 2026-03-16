# BLE scan filter (emulator discovery)

## How filtering works

The SDK’s **BLEPathTerminalAdapter** scans for BLE devices with **no service filter** (`withServices: nil`), so all nearby peripherals are seen by Core Bluetooth.

From those, only devices that pass a **name check** are added to the discovery list and shown in the app:

- Advertised name is exactly **"Path POS Emulator"**, or  
- Advertised name **contains** the substring **"Path"** (case-sensitive).

So the list only shows devices that look like Path emulators or terminals. Other BLE devices (headphones, beacons, etc.) are ignored.

## Will another emulator be recognised?

Yes, if its **BLE advertised name** matches the filter:

- **Same name:** If you build a second emulator and give it the same local name `"Path POS Emulator"`, it will appear (you may see two entries with the same name, distinguished by UUID).
- **Name contains "Path":** If you use a different name that still contains `"Path"` (e.g. `"Path POS Emulator 2"`, `"Path Terminal"`, `"My Path Device"`), it will also appear.
- **Different name without "Path":** If the name is something like `"My Emulator"` or `"POS Device"`, it will **not** appear unless you change the filter (see below).

## Customising the filter

The adapter’s initialiser accepts an optional **device name filter** so you can change which devices are discovered:

- **Default:** No filter parameter → behaviour above (exact `"Path POS Emulator"` or name contains `"Path"`).
- **Show all BLE devices:** Pass `deviceNameFilter: { _ in true }` so any discovered peripheral is listed (useful for debugging).
- **Custom rule:** Pass a closure, e.g. `deviceNameFilter: { $0.hasPrefix("Path-") }` or `{ $0 == "My Custom Emulator" }`.

Example (show all devices):

```swift
let adapter = BLEPathTerminalAdapter(
    sdkVersion: "0.1.0",
    adapterVersion: "0.1.0",
    deviceNameFilter: { _ in true }
)
```

Example (only “Path POS Emulator” and “Path POS Emulator 2”):

```swift
let adapter = BLEPathTerminalAdapter(
    sdkVersion: "0.1.0",
    adapterVersion: "0.1.0",
    deviceNameFilter: { name in
        name == "Path POS Emulator" || name == "Path POS Emulator 2"
    }
)
```

## Optional: filter by service UUID

To only list devices that advertise the **Nordic UART** service (and ignore everything else), you would need to change the scan to use `withServices: [serviceUUID]` instead of `nil`. That would show any compatible Nordic UART device regardless of name. The current implementation does not do that; it discovers all BLE devices and then filters by name.
