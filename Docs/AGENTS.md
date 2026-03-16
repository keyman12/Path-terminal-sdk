# AGENTS.md

## Goal
Build a protocol-first semi-integrated terminal SDK for Path, starting with iOS and the existing emulator.

## Non-negotiable
- do not change public fields without schema update and version note
- do not add hidden retries to money movement
- do not log sensitive card data
- do not bypass canonical state machine
- prefer small diffs
- add tests for each change

## Priority order
1. schemas and models
2. iOS SDK surface
3. emulator scenarios
4. diagnostics
5. MCP tools
