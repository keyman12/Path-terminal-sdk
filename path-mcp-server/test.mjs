/**
 * Local test suite for the Path MCP server.
 *
 * MCP over SSE protocol:
 *   - Client GETs /sse  → receives SSE stream
 *   - First SSE event:  event: endpoint / data: /messages?sessionId=xxx
 *   - Client POSTs to /messages?sessionId=xxx → HTTP 202 Accepted
 *   - MCP responses come back on the SSE stream as: event: message / data: {...}
 */
import http from "http";

const HOST = "localhost";
const PORT = 3005;
const BASE = `http://${HOST}:${PORT}`;

// Pending RPC callbacks keyed by message id
const pending = new Map();
let messagesPath = null;
let sseReq = null;
let msgId = 1;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    }).on("error", reject);
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: HOST, port: PORT, path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ─── SSE client ──────────────────────────────────────────────────────────────

function startSSE() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}/sse`, (res) => {
      let buf = "";
      let currentEvent = "";

      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const data = line.slice(5).trim();

            if (currentEvent === "endpoint") {
              messagesPath = data; // e.g. /messages?sessionId=xxx
              resolve();
            } else if (currentEvent === "message" || currentEvent === "") {
              // MCP response
              try {
                const msg = JSON.parse(data);
                if (msg.id !== undefined && pending.has(msg.id)) {
                  const cb = pending.get(msg.id);
                  pending.delete(msg.id);
                  cb(msg);
                }
              } catch {}
            }
            currentEvent = "";
          }
        }
      });

      res.on("error", reject);
      res.on("close", () => {
        // Reject any remaining pending requests
        for (const [id, cb] of pending) {
          cb({ error: { code: -1, message: "SSE connection closed" } });
        }
        pending.clear();
      });
    });

    req.on("error", reject);
    sseReq = req;

    setTimeout(() => {
      if (!messagesPath) reject(new Error("SSE handshake timeout — no endpoint event after 5s"));
    }, 5000);
  });
}

// ─── MCP RPC ─────────────────────────────────────────────────────────────────

function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const body = { jsonrpc: "2.0", id, method, params };

    // Register response handler BEFORE posting
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPC timeout for ${method} (id=${id})`));
    }, 8000);

    pending.set(id, (response) => {
      clearTimeout(timer);
      resolve(response);
    });

    httpPost(messagesPath, body).catch(reject);
  });
}

