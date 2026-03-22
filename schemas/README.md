# JSON Schemas (Path Protocol)

Draft **2020-12** JSON Schema files for the shared contract. IDs use the `https://path.terminal/schemas/` namespace.

| File | Purpose |
|------|---------|
| `request-envelope.json` | Request metadata (`requestId`, idempotency, versions, timestamps) |
| `result-envelope.json` | Canonical transaction result / state |
| `error.json` | `PathError` taxonomy |
| `capabilities.json` | Device capabilities |
| `transaction.json` | Sale/refund request body (amounts, currency) |
| `receipt.json` | Receipt data (merchant + customer copies) |

**Version:** See `Docs/protocol-v0.1-draft.md`.
