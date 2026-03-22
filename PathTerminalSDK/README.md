# PathTerminalSDK (Swift Package)

## Version

**0.1.1** — BLE adapter (`BLEPathTerminalAdapter`) no longer tears down the link on transient Bluetooth states (`.unknown` / `.resetting`); service discovery failures fail `connect` with a clear error. See `Docs/CHANGELOG.md` in the Path SDK repo.

## Run tests

Use Xcode’s toolchain so `XCTest` is available:

```bash
cd PathTerminalSDK
xcrun swift test
```

If `swift test` fails with `no such module 'XCTest'`, select Xcode: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

## Package products

- `PathCoreModels` — shared types and `PathTerminalAdapter`
- `PathTerminalSDK` — `PathTerminal` async API and events
- `PathEmulatorAdapter` — `BLEPathTerminalAdapter`, `MockPathTerminalAdapter`
- `PathDiagnostics` — `formatSupportBundle` helper; canonical snapshot type is `SupportBundleSnapshotV1` in `PathCoreModels`
