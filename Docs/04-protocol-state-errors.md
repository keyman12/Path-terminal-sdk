# 04. Protocol, State, and Errors

## Envelope
Every request should include:
- requestId
- idempotencyKey
- merchantReference
- terminalSessionId
- correlationId
- sdkVersion
- adapterVersion
- timestampUtc

## Canonical transaction states
```text
created
-> pending_device
-> card_presented
-> card_read
-> authorizing
-> approved | declined | cancelled | timed_out | failed
-> reversal_pending | reversed
-> refund_pending | refunded
-> settlement_pending | settled
```

## Rules
- no hidden jumps
- every transition logged
- no silent retry for money movement
- all financial operations require idempotency

## Error taxonomy
- validation
- connectivity
- capability
- terminal_busy
- timeout
- user_cancelled
- decline
- terminal_fault
- adapter_fault
- protocol_mismatch
- recovery_required
- configuration_error
- unsupported_operation
