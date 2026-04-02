#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const ora_1 = __importDefault(require("ora"));
const SDK_GITHUB_URL = "https://github.com/keyman12/path-terminal-sdk";
const SDK_VERSION = "0.1.0"; // minimum version to reference
const MCP_SERVER_URL = "https://mcp.path2ai.tech/sse";
const RULES_SOURCE = path.join(__dirname, "../rules/path-integration.mdc");
// ─── Utilities ───────────────────────────────────────────────────────────────
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
function findXcodeProject(dir) {
    const entries = fs.readdirSync(dir);
    const proj = entries.find((e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace"));
    return proj ? path.join(dir, proj) : null;
}
function findPackageSwift(dir) {
    const p = path.join(dir, "Package.swift");
    return fs.existsSync(p) ? p : null;
}
function hasSDKDependency(packageSwift) {
    const content = fs.readFileSync(packageSwift, "utf-8");
    return content.includes("path-terminal-sdk") || content.includes("PathTerminalSDK");
}
function hasXcodeProjectSDKDependency(xcodeProject) {
    // Xcode stores resolved SPM packages in the workspace's Package.resolved
    const resolvedPaths = [
        path.join(xcodeProject, "project.xcworkspace", "xcshareddata", "swiftpm", "Package.resolved"),
        path.join(xcodeProject, "xcshareddata", "swiftpm", "Package.resolved"),
    ];
    for (const p of resolvedPaths) {
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, "utf-8");
            if (content.includes("path-terminal-sdk") || content.includes("PathTerminalSDK")) {
                return true;
            }
        }
    }
    return false;
}
function injectSPMDependency(packageSwiftPath) {
    let content = fs.readFileSync(packageSwiftPath, "utf-8");
    // Already present?
    if (hasSDKDependency(packageSwiftPath))
        return false;
    // Add the package dependency — find the dependencies: [ array
    const depsRegex = /(dependencies:\s*\[)/;
    if (!depsRegex.test(content)) {
        return false; // Can't safely inject — structure not recognised
    }
    const depEntry = `\n        .package(url: "${SDK_GITHUB_URL}", from: "${SDK_VERSION}"),`;
    content = content.replace(depsRegex, `$1${depEntry}`);
    fs.writeFileSync(packageSwiftPath, content, "utf-8");
    return true;
}
// ─── Cursor-specific config ──────────────────────────────────────────────────
function writeCursorMcpConfig(dir) {
    const cursorDir = path.join(dir, ".cursor");
    const configPath = path.join(cursorDir, "mcp.json");
    fs.mkdirSync(cursorDir, { recursive: true });
    const pathEntry = {
        "path-terminal": { url: MCP_SERVER_URL },
    };
    if (fs.existsSync(configPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            if (!existing.mcpServers)
                existing.mcpServers = {};
            if (existing.mcpServers["path-terminal"]) {
                return { written: false, merged: false }; // already present
            }
            existing.mcpServers["path-terminal"] = pathEntry["path-terminal"];
            fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), "utf-8");
            return { written: true, merged: true };
        }
        catch {
            // File exists but is not valid JSON — don't overwrite
            return { written: false, merged: false };
        }
    }
    const config = { mcpServers: pathEntry };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return { written: true, merged: false };
}
function writeCursorRulesFile(dir) {
    const rulesDir = path.join(dir, ".cursor", "rules");
    const destPath = path.join(rulesDir, "path-integration.mdc");
    fs.mkdirSync(rulesDir, { recursive: true });
    if (fs.existsSync(destPath)) {
        return { written: false, skipped: true };
    }
    if (!fs.existsSync(RULES_SOURCE)) {
        return { written: false, skipped: false };
    }
    fs.copyFileSync(RULES_SOURCE, destPath);
    return { written: true, skipped: false };
}
// ─── Claude Code-specific config ─────────────────────────────────────────────
function writeClaudeMcpConfig(dir) {
    // Claude Code reads .mcp.json at the project root (same mcpServers format as Cursor)
    const configPath = path.join(dir, ".mcp.json");
    const serverEntry = {
        type: "sse",
        url: MCP_SERVER_URL,
    };
    if (fs.existsSync(configPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            if (!existing.mcpServers)
                existing.mcpServers = {};
            if (existing.mcpServers["path-terminal"]) {
                return { written: false, merged: false }; // already present
            }
            existing.mcpServers["path-terminal"] = serverEntry;
            fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), "utf-8");
            return { written: true, merged: true };
        }
        catch {
            return { written: false, merged: false };
        }
    }
    const config = {
        mcpServers: {
            "path-terminal": serverEntry,
        },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return { written: true, merged: false };
}
function writeClaudeRulesFile(dir) {
    const destPath = path.join(dir, "CLAUDE.md");
    // Don't overwrite an existing CLAUDE.md — it may have custom instructions
    if (fs.existsSync(destPath)) {
        const content = fs.readFileSync(destPath, "utf-8");
        if (content.includes("Path Terminal SDK")) {
            return { written: false, skipped: true };
        }
        // Append to existing CLAUDE.md
        const rules = loadRulesContent();
        if (!rules)
            return { written: false, skipped: false };
        fs.appendFileSync(destPath, "\n\n" + rules, "utf-8");
        return { written: true, skipped: false };
    }
    const rules = loadRulesContent();
    if (!rules)
        return { written: false, skipped: false };
    fs.writeFileSync(destPath, rules, "utf-8");
    return { written: true, skipped: false };
}
function loadRulesContent() {
    if (!fs.existsSync(RULES_SOURCE))
        return null;
    const raw = fs.readFileSync(RULES_SOURCE, "utf-8");
    // Strip the YAML frontmatter (--- ... ---) that Cursor uses
    const stripped = raw.replace(/^---[\s\S]*?---\s*/, "");
    return stripped.trim();
}
// ─── Shared ──────────────────────────────────────────────────────────────────
function checkInfoPlist(dir) {
    const issues = [];
    const plistFiles = [];
    function findPlists(d, depth = 0) {
        if (depth > 4)
            return;
        const entries = fs.readdirSync(d);
        for (const e of entries) {
            if (e === "node_modules" || e.startsWith("."))
                continue;
            const full = path.join(d, e);
            const stat = fs.statSync(full);
            if (stat.isDirectory())
                findPlists(full, depth + 1);
            else if (e === "Info.plist")
                plistFiles.push(full);
        }
    }
    findPlists(dir);
    for (const plist of plistFiles) {
        const content = fs.readFileSync(plist, "utf-8");
        if (!content.includes("NSBluetoothAlwaysUsageDescription")) {
            issues.push(plist);
        }
    }
    return issues;
}
// ─── Summary helpers ─────────────────────────────────────────────────────────
function printSummary(agent, actions, warnings, manualSteps) {
    console.log("\n" + chalk_1.default.bold("─────────────────────────────────────────"));
    console.log(chalk_1.default.bold("  Path Terminal SDK — Setup Complete"));
    console.log(chalk_1.default.bold("─────────────────────────────────────────\n"));
    if (actions.length > 0) {
        console.log(chalk_1.default.green("✓ Done:"));
        actions.forEach((a) => console.log(chalk_1.default.green(`  • ${a}`)));
        console.log();
    }
    if (manualSteps.length > 0) {
        console.log(chalk_1.default.yellow("⚠ Manual steps required:"));
        manualSteps.forEach((s, i) => console.log(chalk_1.default.yellow(`  ${i + 1}. ${s}`)));
        console.log();
    }
    if (warnings.length > 0) {
        console.log(chalk_1.default.dim("ℹ Notes:"));
        warnings.forEach((w) => console.log(chalk_1.default.dim(`  • ${w}`)));
        console.log();
    }
    if (agent === "claude") {
        console.log(chalk_1.default.bold("🚀 Start Claude Code in this directory:"));
        console.log(chalk_1.default.cyan("  claude --model sonnet"));
        console.log();
        console.log(chalk_1.default.bold("  Then paste this prompt:"));
        console.log(chalk_1.default.cyan('  "Integrate the Path Terminal SDK into this EPOS app. Read CLAUDE.md\n' +
            '   for the integration rules, then use the Path MCP tools to add a\n' +
            '   Path POS Adapter in Settings — allowing the developer to scan for\n' +
            '   and connect to the Path POS Emulator from within the app."'));
    }
    else {
        console.log(chalk_1.default.bold("🚀 Your first prompt in Cursor:"));
        console.log(chalk_1.default.cyan('  "Use the Path MCP tools to integrate a sale flow into this app."'));
    }
    console.log();
    console.log(chalk_1.default.dim(`  MCP server: ${MCP_SERVER_URL}`));
    console.log(chalk_1.default.dim("  Docs:       https://mcp.path2ai.tech/health"));
    console.log();
}
// ─── Main ────────────────────────────────────────────────────────────────────
commander_1.program
    .name("path-terminal-init")
    .description("Set up the Path Terminal SDK integration assistant for your iOS project.\n" +
    "Configures MCP server access, drops the integration rules file,\n" +
    "and optionally adds the SDK as an SPM dependency.\n\n" +
    "Supported agents: cursor (default), claude")
    .version("0.1.0")
    .option("--tools-only", "Only configure MCP + rules. Skip SDK installation and Xcode project setup.")
    .option("--agent <name>", "AI agent to configure: 'cursor' (default) or 'claude'.", "cursor")
    .action(async (options) => {
    const toolsOnly = options.toolsOnly ?? false;
    const agent = (options.agent ?? "cursor");
    const cwd = process.cwd();
    console.log();
    console.log(chalk_1.default.bold("  Path Terminal SDK — Integration Assistant Setup"));
    console.log(chalk_1.default.dim("  ─────────────────────────────────────────────────"));
    console.log(chalk_1.default.dim(`  Agent: ${agent}`));
    console.log();
    if (agent !== "cursor" && agent !== "claude") {
        console.log(chalk_1.default.yellow(`⚠ Agent '${agent}' is not supported. Use 'cursor' or 'claude'.`));
        process.exit(1);
    }
    const actions = [];
    const warnings = [];
    const manualSteps = [];
    // ── 1. SDK installation ───────────────────────────────────────────────────
    if (!toolsOnly) {
        const spinner = (0, ora_1.default)("Checking for Xcode project…").start();
        const xcodeProject = findXcodeProject(cwd);
        const packageSwift = findPackageSwift(cwd);
        if (packageSwift) {
            spinner.text = "Found Package.swift — adding PathTerminalSDK dependency…";
            if (hasSDKDependency(packageSwift)) {
                spinner.succeed("PathTerminalSDK already present in Package.swift.");
                actions.push("PathTerminalSDK dependency already present — no change needed.");
            }
            else {
                const injected = injectSPMDependency(packageSwift);
                if (injected) {
                    spinner.succeed("PathTerminalSDK added to Package.swift.");
                    actions.push("PathTerminalSDK added to Package.swift");
                    manualSteps.push(`Open Xcode and link all three targets to your app: PathTerminalSDK, PathEmulatorAdapter, PathCoreModels.`);
                }
                else {
                    spinner.warn("Could not automatically modify Package.swift — manual step required.");
                    manualSteps.push(`Add PathTerminalSDK manually to Package.swift:\n` +
                        `     .package(url: "${SDK_GITHUB_URL}", from: "${SDK_VERSION}")`);
                }
            }
        }
        else if (xcodeProject) {
            spinner.succeed(`Found Xcode project: ${path.basename(xcodeProject)}`);
            if (hasXcodeProjectSDKDependency(xcodeProject)) {
                spinner.succeed("PathTerminalSDK already present in Xcode project.");
                actions.push("PathTerminalSDK dependency already present — no change needed.");
            }
            else {
                console.log(chalk_1.default.yellow("\n  ⚠ Automatic SPM injection into .xcodeproj is not supported (Xcode manages this)."));
                console.log(chalk_1.default.bold("\n  To add PathTerminalSDK in Xcode:"));
                console.log("  1. Open your project in Xcode");
                console.log("  2. File → Add Package Dependencies…");
                console.log(`  3. Enter URL: ${chalk_1.default.cyan(SDK_GITHUB_URL)}`);
                console.log("  4. In the 'Choose Package Products' dialog, set all three to your app target:");
                console.log(chalk_1.default.cyan("       PathTerminalSDK    → your app target"));
                console.log(chalk_1.default.cyan("       PathEmulatorAdapter → your app target"));
                console.log(chalk_1.default.cyan("       PathCoreModels      → your app target"));
                console.log(chalk_1.default.dim("     (PathDiagnostics can be left as None)"));
                console.log("  5. Click Add Package\n");
                const confirmed = await ask(chalk_1.default.bold("  Press Enter once you have added the package, or type 'skip' to do this later: "));
                if (confirmed.toLowerCase() !== "skip") {
                    actions.push(`PathTerminalSDK added to Xcode project (confirmed by user)`);
                }
                else {
                    manualSteps.push(`Add PathTerminalSDK via Xcode: File → Add Package Dependencies → ${SDK_GITHUB_URL}`);
                }
            }
        }
        else {
            spinner.warn("No Xcode project found in current directory.");
            const answer = await ask(chalk_1.default.yellow("  No .xcodeproj or Package.swift found. Continue with tools-only setup? (y/n): "));
            if (answer.toLowerCase() !== "y") {
                console.log(chalk_1.default.dim("\n  Run this command from your Xcode project directory, or use --tools-only.\n"));
                process.exit(0);
            }
            warnings.push("Ran in tools-only mode — no Xcode project found.");
        }
    }
    else {
        actions.push("Skipped SDK installation (--tools-only mode)");
    }
    // ── 2. MCP config ─────────────────────────────────────────────────────────
    {
        const spinner = (0, ora_1.default)("Writing MCP server config…").start();
        let result;
        let configFile;
        if (agent === "claude") {
            result = writeClaudeMcpConfig(cwd);
            configFile = ".mcp.json";
        }
        else {
            result = writeCursorMcpConfig(cwd);
            configFile = ".cursor/mcp.json";
        }
        if (result.written && result.merged) {
            spinner.succeed(`MCP config merged into existing ${configFile}.`);
            actions.push(`path-terminal entry merged into ${configFile}`);
        }
        else if (result.written) {
            spinner.succeed(`MCP config written to ${configFile}.`);
            actions.push(`MCP server configured: ${configFile}`);
        }
        else {
            spinner.info("MCP config already present — no change needed.");
            actions.push("MCP config already present — no change needed.");
        }
    }
    // ── 3. Rules file ─────────────────────────────────────────────────────────
    {
        const spinner = (0, ora_1.default)(`Writing ${agent === "claude" ? "CLAUDE.md" : "Cursor rules"} file…`).start();
        let result;
        let rulesFile;
        if (agent === "claude") {
            result = writeClaudeRulesFile(cwd);
            rulesFile = "CLAUDE.md";
        }
        else {
            result = writeCursorRulesFile(cwd);
            rulesFile = ".cursor/rules/path-integration.mdc";
        }
        if (result.written) {
            spinner.succeed(`Rules file written to ${rulesFile}.`);
            actions.push(`Integration rules file: ${rulesFile}`);
        }
        else if (result.skipped) {
            spinner.info(`${rulesFile} already exists — skipped to preserve your customisations.`);
            warnings.push(`${rulesFile} already exists — not overwritten.`);
        }
        else {
            spinner.warn("Could not write rules file — source not found in npm package.");
            manualSteps.push("Download path-integration.mdc manually from: https://mcp.path2ai.tech/rules");
        }
    }
    // ── 4. Info.plist check ───────────────────────────────────────────────────
    if (!toolsOnly) {
        const spinner = (0, ora_1.default)("Checking Info.plist BLE permissions…").start();
        const plistsWithIssues = checkInfoPlist(cwd);
        if (plistsWithIssues.length === 0) {
            spinner.succeed("BLE permissions found in Info.plist.");
            actions.push("BLE permissions verified in Info.plist");
        }
        else {
            spinner.warn(`NSBluetoothAlwaysUsageDescription missing from ${plistsWithIssues.length} Info.plist file(s).`);
            plistsWithIssues.forEach((p) => {
                const relative = path.relative(cwd, p);
                manualSteps.push(`Add BLE permission to ${relative}:\n` +
                    `     <key>NSBluetoothAlwaysUsageDescription</key>\n` +
                    `     <string>This app connects to a Path payment terminal via Bluetooth.</string>\n` +
                    `     (Ask the MCP: "get_info_plist_requirements" for the full XML)`);
            });
        }
    }
    // ── 5. Summary ────────────────────────────────────────────────────────────
    printSummary(agent, actions, warnings, manualSteps);
});
commander_1.program.parse(process.argv);
