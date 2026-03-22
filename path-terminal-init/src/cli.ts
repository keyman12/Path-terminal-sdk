#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import ora from "ora";

const SDK_GITHUB_URL = "https://github.com/keyman12/path-terminal-sdk";
const SDK_VERSION = "0.1.0"; // minimum version to reference
const MCP_SERVER_URL = "https://mcp.path2ai.tech/sse";

const RULES_SOURCE = path.join(__dirname, "../rules/path-integration.mdc");

// ─── Utilities ───────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function findXcodeProject(dir: string): string | null {
  const entries = fs.readdirSync(dir);
  const proj = entries.find(
    (e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace")
  );
  return proj ? path.join(dir, proj) : null;
}

function findPackageSwift(dir: string): string | null {
  const p = path.join(dir, "Package.swift");
  return fs.existsSync(p) ? p : null;
}

function hasSDKDependency(packageSwift: string): boolean {
  const content = fs.readFileSync(packageSwift, "utf-8");
  return content.includes("path-terminal-sdk") || content.includes("PathTerminalSDK");
}

function injectSPMDependency(packageSwiftPath: string): boolean {
  let content = fs.readFileSync(packageSwiftPath, "utf-8");

  // Already present?
  if (hasSDKDependency(packageSwiftPath)) return false;

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

function writeMcpConfig(dir: string): { written: boolean; merged: boolean } {
  const cursorDir = path.join(dir, ".cursor");
  const configPath = path.join(cursorDir, "mcp.json");

  fs.mkdirSync(cursorDir, { recursive: true });

  const pathEntry = {
    "path-terminal": { url: MCP_SERVER_URL },
  };

  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (!existing.mcpServers) existing.mcpServers = {};
      if (existing.mcpServers["path-terminal"]) {
        return { written: false, merged: false }; // already present
      }
      existing.mcpServers["path-terminal"] = pathEntry["path-terminal"];
      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), "utf-8");
      return { written: true, merged: true };
    } catch {
      // File exists but is not valid JSON — don't overwrite
      return { written: false, merged: false };
    }
  }

  const config = { mcpServers: pathEntry };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  return { written: true, merged: false };
}

