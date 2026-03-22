# Path Terminal SDK — Integration Assistant

The Path Integration Assistant helps you wire card-present payments into your iOS EPOS app using AI. It provides:

- A **remote MCP server** at `mcp.path2ai.tech` — docs, code examples, tools, and prompts accessible to any AI coding agent
- A **one-line CLI** (`npx path-terminal-init`) that configures everything in your project
- A **Cursor rules file** that guides the agent to inspect your codebase and produce correct integration code

---

## Quick start (recommended)

Run this from your Xcode project directory:

```bash
npx path-terminal-init
```

This will:
1. Add the PathTerminalSDK as a Swift Package Manager dependency
2. Configure `.cursor/mcp.json` to point at the Path MCP server
3. Drop the integration rules file into `.cursor/rules/`
4. Check your `Info.plist` for BLE permissions

Then open Cursor and type:

```
Use the Path MCP tools to integrate a sale flow into this app.
```

---

## Manual setup (alternative)

If you prefer to configure manually:

### 1. Add MCP server to Cursor

Create or edit `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "path-terminal": {
      "url": "https://mcp.path2ai.tech/sse"
    }
  }
}
```

Restart Cursor. You should see `path-terminal` listed in active MCP servers.

### 2. Add the rules file

Download and place in `.cursor/rules/`:

```bash
curl -o .cursor/rules/path-integration.mdc https://mcp.path2ai.tech/rules
```

Or copy `path-integration.mdc` from this repo.

### 3. Install the SDK in Xcode

- File → Add Package Dependencies…
- Enter: `https://github.com/keyman12/path-terminal-sdk`
- Select: **PathTerminalSDK** and **PathEmulatorAdapter** targets

### 4. Add BLE permission to Info.plist

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app connects to a Path payment terminal via Bluetooth to process card payments.</string>
```

---

## CLI options

```
npx path-terminal-init              # Full setup (SDK + MCP config + rules)
npx path-terminal-init --tools-only # MCP config + rules only (no SDK install)
npx path-terminal-init --agent cursor  # Specify agent (default: cursor)
```

---

## What the MCP server provides

### Resources (read-only reference data)

| URI | Content |
|-----|---------|
| `path://docs/{slug}` | All SDK documentation files |
| `path://schemas/{name}` | Protocol JSON schemas |
| `path://api-reference` | Full API reference (all classes, methods, types) |
| `path://examples/{name}` | Compilable Swift code examples |
| `path://integration-checklist` | Step-by-step readiness checklist |

### Tools

| Tool | What it does |
|------|-------------|
| `get_code_example` | Returns the correct Swift example for a specific operation |
| `explain_error` | Explains a PathErrorCode with causes and recovery steps |
| `validate_integration` | Checks your code for common mistakes |
| `get_integration_checklist` | Returns the full integration checklist |
| `get_info_plist_requirements` | Returns BLE permission XML for Info.plist |

### Prompts

| Prompt | What it does |
|--------|-------------|
| `integrate-path-sale` | Inspect project, find checkout, wire a sale |
| `integrate-path-refund` | Find order history, wire a refund |
| `integrate-path-receipts` | Wire receipt data retrieval after a sale |
| `full-path-integration` | End-to-end: sale + refund + receipts + events |
| `diagnose-path-error` | Diagnose and fix a PathError |
| `setup-emulator` | Connect and test with the Path Pico W emulator |

---

## Sample prompts

```
Use the Path MCP tools to integrate a sale flow into this app.

Integrate Path refund into the order history screen.

Add receipt retrieval after a successful Path sale.

I'm getting a PathError with code 'connectivity' — what does this mean?

Use the full-path-integration prompt to wire sale, refund, and receipts end to end.
```

---

## Testing with the Path Pico W Emulator

1. Power on the Path Pico W emulator (it broadcasts BLE automatically)
2. Run your app — it should discover and connect to the emulator
3. Trigger a sale for 100 (= £1.00 GBP)
4. Tap the NFC tag on the emulator when prompted
5. Verify `result.state == .approved` and `result.transactionId` is present
6. Call `getReceiptData(transactionId:)` to fetch the receipt

Ask the agent: *"Guide me through connecting the emulator and running a first test sale"* — it will walk you through each step.

---

## Health check

```bash
curl https://mcp.path2ai.tech/health
```

---

## Support

Contact your Path account manager or open an issue in the SDK repository.
