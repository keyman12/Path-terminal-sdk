#!/bin/bash
# setup.sh — Run ONCE on a fresh AWS EC2 Amazon Linux 2023 instance.
# Installs Node.js (via nvm), PM2, nginx, and certbot.
# Run as ec2-user with sudo available.

set -e

DOMAIN="mcp.path2ai.tech"
APP_DIR="/home/ec2-user/path-mcp-server"
NODE_VERSION="20"

echo "──────────────────────────────────────────"
echo "  Path MCP Server — Fresh EC2 Setup"
echo "  Domain: $DOMAIN"
echo "──────────────────────────────────────────"
echo ""

# ── System updates ──────────────────────────────────────────────────────────
echo "→ Updating system packages..."
sudo dnf update -y

# ── Node.js via nvm ─────────────────────────────────────────────────────────
echo "→ Installing nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

echo "→ Installing Node.js $NODE_VERSION LTS..."
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
nvm use default

echo "Node version: $(node --version)"
echo "npm version:  $(npm --version)"

# Add nvm to .bashrc for future shells
{
  echo 'export NVM_DIR="$HOME/.nvm"'
  echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
} >> "$HOME/.bashrc"

# ── PM2 ─────────────────────────────────────────────────────────────────────
echo "→ Installing PM2..."
npm install -g pm2

# Configure PM2 to start on boot
sudo env PATH="$PATH:/home/ec2-user/.nvm/versions/node/v${NODE_VERSION}.x/bin" \
  pm2 startup systemd -u ec2-user --hp /home/ec2-user

# ── nginx ───────────────────────────────────────────────────────────────────
echo "→ Installing nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx

# ── certbot ─────────────────────────────────────────────────────────────────
echo "→ Installing certbot..."
sudo dnf install -y python3-certbot-nginx augeas-libs
sudo pip3 install certbot certbot-nginx

# ── App directory ────────────────────────────────────────────────────────────
echo "→ Creating app directory: $APP_DIR"
mkdir -p "$APP_DIR"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────"
echo "  Setup complete. Next steps:"
echo ""
echo "  1. Point the DNS A record for $DOMAIN to this EC2 IP"
echo "  2. Clone your repo to $APP_DIR"
echo "  3. Run: cd $APP_DIR && npm install && npm run build"
echo "  4. Copy deploy/nginx.conf to /etc/nginx/conf.d/path-mcp.conf"
echo "  5. Run: sudo systemctl start nginx"
echo "  6. Run: sudo certbot --nginx -d $DOMAIN"
echo "  7. Run: pm2 start dist/index.js --name path-mcp-server"
echo "  8. Run: pm2 save"
echo "  9. Test: curl https://$DOMAIN/health"
echo "──────────────────────────────────────────"