function writeRulesFile(dir: string): { written: boolean; skipped: boolean } {
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

function checkInfoPlist(dir: string): string[] {
  const issues: string[] = [];
  const plistFiles: string[] = [];

  function findPlists(d: string, depth: number = 0) {
    if (depth > 4) return;
    const entries = fs.readdirSync(d);
    for (const e of entries) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const full = path.join(d, e);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) findPlists(full, depth + 1);
      else if (e === "Info.plist") plistFiles.push(full);
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

function printSummary(actions: string[], warnings: string[], manualSteps: string[]) {
  console.log("\n" + chalk.bold("─────────────────────────────────────────"));
  console.log(chalk.bold("  Path Terminal SDK — Setup Complete"));
  console.log(chalk.bold("─────────────────────────────────────────\n"));

  if (actions.length > 0) {
    console.log(chalk.green("✓ Done:"));
    actions.forEach((a) => console.log(chalk.green(`  • ${a}`)));
    console.log();
  }

  if (manualSteps.length > 0) {
    console.log(chalk.yellow("⚠ Manual steps required:"));
    manualSteps.forEach((s, i) => console.log(chalk.yellow(`  ${i + 1}. ${s}`)));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(chalk.dim("ℹ Notes:"));
    warnings.forEach((w) => console.log(chalk.dim(`  • ${w}`)));
    console.log();
  }

  console.log(chalk.bold("🚀 Your first prompt in Cursor:"));
  console.log(
    chalk.cyan(
      '  "Use the Path MCP tools to integrate a sale flow into this app."'
    )
  );
  console.log();
  console.log(chalk.dim(`  MCP server: ${MCP_SERVER_URL}`));
  console.log(chalk.dim("  Docs:       https://mcp.path2ai.tech/health"));
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

program
  .name("path-terminal-init")
  .description(
    "Set up the Path Terminal SDK integration assistant for your iOS project.\n" +
      "Configures MCP server access in Cursor, drops the integration rules file,\n" +
      "and optionally adds the SDK as an SPM dependency."
  )
  .version("0.1.0")
  .option("--tools-only", "Only configure MCP + rules. Skip SDK installation and Xcode project setup.")
  .option("--agent <name>", "AI agent to configure (default: cursor). Currently only 'cursor' is supported.", "cursor")
  .action(async (options) => {
    const toolsOnly: boolean = options.toolsOnly ?? false;
    const agent: string = options.agent ?? "cursor";
    const cwd = process.cwd();

    console.log();
    console.log(chalk.bold("  Path Terminal SDK — Integration Assistant Setup"));
    console.log(chalk.dim("  ─────────────────────────────────────────────────"));
    console.log();

    if (agent !== "cursor") {
      console.log(
        chalk.yellow(
          `⚠ Agent '${agent}' is not yet supported. Currently only 'cursor' is configured.`
        )
      );
      console.log(chalk.dim("  More agents coming soon.\n"));
    }

    const actions: string[] = [];
    const warnings: string[] = [];
    const manualSteps: string[] = [];

    // ── 1. SDK installation ───────────────────────────────────────────────────
    if (!toolsOnly) {
      const spinner = ora("Checking for Xcode project…").start();

      const xcodeProject = findXcodeProject(cwd);
      const packageSwift = findPackageSwift(cwd);

      if (packageSwift) {
        spinner.text = "Found Package.swift — adding PathTerminalSDK dependency…";
        if (hasSDKDependency(packageSwift)) {
          spinner.succeed("PathTerminalSDK already present in Package.swift.");
          actions.push("PathTerminalSDK dependency already present — no change needed.");
        } else {
          const injected = injectSPMDependency(packageSwift);
          if (injected) {
            spinner.succeed("PathTerminalSDK added to Package.swift.");
            actions.push("PathTerminalSDK added to Package.swift");
            manualSteps.push(
              `Open Xcode and select the PathTerminalSDK and PathEmulatorAdapter targets when prompted.`
            );
          } else {
            spinner.warn("Could not automatically modify Package.swift — manual step required.");
            manualSteps.push(
              `Add PathTerminalSDK manually to Package.swift:\n` +
                `     .package(url: "${SDK_GITHUB_URL}", from: "${SDK_VERSION}")`
            );
          }
        }
      } else if (xcodeProject) {
        spinner.succeed(`Found Xcode project: ${path.basename(xcodeProject)}`);
        console.log(
          chalk.yellow(
            "\n  ⚠ Automatic SPM injection into .xcodeproj is not supported (Xcode manages this)."
          )
        );
        console.log(chalk.bold("\n  To add PathTerminalSDK in Xcode:"));
        console.log("  1. Open your project in Xcode");
        console.log("  2. File → Add Package Dependencies…");
        console.log(`  3. Enter URL: ${chalk.cyan(SDK_GITHUB_URL)}`);
        console.log(
          "  4. Select both PathTerminalSDK and PathEmulatorAdapter targets"
        );
        console.log("  5. Click Add Package\n");
        const confirmed = await ask(
          chalk.bold("  Press Enter once you have added the package, or type 'skip' to do this later: ")
        );
        if (confirmed.toLowerCase() !== "skip") {
          actions.push(`PathTerminalSDK added to Xcode project (confirmed by user)`);
        } else {
          manualSteps.push(
            `Add PathTerminalSDK via Xcode: File → Add Package Dependencies → ${SDK_GITHUB_URL}`
          );
        }
      } else {
        spinner.warn("No Xcode project found in current directory.");
        const answer = await ask(
          chalk.yellow(
            "  No .xcodeproj or Package.swift found. Continue with tools-only setup? (y/n): "
          )
        );
        if (answer.toLowerCase() !== "y") {
          console.log(
            chalk.dim("\n  Run this command from your Xcode project directory, or use --tools-only.\n")
          );
          process.exit(0);
        }
        warnings.push("Ran in tools-only mode — no Xcode project found.");
      }
    } else {
      actions.push("Skipped SDK installation (--tools-only mode)");
    }

    // ── 2. MCP config ─────────────────────────────────────────────────────────
    {
      const spinner = ora("Writing MCP server config…").start();
      const { written, merged } = writeMcpConfig(cwd);
      if (written && merged) {
        spinner.succeed("MCP config merged into existing .cursor/mcp.json.");
        actions.push("path-terminal entry merged into .cursor/mcp.json");
      } else if (written) {
        spinner.succeed("MCP config written to .cursor/mcp.json.");
        actions.push("MCP server configured: .cursor/mcp.json");
      } else {
        spinner.info("MCP config already present — no change needed.");
        actions.push("MCP config already present — no change needed.");
      }
    }

    // ── 3. Rules file ─────────────────────────────────────────────────────────
    {
      const spinner = ora("Writing Cursor rules file…").start();
      const { written, skipped } = writeRulesFile(cwd);
      if (written) {
        spinner.succeed("Rules file written to .cursor/rules/path-integration.mdc.");
        actions.push("Integration rules file: .cursor/rules/path-integration.mdc");
      } else if (skipped) {
        spinner.info(
          "Rules file already exists — skipped to preserve your customisations."
        );
        warnings.push(
          ".cursor/rules/path-integration.mdc already exists — not overwritten."
        );
      } else {
        spinner.warn("Could not write rules file — source not found in npm package.");
        manualSteps.push(
          "Download path-integration.mdc manually from: https://mcp.path2ai.tech/rules"
        );
      }
    }

    // ── 4. Info.plist check ───────────────────────────────────────────────────
    if (!toolsOnly) {
      const spinner = ora("Checking Info.plist BLE permissions…").start();
      const plistsWithIssues = checkInfoPlist(cwd);
      if (plistsWithIssues.length === 0) {
        spinner.succeed("BLE permissions found in Info.plist.");
        actions.push("BLE permissions verified in Info.plist");
      } else {
        spinner.warn(
          `NSBluetoothAlwaysUsageDescription missing from ${plistsWithIssues.length} Info.plist file(s).`
        );
        plistsWithIssues.forEach((p) => {
          const relative = path.relative(cwd, p);
          manualSteps.push(
            `Add BLE permission to ${relative}:\n` +
              `     <key>NSBluetoothAlwaysUsageDescription</key>\n` +
              `     <string>This app connects to a Path payment terminal via Bluetooth.</string>\n` +
              `     (Ask the MCP: "get_info_plist_requirements" for the full XML)`
          );
        });
      }
    }

    // ── 5. Summary ────────────────────────────────────────────────────────────
    printSummary(actions, warnings, manualSteps);
  });

program.parse(process.argv);
