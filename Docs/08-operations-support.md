# 08. Operations, Monitoring, Upgrades, and Remote Diagnosis

## Key question
If the SDK is embedded in the customer's app, who upgrades and monitors it?

## Answer
### Embedded SDK model
If the SDK is compiled into the customer's software, Path normally cannot upgrade it directly. The partner ships the upgrade in their app release.

### What Path can still control
Path can still design:
- rich telemetry
- support bundle export
- version visibility
- health checks
- compatibility negotiation
- strong regression tooling

## Recommended operating model
### Near term: Embedded SDK + diagnostics
Use for v0.1.
Requirements:
- SDK version visible in-app and in support bundles
- adapter and protocol versions visible
- capability snapshot exportable
- diagnostics bundle exportable
- incidents reproducible with emulator scenarios

### Longer term: Path Runtime / Local Bridge
A separate Path-managed local runtime sits between the app and the terminal.
Benefits:
- Path-managed updates
- better remote diagnostics
- centralized logs
- easier health checks
- better support tooling

## Remote diagnosis methods
1. Support bundle export
2. Guided self-test / health check
3. Incident-to-scenario reproduction flow
4. Later: runtime-based remote diagnostics

## Long-tail testing policy
Every production bug should generate:
1. incident summary
2. sanitized support bundle
3. scenario or fixture
4. automated regression test
5. release note if behavior changes
