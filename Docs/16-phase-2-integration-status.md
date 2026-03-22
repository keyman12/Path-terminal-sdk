# Phase 2: EPOS Harness Integration – Status

## Completed

### 1. TerminalConnectionManager Protocol
- **File:** `PathEPOSDemoIOS/PathEPOSDemo/PathEPOSDemo/TerminalConnectionManager.swift`
- Defines `TerminalConnectionState`, `TerminalDeviceItem`, and the protocol surface
- Matches BLEUARTManager public API for drop-in replacement

### 2. BLEUARTManager Conformance
- BLEUARTManager now conforms to `TerminalConnectionManager`
- Uses `TerminalDeviceItem` and `TerminalConnectionState` (`.discovering` removed from UI)
- Added `lastError`, `sdkVersion`, `protocolVersion` for diagnostics

### 3. SDKTerminalManager
- **File:** `PathEPOSDemoIOS/PathEPOSDemo/PathEPOSDemo/SDKTerminalManager.swift`
- Backed by `PathTerminal` + `BLEPathTerminalAdapter`
- Bridges async SDK to ObservableObject surface
- Persists transaction log, maintains logs for diagnostics

### 4. PathTerminalSDK Package Dependency
- Added local package reference: `../../Path SDK/PathTerminalSDK`
- Products: PathTerminalSDK, PathEmulatorAdapter, PathCoreModels

## Remaining Work

### 5. EnvironmentObject Injection
- **Done** in current EPOS tree: `AppTerminalManager` is injected at the app root; views use `@EnvironmentObject`.

### 6. Developer Diagnostics Panel
- **Done:** Settings → Developer → Diagnostics (versions, connection, logs). **Support bundle:** “Copy support bundle (JSON)” builds a redacted `SupportBundleSnapshotV1` (PathCoreModels) for both `path_sdk` and `native_ble` integrations.

### 7. Cancel
- **SDK repo:** BLE `Cancel` command + `PathTerminal.cancelActiveTransaction()`. **EPOS SDK line:** `SDKTerminalManager.cancelCurrentOperation()` cancels local tasks and calls `terminal.cancelActiveTransaction()`.

### 8. Bluetooth state (SDK path)
- **Done:** `BLEPathTerminalAdapter` exposes `isBluetoothPoweredOn` and `onBluetoothStateChange`; `SDKTerminalManager` updates UI state when Bluetooth is toggled.

### 9. Preserve Non-SDK Build
- **Option A:** Two schemes – "PathEPOSDemo" (uses BLE), "PathEPOSDemo SDK" (uses SDK) with `USE_PATH_SDK` flag
- **Option B:** Runtime toggle in Settings to switch manager
- **Rollback:** Remove package dependency, delete SDKTerminalManager.swift, revert views to BLEUARTManager.shared

## Package Path

The SDK path is `../../Path SDK/PathTerminalSDK` relative to the project. If the EPOS project is opened from a different location, update the path in Xcode:
**File → Packages → PathTerminalSDK → Edit Package Location**

## Testing

1. Open `PathEPOSDemo 2.xcodeproj` in Xcode
2. Resolve packages (File → Packages → Resolve Package Versions)
3. Build (Cmd+B)
4. Run on device/simulator
5. Connect to emulator, run sale and refund
