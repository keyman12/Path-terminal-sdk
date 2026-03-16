# Architecture: Three Parts + Second EPOS App

## Confirmed plan

### 1. Standalone app (direct BLE)

- **What:** The Path EPOS Demo app **with its own built-in BLE code** that talks directly to the emulator (Nordic UART). No SDK.
- **Why:** Represents a **customer’s own app** that works with other providers and needs to stay in sync with the emulator as you add features.
- **How:** Run the app with the **default scheme** (no compile flag). The app uses `BLEUARTManager` and direct BLE. As you extend the emulator, you update this app’s BLE logic so it stays in sync.

### 2. Standalone SDK

- **What:** **PathTerminalSDK** as a **standalone package** (sold to other entities) with a clear, documented interface. Their EPOS systems integrate the SDK and talk to the emulator (or future terminals) through it.
- **Where:** `Path SDK/PathTerminalSDK/` (Swift package).
- **Docs:** Interface and integration instructions live in the SDK repo/docs so integrators know how to connect, discover, sale, refund, etc.

### 3. Same EPOS app, but using the SDK (integration test)

- **What:** The **same** Path EPOS Demo app, but with connectivity **pointed at the SDK** instead of its own BLE. Used to test and demonstrate SDK integration.
- **How:** Run with a **second scheme** that sets the compile flag `USE_SDK_TERMINAL`. The app then uses `SDKTerminalManager` (PathTerminalSDK) instead of `BLEUARTManager`. One codebase, two ways to run (direct BLE vs SDK).

### 4. Second EPOS app (SDK only)

- **What:** A **separate, second app** that is built **only** with the SDK. No direct BLE code. Shows how a customer would build an EPOS that talks to the emulator purely via the SDK.
- **Why:** Reference integration: “here’s an app that uses only your SDK.” Keeps the main demo app as the “standalone + sync with emulator” story and this one as the “SDK customer” story.

---

## Summary

| Piece | Role |
|-------|------|
| **Path EPOS Demo (default)** | Standalone app, own BLE, stays in sync with emulator; for “customer app with other providers”. |
| **Path EPOS Demo (SDK scheme)** | Same app, connectivity via SDK; for testing “EPOS integrated with SDK”. |
| **PathTerminalSDK** | Standalone SDK + interface docs; sold to others to integrate into their EPOS. |
| **Second EPOS app (SDK-only)** | Separate app, SDK only; reference for “how to build with the SDK”. |

---

## How to run each

- **Standalone (direct BLE):** Open Path EPOS Demo project → run **PathEPOSDemo** scheme (no flag).
- **Same app via SDK:** Same project → run a scheme that has **USE_SDK_TERMINAL** in Active Compilation Conditions (e.g. duplicate scheme and add the flag).
- **Second app (SDK only):** Open the **PathEPOSSDKClient** project (or target) and run that app; it has no BLE code and uses only the SDK.

The second app is created next so you have a concrete “EPOS app with the SDK only” to run and ship as reference.
