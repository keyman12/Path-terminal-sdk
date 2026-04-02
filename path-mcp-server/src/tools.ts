import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EXAMPLES } from "./content/examples.js";
import { ERROR_CODES } from "./content/errorCodes.js";

const VALID_OPERATIONS = Object.keys(EXAMPLES);

const INFO_PLIST_XML = `<!-- Add these keys to your Info.plist -->

<!-- Required: permission for BLE in background -->
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app connects to a Path payment terminal via Bluetooth to process card payments.</string>

<!-- Required on iOS 12 and earlier (still recommended for compatibility) -->
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to communicate with a Path payment terminal.</string>`;

const INTEGRATION_CHECKLIST_TEXT = `# Path Terminal SDK Integration Checklist

## Step 1: Setup
1. Add PathTerminalSDK via Swift Package Manager
   URL: https://github.com/keyman12/path-terminal-sdk
   Targets: PathTerminalSDK, PathEmulatorAdapter
2. Add BLE permissions to Info.plist (call get_info_plist_requirements for exact XML)
3. Confirm Cursor MCP config points to https://mcp.path2ai.tech/sse

## Step 2: Initialise
4. Create PathTerminalManager as a @MainActor ObservableObject
5. Initialise BLEPathTerminalAdapter(sdkVersion:adapterVersion:)
6. Create PathTerminal(adapter:)
7. Hold as @StateObject at app scope
8. Subscribe to terminal.events in a Task

## Step 3: Wire sale
9. Find the checkout/payment trigger point
10. Call RequestEnvelope.create(sdkVersion:adapterVersion:)
11. Call TransactionRequest.sale(amountMinor:currency:envelope:)
12. Call terminal.sale(request:) and await result
13. Handle .approved, .declined, .timedOut, .failed states
14. Catch PathError and check .recoverable

## Step 4: Wire refund
15. Find the order history / transaction detail entry point
16. Store transactionId from the sale result
17. Call TransactionRequest.refund(amountMinor:currency:originalTransactionId:envelope:)
18. Handle .refunded and .declined

## Step 5: Wire receipts
19. After .approved, call terminal.getReceiptData(transactionId:)
20. Display both merchantReceipt and customerReceipt fields

## Step 6: Test with emulator
21. Power on Path POS Emulator
22. Run app — verify BLE discovery and connection
23. Process test sale (100 = £1.00 GBP)
24. Tap NFC tag on emulator when prompted
25. Verify result.state == .approved and transactionId is non-nil
26. Verify getReceiptData returns populated fields
27. Process test refund using the transactionId

## Mandatory readiness checks
- Discovery works
- Sale works end-to-end  
- Refund works end-to-end
- Receipt data is retrievable
- Error handling covers all PathError codes`;

