import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { EXAMPLES } from "./content/examples.js";
import { API_REFERENCE } from "./content/apiReference.js";

const DOCS_DIR = path.join(__dirname, "../../Docs");
const SCHEMAS_DIR = path.join(__dirname, "../../schemas");

function readDocFile(slug: string): string | null {
  // Resolve slug to a filename — slug is filename without extension
  const files = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR) : [];
  const match = files.find((f) => f.replace(/\.md$/, "") === slug);
  if (!match) return null;
  return fs.readFileSync(path.join(DOCS_DIR, match), "utf-8");
}

function readSchemaFile(name: string): string | null {
  const filePath = path.join(SCHEMAS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

function listDocSlugs(): string[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function listSchemaSlugs(): string[] {
  if (!fs.existsSync(SCHEMAS_DIR)) return [];
  return fs
    .readdirSync(SCHEMAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

const INTEGRATION_CHECKLIST = `# Path Terminal SDK — Integration Checklist

Use this as your guide through the integration journey. Check off each item before moving to the next.

## Phase 1: Setup

- [ ] **SDK installed** — PathTerminalSDK added as an SPM dependency in Xcode
      (File → Add Package Dependencies → https://github.com/keyman12/path-terminal-sdk)
- [ ] **Targets selected** — PathTerminalSDK and PathEmulatorAdapter targets both selected
- [ ] **BLE permission** — NSBluetoothAlwaysUsageDescription added to Info.plist
- [ ] **MCP server connected** — Cursor shows path-terminal in active MCP servers

## Phase 2: Initialisation

- [ ] **PathTerminalManager created** — Single ObservableObject at app scope
- [ ] **BLEPathTerminalAdapter initialised** — sdkVersion and adapterVersion set
- [ ] **@StateObject wired** — Manager injected into SwiftUI view hierarchy
- [ ] **Events subscribed** — terminal.events Task started at init time

## Phase 3: Sale

- [ ] **Sale wired at checkout** — TransactionRequest.sale() called at the payment trigger
- [ ] **Envelope created** — RequestEnvelope.create() used (not manual init)
- [ ] **All states handled** — .approved, .declined, .timedOut, .failed all handled
- [ ] **PathError caught** — error handling checks .recoverable

## Phase 4: Refund

- [ ] **Refund accessible** — Entry point in order history or transaction detail
- [ ] **originalTransactionId passed** — From the stored TransactionResult
- [ ] **Refund result handled** — .refunded and .declined handled

## Phase 5: Receipts

- [ ] **Receipt data fetched** — getReceiptData(transactionId:) called after approval
- [ ] **Both copies available** — merchantReceipt and customerReceipt accessible
- [ ] **Regulated fields displayed** — maskedPan, authCode, cardScheme, aid, etc. shown

## Phase 6: Testing

- [ ] **Emulator connected** — App discovers and connects to Path Pico W
- [ ] **Test sale approved** — 100 minor units (£1.00) approved via NFC tap
- [ ] **TransactionId received** — result.transactionId is non-nil
- [ ] **Receipt retrieved** — getReceiptData returns populated fields
- [ ] **Test refund approved** — Refund processed with originalTransactionId

## Mandatory Readiness Checks (Partner Onboarding)

- [ ] Discovery works
- [ ] Sale works end-to-end
- [ ] Refund works end-to-end
- [ ] Receipt data works
- [ ] Version information is present in the app
`;

export function registerResources(server: McpServer): void {
  // path://docs/{slug} — individual doc files
  server.resource(
    "path-docs",
    new ResourceTemplate("path://docs/{slug}", {
      list: async () => ({
        resources: listDocSlugs().map((slug) => ({
          uri: `path://docs/${slug}`,
          name: slug,
          description: `Path SDK documentation: ${slug}`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    async (uri, { slug }) => {
      const slugStr = Array.isArray(slug) ? slug[0] : slug;
      const content = readDocFile(slugStr);
      if (!content) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Document not found: ${slugStr}. Available: ${listDocSlugs().join(", ")}`,
            },
          ],
        };
      }
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }],
      };
    }
  );

  // path://schemas/{name} — JSON schemas
  server.resource(
    "path-schemas",
    new ResourceTemplate("path://schemas/{name}", {
      list: async () => ({
        resources: listSchemaSlugs().map((name) => ({
          uri: `path://schemas/${name}`,
          name,
          description: `Path protocol JSON schema: ${name}`,
          mimeType: "application/json",
        })),
      }),
    }),
    async (uri, { name }) => {
      const nameStr = Array.isArray(name) ? name[0] : name;
      const content = readSchemaFile(nameStr);
      if (!content) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Schema not found: ${nameStr}. Available: ${listSchemaSlugs().join(", ")}`,
            },
          ],
        };
      }
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: content },
        ],
      };
    }
  );

  // path://api-reference — full API reference
  server.resource(
    "path-api-reference",
    "path://api-reference",
    {
      description:
        "Complete API reference for PathTerminalSDK and PathCoreModels — all public classes, structs, enums, protocols, properties, and methods.",
      mimeType: "text/markdown",
    },
    async (uri: URL): Promise<ReadResourceResult> => ({
      contents: [
        { uri: uri.href, mimeType: "text/markdown", text: API_REFERENCE },
      ],
    })
  );

  // path://examples/{name} — Swift code examples
  server.resource(
    "path-examples",
    new ResourceTemplate("path://examples/{name}", {
      list: async () => ({
        resources: Object.keys(EXAMPLES).map((name) => ({
          uri: `path://examples/${name}`,
          name,
          description: `Swift code example: ${name}`,
          mimeType: "text/x-swift",
        })),
      }),
    }),
    async (uri, { name }) => {
      const nameStr = Array.isArray(name) ? name[0] : name;
      const code = EXAMPLES[nameStr];
      if (!code) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Example not found: ${nameStr}. Available: ${Object.keys(EXAMPLES).join(", ")}`,
            },
          ],
        };
      }
      return {
        contents: [{ uri: uri.href, mimeType: "text/x-swift", text: code }],
      };
    }
  );

  // path://integration-checklist
  server.resource(
    "path-integration-checklist",
    "path://integration-checklist",
    {
      description:
        "Ordered checklist of all steps required for a complete, production-ready Path Terminal SDK integration.",
      mimeType: "text/markdown",
    },
    async (uri: URL): Promise<ReadResourceResult> => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: INTEGRATION_CHECKLIST,
        },
      ],
    })
  );
}
