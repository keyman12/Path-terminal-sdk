# 09. AI Boundaries and Best Practice

## Rules
- protocol-first
- no breaking public changes without version bump
- all financial operations require idempotency
- no hidden retries
- no sensitive card data in logs
- no bypass of canonical state machine
- keep emulator and SDK aligned

## Preferred AI workflow
1. read docs
2. plan a small slice
3. implement code
4. add tests
5. update docs if public behavior changed
6. provide validation steps

## Avoid
- big refactors during feature delivery
- inventing new protocol fields casually
- mixing sale/refund/reversal semantics
- platform-specific hacks in public API