function detectCommonMistakes(code: string): string[] {
  const warnings: string[] = [];

  if (!code.includes("import PathTerminalSDK")) {
    warnings.push(
      "Missing: import PathTerminalSDK — add this at the top of every file that uses PathTerminal or PathTerminalEvent."
    );
  }

  if (
    (code.includes("TransactionRequest") ||
      code.includes("RequestEnvelope") ||
      code.includes("TransactionResult")) &&
    !code.includes("import PathCoreModels")
  ) {
    warnings.push(
      "Missing: import PathCoreModels — required for TransactionRequest, TransactionResult, RequestEnvelope, PathError, and all model types."
    );
  }

  if (
    code.includes("TransactionRequest(") &&
    !code.includes("TransactionRequest.sale") &&
    !code.includes("TransactionRequest.refund")
  ) {
    warnings.push(
      "Incorrect: raw TransactionRequest(...) initialiser used. Use TransactionRequest.sale(...) or TransactionRequest.refund(...) factory methods instead."
    );
  }

  if (
    code.includes("terminal.sale") &&
    !code.includes("RequestEnvelope")
  ) {
    warnings.push(
      "Missing: RequestEnvelope. Every sale and refund request must include an envelope. Use RequestEnvelope.create(sdkVersion:adapterVersion:)."
    );
  }

  if (
    code.includes("RequestEnvelope(") &&
    !code.includes("RequestEnvelope.create")
  ) {
    warnings.push(
      "Incorrect: raw RequestEnvelope(...) initialiser used. Use RequestEnvelope.create(...) which auto-generates requestId, idempotencyKey, correlationId, and timestamp."
    );
  }

  // Direct SDK call site check — terminal.sale() and terminal.refund() are throwing.
  // terminal.startSale() / terminal.startRefund() are acceptable wrapper patterns
  // that handle errors internally, so we only flag the raw SDK call site.
  const hasDirectSaleCall = code.includes("terminal.sale(") || code.includes("terminal.refund(");
  const hasWrapperCall = code.includes("terminal.startSale(") || code.includes("terminal.startRefund(");
  const hasPathErrorCatch = code.includes("catch let") && (code.includes("PathError") || code.includes("pathError"));
  const hasGenericCatch = code.includes("catch {") || code.includes("catch{");

  if (hasDirectSaleCall && !hasPathErrorCatch && !hasGenericCatch) {
    warnings.push(
      "Missing: error handling. terminal.sale() and terminal.refund() are throwing functions. Wrap in do { let result = try await terminal.sale(...) } catch let pathError as PathError { /* check pathError.recoverable */ } catch { /* handle unexpected errors */ }."
    );
  } else if (hasDirectSaleCall && hasGenericCatch && !hasPathErrorCatch) {
    warnings.push(
      "Incomplete: error handling catches all errors but doesn't handle PathError specifically. Add catch let pathError as PathError before the generic catch, and check pathError.recoverable to decide on retry."
    );
  }

  if (hasWrapperCall && !hasDirectSaleCall) {
    // Using a wrapper (e.g. AppTerminalManager.startSale) — no warning needed here,
    // but remind to check the wrapper handles PathError internally.
  }

  // Heuristic: if they're passing a decimal literal as amount
  const decimalAmount = /amountMinor:\s*\d+\.\d+/.test(code);
  if (decimalAmount) {
    warnings.push(
      "Incorrect: amountMinor appears to be a decimal value. Amounts must be in minor units (pence/cents) as an integer. 1250 = £12.50, not 12.50."
    );
  }

  if (
    hasDirectSaleCall &&
    !code.includes(".approved") &&
    !code.includes("result.state")
  ) {
    warnings.push(
      "Incomplete: Sale result state is not being checked. Always switch on result.state and handle at minimum: .approved, .declined, .timedOut, .failed."
    );
  }

  if (warnings.length === 0) {
    warnings.push("No obvious issues detected. Review against the API reference for complete correctness.");
  }

  return warnings;
}

// z.object(...) (not raw shapes) keeps MCP SDK ToolCallback inference shallow (avoids TS2589).
const getCodeExampleParams = z.object({
  operation: z.string().describe(
    "The operation to get an example for. Options: install, init, discover, sale, refund, receipt, events, capabilities."
  ),
});

const explainErrorParams = z.object({
  error_code: z.string().describe(
    "A PathErrorCode value. Valid codes: validation, connectivity, capability, terminal_busy, timeout, user_cancelled, decline, terminal_fault, adapter_fault, protocol_mismatch, recovery_required, configuration_error, unsupported_operation"
  ),
});

const validateIntegrationParams = z.object({
  code: z.string().describe(
    "The Swift code snippet to validate. Can be a partial file or the full integration code."
  ),
});

