import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// z.object(...) keeps MCP SDK PromptCallback inference shallow (avoids TS2589).
const salePromptArgs = z.object({
  project_type: z
    .string()
    .optional()
    .default("unknown")
    .describe("The UI framework: swiftui, uikit, or unknown (default)."),
});

const fullIntegrationArgs = z.object({
  project_type: z
    .string()
    .optional()
    .default("unknown")
    .describe("The UI framework: swiftui, uikit, or unknown (default)."),
});

const diagnoseArgs = z.object({
  error_code: z
    .string()
    .describe("The PathErrorCode string from the error (e.g. 'connectivity', 'timeout', 'decline')."),
  context: z
    .string()
    .optional()
    .describe("Optional: additional context about when the error occurred."),
});

export function registerPrompts(server: McpServer): void {
  // Zod object schemas + MCP SDK generics hit TS2589; loose typing only for registration.
  const srv = server as any;

  // integrate-path-sale
  srv.registerPrompt(
    "integrate-path-sale",
    {
      description:
        "Guides the agent through inspecting the ISV's project, finding the checkout flow, installing the SDK, and wiring a Path Terminal SDK sale. Covers UX Steps 2 and 3.",
      argsSchema: salePromptArgs,
    },
    ({ project_type }: z.infer<typeof salePromptArgs>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the Path MCP tools and docs to integrate a sale flow into this iOS app.",
              "",
              "## Your task",
              "",
              "### Step 1: Read the integration checklist",
              "Call get_integration_checklist to see the full journey.",
              "Call the path://api-reference resource to familiarise yourself with the SDK types.",
              "",
              "### Step 2: Inspect the project",
              "Read the project files to find:",
              "- The checkout or payment trigger point (ViewModel, button action, coordinator)",
              "- The app entry point (App struct or AppDelegate/SceneDelegate)",
              `- UI framework in use: ${project_type === "unknown" ? "detect from the codebase" : project_type}`,
              "",
              "Search for files and classes named with: checkout, payment, cart, order, pay",
              "Look for button actions that trigger payment or navigate to a payment screen.",
              "Look for existing payment SDK calls — Path goes alongside these, not replacing them.",
              "",
              "### Step 3: Report findings",
              "Before writing any code, tell the developer exactly what you found:",
              '- "I found your checkout in [file] at line [n]"',
              '- "I recommend wiring Path at [specific location] because [reason]"',
              "- List every file you plan to modify",
              "Wait for the developer to confirm before proceeding.",
              "",
              "### Step 4: Check Info.plist",
              "Call get_info_plist_requirements.",
              "Check whether NSBluetoothAlwaysUsageDescription is already present.",
              "If missing, show the developer exactly what to add.",
              "",
              "### Step 5: Check SDK installation",
              "Call get_code_example with operation 'install'.",
              "Check Package.swift or the Xcode project for PathTerminalSDK dependency.",
              "If not present, show the install instructions.",
              "",
              "### Step 6: Create PathTerminalManager",
              "Call get_code_example with operation 'init'.",
              "Create a PathTerminalManager class following that pattern exactly.",
              `Use the appropriate pattern for ${project_type === "uikit" ? "UIKit (inject via app delegate)" : "SwiftUI (@StateObject at App struct level)"}.`,
              "Subscribe to terminal.events in a Task within the init.",
              "",
              "### Step 7: Wire the sale",
              "Call get_code_example with operation 'discover'.",
              "Call get_code_example with operation 'sale'.",
              "Wire the sale at the payment trigger point identified in Step 2.",
              "Handle all result states: .approved, .declined, .timedOut, .failed, and a default case.",
              "Catch PathError and check .recoverable.",
              "",
              "### Step 8: Validate",
              "Call validate_integration with the code you have written.",
              "Fix any warnings before presenting to the developer.",
              "",
              "### Step 9: Explain",
              "List every file modified and what changed in each.",
              "Tell the developer what to do next (connect emulator, run app, test sale).",
              "Keep changes minimal — do not restructure existing code.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // integrate-path-refund
  server.registerPrompt(
    "integrate-path-refund",
    {
      description:
        "Guides the agent through finding the order history or transaction list and wiring a Path Terminal SDK refund flow. Covers UX Step 5.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the Path MCP tools to integrate a refund flow into this iOS app.",
              "",
              "## Your task",
              "",
              "### Step 1: Inspect the project",
              "Find the order history, transaction list, or admin screen where refunds would be initiated.",
              "Search for: order history, transaction list, order detail, refund, return",
              "Identify where transactionId from previous sales is stored (CoreData, UserDefaults, in-memory, etc.).",
              "",
              "### Step 2: Report findings",
              "Before writing any code, tell the developer:",
              "- Where you found the refund entry point",
              "- Where transactionIds are stored",
              "- What files you plan to modify",
              "Wait for confirmation.",
              "",
              "### Step 3: Check PathTerminalManager exists",
              "Check if PathTerminalManager (or equivalent) already exists from a previous sale integration.",
              "If not, follow integrate-path-sale steps first.",
              "",
              "### Step 4: Wire the refund",
              "Call get_code_example with operation 'refund'.",
              "Wire the refund action passing originalTransactionId from the stored sale result.",
              "Always pass originalTransactionId — this is critical for traceability and recovery.",
              "Handle result states: .refunded and .declined.",
              "Catch PathError.",
              "",
              "### Step 5: Validate and explain",
              "Call validate_integration with the refund code.",
              "List every file modified and what changed.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // integrate-path-receipts
  server.registerPrompt(
    "integrate-path-receipts",
    {
      description:
        "Guides the agent through finding the receipt/confirmation screen and wiring Path receipt data retrieval after a successful sale. Covers UX Step 5.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the Path MCP tools to wire receipt retrieval into this iOS app after a successful Path sale.",
              "",
              "## Your task",
              "",
              "### Step 1: Inspect the project",
              "Find the receipt display or order confirmation screen.",
              "Search for: receipt, confirmation, orderComplete, orderDetail, success screen.",
              "Identify where the sale result (including transactionId) is currently passed to this screen.",
              "",
              "### Step 2: Report findings",
              "Tell the developer where receipt display happens and how you plan to add the data.",
              "Wait for confirmation.",
              "",
              "### Step 3: Wire receipt retrieval",
              "Call get_code_example with operation 'receipt'.",
              "After a successful sale (result.state == .approved and result.receiptAvailable == true),",
              "call terminal.getReceiptData(transactionId: result.transactionId!).",
              "",
              "Display from customerReceipt: maskedPan, cardScheme, authCode, entryMode, amount, timestamp.",
              "Store merchantReceipt for your records.",
              "Do not modify the regulated field values — display them exactly as received.",
              "",
              "### Step 4: Handle the receipt-ready event (optional enhancement)",
              "Call get_code_example with operation 'events'.",
              "The terminal also emits .receiptReady(data) automatically after an approved sale.",
              "This can be used to pre-fetch receipt data before the developer asks for it.",
              "",
              "### Step 5: Validate and explain",
              "Call validate_integration with the receipt code.",
              "List every file modified.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // full-path-integration
  srv.registerPrompt(
    "full-path-integration",
    {
      description:
        "End-to-end integration: install SDK, initialise, discover, wire sale, refund, receipts, and events. Covers all UX Steps 2-5.",
      argsSchema: fullIntegrationArgs,
    },
    ({ project_type }: z.infer<typeof fullIntegrationArgs>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Use the Path MCP tools and docs to fully integrate the Path Terminal SDK into this iOS app.",
              "Complete the integration in the order below. Keep changes minimal — do not restructure existing code.",
              "",
              "## Your task",
              "",
              "### Step 1: Read resources",
              "Call get_integration_checklist — use this as your guide throughout.",
              "Read path://api-reference — understand all types before writing any code.",
              "Read path://docs/04-protocol-state-errors — understand the state machine before wiring transactions.",
              "",
              "### Step 2: Inspect the project",
              `Detect the UI framework (expected: ${project_type === "unknown" ? "detect from code" : project_type}).`,
              "Find and report:",
              "  - App entry point (App struct or AppDelegate)",
              "  - Checkout / payment trigger",
              "  - Order confirmation / receipt screen",
              "  - Order history / transaction list (for refund entry)",
              "Search for: checkout, payment, cart, order, receipt, history, transaction",
              "Report your findings with file names and line numbers. Wait for confirmation before writing code.",
              "",
              "### Step 3: Setup",
              "Call get_info_plist_requirements. Check and add BLE permissions if missing.",
              "Call get_code_example('install'). Check for SDK dependency. Show install steps if needed.",
              "",
              "### Step 4: Initialise",
              "Call get_code_example('init').",
              "Create PathTerminalManager at app scope.",
              "Call get_code_example('events'). Subscribe to terminal.events in a Task.",
              "Wire connection state to a UI indicator the developer already has, or suggest a minimal addition.",
              "",
              "### Step 5: Sale",
              "Call get_code_example('discover') and get_code_example('sale').",
              "Wire the sale at the checkout trigger.",
              "Handle all TransactionState cases. Catch PathError.",
              "",
              "### Step 6: Receipt",
              "Call get_code_example('receipt').",
              "After .approved, fetch and display receipt data.",
              "",
              "### Step 7: Refund",
              "Call get_code_example('refund').",
              "Wire refund from order history, passing originalTransactionId.",
              "",
              "### Step 8: Validate everything",
              "Call validate_integration for each file you have written or modified.",
              "Fix any warnings.",
              "",
              "### Step 9: Summary",
              "List every file created or modified and what changed in each.",
              "Tell the developer exactly what to do next to test with the emulator.",
              "Reference the emulator setup prompt (setup-emulator) for the test walkthrough.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // diagnose-path-error
  srv.registerPrompt(
    "diagnose-path-error",
    {
      description:
        "Explains a Path error and provides specific recovery guidance. Covers UX Step 6.",
      argsSchema: diagnoseArgs,
    },
    ({ error_code, context }: z.infer<typeof diagnoseArgs>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Diagnose a Path Terminal SDK error: ${error_code}`,
              context ? `\nContext: ${context}` : "",
              "",
              "## Your task",
              "",
              `1. Call explain_error with error_code "${error_code}".`,
              "2. Read the explanation carefully.",
              "3. If context was provided, analyse it alongside the explanation to identify the most likely cause.",
              "4. Provide:",
              "   - What this error means in plain language",
              "   - The most likely cause given the context",
              "   - Whether it is safe to retry (check .recoverable)",
              "   - Specific fix steps for this situation",
              "5. If a code fix is needed, call get_code_example for the relevant operation and show the correct pattern.",
              "6. If the error suggests a connectivity issue, guide through reconnect steps.",
              "7. If the error is recovery_required, explain the importance of calling getTransactionStatus before retrying.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  // setup-emulator
  server.registerPrompt(
    "setup-emulator",
    {
      description:
        "Guides the ISV through connecting the Path POS Emulator via BLE and running a first test sale. Covers UX Step 4.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Guide me through connecting the Path POS Emulator and running a first test sale.",
              "",
              "## Your task",
              "",
              "### Step 1: Check BLE permissions",
              "Call get_info_plist_requirements.",
              "Check the project's Info.plist for NSBluetoothAlwaysUsageDescription.",
              "If missing, show the developer exactly what to add and where. Wait for confirmation.",
              "",
              "### Step 2: Check SDK initialisation",
              "Verify that PathTerminalManager (or equivalent) exists and is held at app scope.",
              "If not set up, instruct the developer to run the integrate-path-sale prompt first.",
              "",
              "### Step 3: Emulator hardware setup",
              "Explain the following to the developer:",
              "  - Power on the Path POS Emulator (USB-C or battery)",
              "  - The emulator broadcasts a BLE service when powered on",
              "  - It should appear as 'PathEPOSEmulator' or similar in BLE scans",
              "  - Ensure the emulator is within 2-3 metres of the iPhone/iPad",
              "  - No pairing is required — the SDK handles BLE discovery automatically",
              "",
              "### Step 4: Discover and connect",
              "Call get_code_example with operation 'discover'.",
              "Show the discover and connect code.",
              "Instruct the developer to:",
              "  1. Run the app",
              "  2. Trigger the discovery flow (or call discoverDevices() from a debug button)",
              "  3. Confirm they see the emulator in the discovered devices list",
              "  4. Connect to it",
              "  5. Verify connectionState becomes .connected in the event stream",
              "",
              "### Step 5: First test sale",
              "Call get_code_example with operation 'sale'.",
              "Instruct the developer to:",
              "  1. Navigate to the checkout screen",
              "  2. Enter a test amount — suggest 100 (= £1.00 GBP)",
              "  3. Trigger the sale",
              "  4. When the terminal state shows pendingDevice, present the NFC tag on the emulator",
              "     (tap the NFC sticker/antenna on the Path POS Emulator)",
              "  5. The emulator simulates card presentation and approval",
              "",
              "### Step 6: Verify results",
              "Tell the developer to check:",
              "  - result.state == .approved",
              "  - result.transactionId is non-nil",
              "  - result.receiptAvailable (if true, getReceiptData() will work)",
              "",
              "### Step 7: Connection type note",
              "Add this note for context:",
              "'The Path POS Emulator currently connects via Bluetooth (BLE). WiFi and USB",
              "connection methods are planned for future releases. The same integration code",
              "works with all connection types — only the adapter changes.'",
            ].join("\n"),
          },
        },
      ],
    })
  );
}
