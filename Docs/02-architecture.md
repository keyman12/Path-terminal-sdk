# 02. Architecture

## Principle
One canonical Path protocol. Multiple thin platform bindings.

## End-to-end
```text
Partner EPOS App (iOS / Android / Windows)
  ->
Path SDK
  ->
Path Adapter Layer
  ->
[Path Emulator / Test Dongle] or [Real Terminal Adapter]
  ->
Terminal / Processor / Acquirer
```

## Support plane
```text
Cursor / Local AI / Support Tooling
  ->
Path MCP Server
  ->
Docs + Schemas + Scenarios + Logs + Test Runner
```

## Key components
### Partner SDK
Stable API, typed requests and responses, events, diagnostics hooks.

### Path core
Canonical protocol, state machine, error taxonomy, idempotency, serialization.

### Adapter layer
Maps real device / protocol behavior to Path semantics.

### Test kit
Emulator, dongle, scenarios, contract tests, regression fixtures.

### MCP server
Resources, tools, prompts, diagnostics, reproduction aids.

## Evolution
- Phase 1: Embedded iOS SDK
- Phase 2: Android
- Phase 3: Windows or local Path Runtime
- Phase 4: richer fleet diagnostics and remote operations