export function registerTools(server: McpServer): void {
  // Zod object schemas + MCP SDK generics hit TS2589; loose typing only for registration.
  const srv = server as any;

  // get_code_example
  srv.registerTool(
    "get_code_example",
    {
      description:
        "Returns a complete, correct, compilable Swift code example for a specific Path Terminal SDK operation. Always call this before writing any integration code — do not guess at API patterns.",
      inputSchema: getCodeExampleParams,
    },
    async ({ operation }: z.infer<typeof getCodeExampleParams>) => {
      const code = EXAMPLES[operation];
      return {
        content: [
          {
            type: "text",
            text: [
              `# Swift code example: ${operation}`,
              "",
              "```swift",
              code,
              "```",
              "",
              `Source: canonical example for ${operation} — use this pattern verbatim.`,
              `Available operations: ${VALID_OPERATIONS.join(", ")}`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  // explain_error
  srv.registerTool(
    "explain_error",
    {
      description:
        "Explains a PathErrorCode — what it means, common causes, whether it is recoverable, and the suggested fix. Call this whenever a PathError is encountered or when the developer reports an error.",
      inputSchema: explainErrorParams,
    },
    async ({ error_code }: z.infer<typeof explainErrorParams>) => {
      // Normalise: accept both camelCase and snake_case
      const normalised = error_code
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .replace(/^_/, "");
      const info = ERROR_CODES[normalised] ?? ERROR_CODES[error_code];

      if (!info) {
        const validCodes = Object.keys(ERROR_CODES).join(", ");
        return {
          content: [
            {
              type: "text",
              text: `Unknown error code: "${error_code}".\n\nValid PathErrorCode values:\n${validCodes}\n\nIf this is an adapterErrorCode (raw terminal error), it is device-specific. Check the full PathError.message for more context.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `# PathError: ${info.code}`,
              "",
              `**Meaning:** ${info.meaning}`,
              "",
              `**Recoverable:** ${info.recoverable ? "Yes — a retry is safe (use a new idempotencyKey for financial operations)" : "No — do not retry without resolving the underlying cause"}`,
              "",
              "**Common causes:**",
              info.commonCauses.map((c) => `- ${c}`).join("\n"),
              "",
              `**Suggested fix:** ${info.suggestedFix}`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  // validate_integration
  srv.registerTool(
    "validate_integration",
    {
      description:
        "Checks a Swift code snippet for common Path Terminal SDK integration mistakes. Call this after writing integration code and before presenting it to the developer for review.",
      inputSchema: validateIntegrationParams,
    },
    async ({ code }: z.infer<typeof validateIntegrationParams>) => {
      const warnings = detectCommonMistakes(code);
      const hasIssues = warnings.length > 1 || !warnings[0].startsWith("No obvious");

      return {
        content: [
          {
            type: "text",
            text: [
              `# Integration validation — ${hasIssues ? `${warnings.length} issue(s) found` : "No issues detected"}`,
              "",
              ...warnings.map((w, i) => `${i + 1}. ${w}`),
              "",
              "Note: this is a heuristic check. Always review against the full API reference (path://api-reference) for completeness.",
            ].join("\n"),
          },
        ],
      };
    }
  );

  // get_integration_checklist
  server.registerTool(
    "get_integration_checklist",
    {
      description:
        "Returns the ordered checklist of all steps required for a complete Path Terminal SDK integration. Call this at the start of any integration session.",
    },
    async () => ({
      content: [{ type: "text", text: INTEGRATION_CHECKLIST_TEXT }],
    })
  );

  // get_info_plist_requirements
  server.registerTool(
    "get_info_plist_requirements",
    {
      description:
        "Returns the exact Info.plist XML keys and values required for Bluetooth (BLE) permission. Call this when checking or setting up BLE permissions, or when the developer asks what to add to Info.plist.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: [
            "# Info.plist BLE Permission Requirements",
            "",
            "Add the following keys to your app's `Info.plist` file:",
            "",
            "```xml",
            INFO_PLIST_XML,
            "```",
            "",
            "**How to add in Xcode:**",
            "1. Open your project in Xcode",
            "2. Select your target → Info tab",
            "3. Click + to add a new key",
            "4. Type 'Privacy - Bluetooth Always Usage Description'",
            "5. Set the value to your permission message",
            "",
            "**Or edit Info.plist directly:**",
            "Right-click Info.plist → Open As → Source Code, then paste the XML above.",
            "",
            "⚠️ The app will crash on launch without these keys when Bluetooth is accessed.",
          ].join("\n"),
        },
      ],
    })
  );
}
