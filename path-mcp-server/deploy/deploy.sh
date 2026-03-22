#!/bin/bash
# deploy.sh — Deploy or update the Path MCP Server on EC2.
# Run from the app directory: /home/ec2-user/path-mcp-server
# Pulls latest code, builds, and restarts PM2.

set -e

APP_DIR="/home/ec2-user/path-mcp-server"
PM2_APP_NAME="path-mcp-server"

echo "──────────────────────────────────────────"
echo "  Path MCP Server — Deploy"
echo "──────────────────────────────────────────"

# Load nvm
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

cd "$APP_DIR"

# ── Pull latest code ─────────────────────────────────────────────────────────
echo "→ Pulling latest code..."
git pull origin main

# ── Install dependencies ─────────────────────────────────────────────────────
echo "→ Installing dependencies..."
npm ci

# ── Build (esbuild — fast transpile) ─────────────────────────────────────────
echo "→ Building..."
npm run build

# ── Restart or start PM2 ─────────────────────────────────────────────────────
echo "→ Restarting PM2 process..."
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start dist/index.js --name "$PM2_APP_NAME" --env production
fi

pm2 save

echo ""
echo "✓ Deploy complete."
echo "  Health check: curl https://mcp.path2ai.tech/health"
