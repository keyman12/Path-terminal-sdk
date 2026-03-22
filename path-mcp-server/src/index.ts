import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";
import { registerPrompts } from "./prompts.js";

const PORT = parseInt(process.env.PORT ?? "3005", 10);

const app = express();
app.use(cors());

// Active SSE transports — one per connected client
const transports: Map<string, SSEServerTransport> = new Map();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "path-terminal-integration",
    version: "0.1.0",
  });

  registerResources(server);
  registerTools(server);
  registerPrompts(server);

  return server;
}

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "path-terminal-mcp-server",
    version: "0.1.0",
    clients: transports.size,
    endpoints: {
      sse: "/sse",
      messages: "/messages",
      health: "/health",
      rules: "/rules",
    },
  });
});

// Serve the Cursor rules file for manual download
app.get("/rules", (_req, res) => {
  const rulesPath = path.join(__dirname, "../../path-terminal-init/rules/path-integration.mdc");
  if (fs.existsSync(rulesPath)) {
    res.setHeader("Content-Type", "text/markdown");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="path-integration.mdc"'
    );
    res.send(fs.readFileSync(rulesPath, "utf-8"));
  } else {
    res.status(404).json({ error: "Rules file not found on this server." });
  }
});

// SSE endpoint — each GET creates a new MCP session.
// The MCP SDK's SSEServerTransport calls res.writeHead() itself — do NOT set
// headers or call flushHeaders() here. Just pass the raw res object.
app.get("/sse", async (req, res) => {
  // Tell nginx not to buffer (must be set before the SDK calls writeHead)
  res.setHeader("X-Accel-Buffering", "no");

  const transport = new SSEServerTransport("/messages", res);
  // Key by the SDK's own sessionId (exposed via public getter)
  transports.set(transport.sessionId, transport);

  const server = createMcpServer();
  await server.connect(transport);

  req.on("close", () => {
    transports.delete(transport.sessionId);
    transport.close().catch(() => {});
  });
});

// Messages endpoint — client POSTs here with ?sessionId= from the SSE endpoint event.
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;

  let transport: SSEServerTransport | undefined;

  if (sessionId) {
    transport = transports.get(sessionId);
  }

  // Fallback for single-client dev/test: use the only active transport
  if (!transport && transports.size === 1) {
    transport = transports.values().next().value;
  }

  if (!transport) {
    res.status(404).json({ error: "No active SSE session found. Connect via /sse first." });
    return;
  }

  try {
    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error("Error handling message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Path Terminal MCP Server running on port ${PORT}`);
  console.log(`  SSE endpoint:    http://localhost:${PORT}/sse`);
  console.log(`  Messages:        http://localhost:${PORT}/messages`);
  console.log(`  Health check:    http://localhost:${PORT}/health`);
  console.log(`  Rules download:  http://localhost:${PORT}/rules`);
});