// One-way notification (no id, no response expected)
function notify(method, params = {}) {
  return httpPost(messagesPath, { jsonrpc: "2.0", method, params });
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

const pass = (label) => { passed++; console.log(`  ✅ ${label}`); };
const fail = (label, detail = "") => { failed++; console.log(`  ❌ ${label}${detail ? ": " + String(detail).slice(0, 120) : ""}`); };
const info = (msg) => console.log(`  ℹ  ${msg}`);
const section = (title) => console.log(`\n${"─".repeat(52)}\n  ${title}\n${"─".repeat(52)}`);

// ─── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n  Path MCP Server — Local Test Suite`);
  console.log(`  ${BASE}\n`);

  // 1. Health
  section("1. Health check");
  const health = JSON.parse((await httpGet("/health")).body);
  health.status === "ok" ? pass("Health returns ok") : fail("Health", health.status);
  health.server === "path-terminal-mcp-server"
    ? pass(`Server: ${health.server} v${health.version}`)
    : fail("Server name", health.server);

  // 2. SSE
  section("2. SSE connection + endpoint handshake");
  await startSSE();
  pass(`Connected — messages endpoint: ${messagesPath}`);

  // 3. Initialize
  section("3. MCP initialize");
  const initRes = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "path-test-client", version: "0.0.1" },
  });
  const serverInfo = initRes?.result?.serverInfo;
  serverInfo?.name === "path-terminal-integration"
    ? pass(`Server: ${serverInfo.name} v${serverInfo.version}`)
    : fail("Initialize", JSON.stringify(initRes?.error ?? serverInfo));

  await notify("notifications/initialized");

  // 4. Tools
  section("4. Tools registered");
  const toolsRes = await rpc("tools/list");
  const toolNames = (toolsRes?.result?.tools ?? []).map((t) => t.name);
  info(`Total tools: ${toolNames.length}`);
  for (const name of ["get_code_example", "explain_error", "validate_integration",
                       "get_integration_checklist", "get_info_plist_requirements"]) {
    toolNames.includes(name) ? pass(`Tool: ${name}`) : fail(`Tool missing`, name);
  }

  // 5. Resources
  section("5. Resources registered");
  const resRes = await rpc("resources/list");
  const resources = resRes?.result?.resources ?? [];
  info(`Total resources: ${resources.length}`);
  resources.length > 0 ? pass(`Resources listed`) : fail("Resources list", "empty");
  resources.slice(0, 6).forEach((r) => info(r.uri));

  // 6. Prompts
  section("6. Prompts registered");
  const promptsRes = await rpc("prompts/list");
  const promptNames = (promptsRes?.result?.prompts ?? []).map((p) => p.name);
  info(`Total prompts: ${promptNames.length}`);
  for (const name of ["integrate-path-sale", "integrate-path-refund", "integrate-path-receipts",
                       "full-path-integration", "diagnose-path-error", "setup-emulator"]) {
    promptNames.includes(name) ? pass(`Prompt: ${name}`) : fail(`Prompt missing`, name);
  }

  // 7. get_code_example — sale
  section("7. Tool: get_code_example(sale)");
  const saleEx = await rpc("tools/call", { name: "get_code_example", arguments: { operation: "sale" } });
  const saleText = saleEx?.result?.content?.[0]?.text ?? "";
  saleText.includes("TransactionRequest.sale") && saleText.includes("terminal.sale")
    ? pass("Correct sale API patterns")
    : fail("get_code_example(sale)", saleText.slice(0, 80) || JSON.stringify(saleEx?.error));

  // 8. get_code_example — init
  section("8. Tool: get_code_example(init)");
  const initEx = await rpc("tools/call", { name: "get_code_example", arguments: { operation: "init" } });
  const initText = initEx?.result?.content?.[0]?.text ?? "";
  initText.includes("BLEPathTerminalAdapter") && initText.includes("@MainActor")
    ? pass("Correct init pattern")
    : fail("get_code_example(init)", initText.slice(0, 80));

  // 9. explain_error
  section("9. Tool: explain_error(connectivity)");
  const errRes = await rpc("tools/call", { name: "explain_error", arguments: { error_code: "connectivity" } });
  const errText = errRes?.result?.content?.[0]?.text ?? "";
  errText.includes("Bluetooth") && errText.includes("Recoverable")
    ? pass("Connectivity error explained with BLE guidance and recovery flag")
    : fail("explain_error", errText.slice(0, 120));

  // 10. validate_integration — detects mistakes
  section("10. Tool: validate_integration (bad code)");
  const badCode = `import PathTerminalSDK\nlet r = TransactionRequest(amountMinor: 12.50, currency: "GBP")\nterminal.sale(request: r)`;
  const valRes = await rpc("tools/call", { name: "validate_integration", arguments: { code: badCode } });
  const valText = valRes?.result?.content?.[0]?.text ?? "";
  const hasIssues = valText.includes("Incorrect") || valText.includes("Missing") || valText.includes("issue");
  hasIssues ? pass("Flags bad code patterns") : fail("validate_integration", valText.slice(0, 80));
  if (hasIssues) {
    const first = valText.split("\n").find((l) => /^\d+\./.test(l));
    if (first) info(`First: ${first.trim()}`);
  }

  // 11. get_info_plist_requirements
  section("11. Tool: get_info_plist_requirements");
  const plistRes = await rpc("tools/call", { name: "get_info_plist_requirements", arguments: {} });
  const plistText = plistRes?.result?.content?.[0]?.text ?? "";
  plistText.includes("NSBluetoothAlwaysUsageDescription")
    ? pass("Returns BLE Info.plist XML")
    : fail("get_info_plist_requirements", plistText.slice(0, 80));

  // 12. Resource: api-reference
  section("12. Resource: path://api-reference");
  const apiRes = await rpc("resources/read", { uri: "path://api-reference" });
  const apiText = apiRes?.result?.contents?.[0]?.text ?? "";
  apiText.includes("PathTerminal") && apiText.includes("TransactionRequest") && apiText.includes("PathError")
    ? pass(`API reference: ${(apiText.length / 1024).toFixed(1)} KB`)
    : fail("api-reference", apiText.slice(0, 80) || JSON.stringify(apiRes?.error));

  // 13. Resource: examples/sale
  section("13. Resource: path://examples/sale");
  const saleExRes = await rpc("resources/read", { uri: "path://examples/sale" });
  const saleExText = saleExRes?.result?.contents?.[0]?.text ?? "";
  saleExText.includes("RequestEnvelope.create") && saleExText.includes("TransactionRequest.sale")
    ? pass("Sale example has correct API patterns")
    : fail("examples/sale", saleExText.slice(0, 80));

  // 14. Resource: integration-checklist
  section("14. Resource: path://integration-checklist");
  const clRes = await rpc("resources/read", { uri: "path://integration-checklist" });
  const clText = clRes?.result?.contents?.[0]?.text ?? "";
  const checkboxCount = (clText.match(/- \[/g) ?? []).length;
  checkboxCount > 10
    ? pass(`Checklist: ${checkboxCount} checkboxes`)
    : fail("integration-checklist", clText.slice(0, 80));

  // 15. Prompt: integrate-path-sale
  section("15. Prompt: integrate-path-sale");
  const salePrompt = await rpc("prompts/get", {
    name: "integrate-path-sale",
    arguments: { project_type: "swiftui" },
  });
  const saleMsg = salePrompt?.result?.messages?.[0]?.content?.text ?? "";
  saleMsg.includes("get_code_example") && saleMsg.includes("validate_integration")
    ? pass("Prompt references correct MCP tools")
    : fail("integrate-path-sale", saleMsg.slice(0, 80) || JSON.stringify(salePrompt?.error));

  // 16. Prompt: diagnose-path-error
  section("16. Prompt: diagnose-path-error");
  const diagPrompt = await rpc("prompts/get", {
    name: "diagnose-path-error",
    arguments: { error_code: "timeout", context: "happens during refund" },
  });
  const diagMsg = diagPrompt?.result?.messages?.[0]?.content?.text ?? "";
  diagMsg.includes("explain_error") && diagMsg.includes("timeout")
    ? pass("Diagnose prompt wires explain_error correctly")
    : fail("diagnose-path-error", diagMsg.slice(0, 80));

  // 17. Rules download
  section("17. GET /rules");
  const { status: rs, body: rb } = await httpGet("/rules");
  rs === 200 && rb.includes("path-integration")
    ? pass(`Rules file served (${(rb.length / 1024).toFixed(1)} KB)`)
    : rs === 404
      ? info("Rules not found on server — OK for local dev (file lives in path-terminal-init/rules/)")
      : fail("Rules", `HTTP ${rs}`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(52)}`);
  console.log(`  Results: ${passed} passed  |  ${failed} failed`);
  console.log(failed === 0 ? "  🎉 All tests passed — server is ready." : "  ⚠  Some tests failed.");
  console.log(`${"═".repeat(52)}\n`);

  sseReq?.destroy();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("\n  Fatal:", err.message);
  sseReq?.destroy();
  process.exit(1);
});
