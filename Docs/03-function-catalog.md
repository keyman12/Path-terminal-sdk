# 03. Function Catalog

## Session
- initialize
- discoverDevices
- pairDevice
- connect
- disconnect
- heartbeat

## Device
- getDeviceInfo
- getCapabilities
- getStatus
- getBattery
- getFirmwareVersion

## Payments
### Phase 1
- sale
- refund
- cancelActiveTransaction
- getTransactionStatus
- getReceiptData

### Phase 2
- reversal
- void
- settlement
- getSettlementTotals
- repeatLastTransaction
- reprintLastReceipt
- recoverAfterCrash

### Phase 3
- preauthorisation
- completion
- partialRefund
- gratuity
- operatorLogin
- operatorLogout
- loyalty pass-through

## Diagnostics
- runHealthCheck
- exportSupportBundle
- explainLastError
- getRecentStateTrace
