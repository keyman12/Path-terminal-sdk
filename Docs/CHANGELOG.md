# Changelog (Path SDK repository)

## [Unreleased]

### Added
- **Repository landing & dev guide** — root `README.md`, `DEVELOPMENT.md` (three-repo layout, SPM, clones, MCP/emulator pointers).
- **CI (continuous integration)** — `.github/workflows/ci.yml`: GitHub Actions runs on push/PR to `main`; macOS job runs `xcrun swift test` in `PathTerminalSDK/`; Ubuntu job runs `npm ci`, build, and typecheck in `path-mcp-server/`.
- **Protocol v0.1 draft** — `Docs/protocol-v0.1-draft.md`; schemas `transaction.json`, `schemas/receipt.json`, `schemas/README.md`.
- **Emulator P1-14 reference** — `emulator-reference/` (Cancel + GetTransactionStatus merge snippets for **Emulator 2 Build** `ble_service.py`).
- **Emulator wire JSON mapping tests** — `EmulatorWireJsonMappingTests` (CI-friendly, no hardware).

### Changed
- `EmulatorWireJsonMapping` extracted in `PathEmulatorAdapter` for testability.
- **BLEPathTerminalAdapter** — `centralManagerDidUpdateState` no longer treats transient states (`.unknown`, `.resetting`) as a full disconnect; only `.poweredOff` / `.unauthorized` / `.unsupported` tear down the link. Service/characteristic discovery failures now fail the pending connect with a clear error instead of hanging until timeout.

### Fixed
- **GitHub Actions Swift job** — workflow now runs **`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`** before **`xcrun swift test`**. Without this, some runners resolve Swift to Command Line Tools only and tests fail immediately with **no such module 'XCTest'** (short ~20–30s red runs).
- **path-mcp-server CI (`npm run typecheck`)** — `tsc` failed with TS2589 on `registerTool` / `registerPrompt` when using Zod object input schemas (MCP SDK `ShapeOutput` + Zod inference). Schema-bearing registrations use a narrow `as any` server handle; handlers stay typed with `z.infer`.
- **BLEPathTerminalAdapter.connect(to:)** — reject a second concurrent connect (and resume the new attempt with an error) instead of overwriting `connectContinuation`, which caused **Swift TASK CONTINUATION MISUSE** and unstable links. Added cancelable 10s connect timeout via `DispatchWorkItem`. EPOS device list disables row taps while any connect is in progress.
- **BLEPathTerminalAdapter.discoverDevices()** — if already connected, return the current peripheral **without** starting a new scan. Scanning while a GATT session is active was causing disconnects ~1s after connect when the EPOS “Manage Devices” screen re-ran `startScan()` / `discoverDevices()` after `isReady` flipped true.
- **Connect-then-immediate-disconnect** on iOS when the Bluetooth stack briefly reported a non-`.poweredOn` state after a successful GATT setup.
- **`PathTerminal.discoverDevices()`** — after a scan, emit **`.connected`** when `adapter.isConnected` is still true instead of always emitting **`.idle`**, which EPOS (and similar) mapped to “not ready” and looked like an instant drop when **Manage Devices** re-scanned while the BLE link stayed up.
