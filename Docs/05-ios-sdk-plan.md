# 05. iOS SDK Plan

## Packaging
Use Swift Package Manager.

Suggested modules:
- PathTerminalSDK
- PathCoreModels
- PathEmulatorAdapter
- PathDiagnostics

## Public API v0.1
- initialize
- discoverDevices
- connect
- disconnect
- sale
- refund
- cancelActiveTransaction
- getTransactionStatus
- getReceiptData
- getCapabilities
- exportSupportBundle

## Event model
Expose async/await APIs plus typed event stream for:
- device updates
- transaction state changes
- prompts
- errors
- receipt readiness

## Order Champ integration
1. Replace simulated card flow with SDK-backed sale/refund
2. Add developer diagnostics panel
3. Add emulator scenario selector
4. Add support bundle export button
