# 12. Observability and Diagnostics

## Principle
Production support is a product feature.

## Minimum metadata
- correlationId
- requestId
- transactionId
- merchantReference
- sdkVersion
- adapterVersion
- protocolVersion
- appVersion
- deviceModel
- osVersion
- terminalIdentifier
- terminalCapabilitiesHash
- currentState
- previousState
- canonicalErrorCode
- adapterErrorCode
- timestamps per step

## Support bundle contents
- manifest.json
- versions.json
- config-snapshot.json
- capability-snapshot.json
- recent-logs.ndjson
- failing-transaction.json
- state-trace.json
- known-terminal-info.json
- reproduction-hints.json

## Guided health check
Should test:
- initialization
- discovery
- connectivity
- capability agreement
- sale simulation
- refund simulation
- receipt retrieval
- reconnect
