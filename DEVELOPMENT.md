# Path — development & repository layout

Path is split across **three GitHub repositories**. Each has a distinct role; only the **SDK** is consumed as a Swift package by the **EPOS demo app**.

## Repositories

| Repo | Role |
|------|------|
| [**Path-terminal-sdk**](https://github.com/keyman12/Path-terminal-sdk) | **Swift package** (`PathTerminalSDK`), docs, JSON schemas, MCP server (`path-mcp-server/`), `path-terminal-init/`, `emulator-reference/` snippets. |
| [**Path-epos-demo-sdk**](https://github.com/keyman12/Path-epos-demo-sdk) | **iPad EPOS demo app** (SwiftUI). Depends on **Path-terminal-sdk** via **Swift Package Manager** — no vendored SDK source. |
| [**PosEmulator**](https://github.com/keyman12/PosEmulator) | **Pico** firmware (MicroPython): BLE Nordic UART, display, NFC, JSON wire protocol. |

## Swift Package dependency (EPOS → SDK)

1. Open the EPOS `.xcodeproj` in Xcode.
2. **File → Add Package Dependencies…**
3. Enter: `https://github.com/keyman12/Path-terminal-sdk`
4. Add the **PathTerminalSDK** product (and related products as needed) to the app target.

The app talks to the terminal **only through** `PathTerminal` + `BLEPathTerminalAdapter` (or the mock adapter in tests). **No direct CoreBluetooth / Nordic UART** code is required in the app layer for the supported integration path.

Wire format (newline-delimited JSON) is implemented inside **`PathEmulatorAdapter`** and documented under `Docs/` in the SDK repo.

## Local clones (recommended)

Clone each repo **separately** (sibling folders are fine):

```text
~/src/Path-terminal-sdk/     # SDK + docs + MCP skeleton
~/src/Path-epos-demo-sdk/    # iPad app
~/src/PosEmulator/           # Pico firmware
```

Avoid maintaining **two** copies of the same app tree on disk (e.g. nested git repos pointing at the same remote); pick **one** checkout of **Path-epos-demo-sdk** as canonical for day-to-day work.

## SDK: tests and continuous integration (CI)

### Running tests on your Mac

From the **Path-terminal-sdk** clone:

```bash
cd PathTerminalSDK
xcrun swift test
```

On macOS, use Xcode’s Swift toolchain (`xcode-select`) so **`XCTest`** is available (see `PathTerminalSDK/README.md`).

### What “CI” is here

**Continuous integration (CI)** is automation that runs **after each push** (and on **pull requests**) so the **same checks** run every time, on a **fresh machine**, without relying on one developer’s laptop. In this repository, **GitHub Actions** reads `.github/workflows/ci.yml` and:

- On a **macOS** runner: selects **`/Applications/Xcode.app`** (full Xcode) before testing — the image also has Command Line Tools only, and **`swift test` needs XCTest** from the full Xcode toolchain. Then runs **`xcrun swift test`** inside **`PathTerminalSDK/`**.
- On a **Linux** runner: runs **`npm ci`**, **`npm run build`**, and **`npm run typecheck`** inside **`path-mcp-server/`** so the MCP server still builds when you change TypeScript or dependencies.

If those commands fail, the commit/PR shows a **red** check in GitHub; if they pass, **green**. That is separate from **releasing** a version tag — CI is “does this revision build and pass tests,” not “ship to partners.”

## MCP server (optional)

```bash
cd path-mcp-server
npm ci
npm run build
npm run typecheck
```

## Emulator ↔ SDK contract

Behavioural and JSON contract changes should be updated in:

- **SDK:** `Docs/`, `schemas/`, `emulator-reference/` in **Path-terminal-sdk**
- **Firmware:** **PosEmulator** repo (`CHANGELOG.md`, `ble_service.py`, etc.)

Keep these aligned when changing commands, error codes, or wire format.
