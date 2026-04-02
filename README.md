# Path Terminal SDK (monorepo)

Swift **PathTerminalSDK** package, documentation, JSON schemas, MCP server skeleton, and tooling for the Path semi-integrated terminal initiative.

## Quick links

| Resource | Location |
|----------|----------|
| **Partner / dev guide** | [DEVELOPMENT.md](DEVELOPMENT.md) — repos, SPM, clones |
| **Swift package** | [PathTerminalSDK/](PathTerminalSDK/) — `Package.swift`, sources, tests |
| **Documentation index** | [Docs/README.md](Docs/README.md) |
| **Changelog** | [Docs/CHANGELOG.md](Docs/CHANGELOG.md) |
| **iPad EPOS demo** (separate repo) | [Path-epos-demo-sdk](https://github.com/keyman12/Path-epos-demo-sdk) |
| **POS Emulator firmware** (separate repo) | [PosEmulator](https://github.com/keyman12/PosEmulator) |

## Continuous integration (CI)

**CI** means: every time someone **pushes** to `main` or opens a **pull request** against it, **GitHub Actions** automatically runs a **check script** on GitHub’s servers. You don’t have to remember to run tests locally before merging—the workflow runs the same commands in a clean environment and shows **pass** or **fail** on the commit.

This repo’s workflow (`.github/workflows/ci.yml`) does two things:

1. **Swift (macOS)** — Builds **PathTerminalSDK** and runs **`xcrun swift test`** (unit tests under `PathTerminalSDK/Tests/`). That catches broken APIs, mapping bugs, and regressions in the package before they land on `main`.
2. **path-mcp-server (Linux)** — Runs **`npm ci`**, **`npm run build`**, and **`npm run typecheck`** so the MCP server TypeScript still compiles when the SDK repo changes.

If either step fails, the run is marked **failed** in GitHub so you can fix the code before relying on that revision.
