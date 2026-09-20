#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CloudScale — Oracle Cloud Setup Script
# Run this ONCE on a fresh Oracle Cloud Ubuntu 22.04 VM (ARM or x86).
#
# Usage:
#   chmod +x scripts/deploy-oracle.sh
#   sudo ./scripts/deploy-oracle.sh
#
# Prerequisites:
#   - Oracle Cloud VM with Ubuntu 22.04
#   - A domain name with a wildcard DNS A record pointing to this VM's public IP
#     e.g.  *.cloudscale.yourdomain.com → <VM_PUBLIC_IP>
#           cloudscale.yourdomain.com   → <VM_PUBLIC_IP>
#   - The .env.production file filled in (copy from .env.production.example)
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit on any error

# ─── Config — Edit These ─────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-cloudscale.yourdomain.com}"     # e.g. cloudscale.example.com
EMAIL="${EMAIL:-you@example.com}"                  # For Let's Encrypt cert
APP_DIR="${APP_DIR:-/opt/cloudscale}"              # Where the app lives
REPO_URL="${REPO_URL:-https://github.com/youruser/cloudscale.git}"
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     CloudScale — Oracle Cloud Production Setup       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Domain:  $DOMAIN"
echo "App dir: $APP_DIR"
echo ""

# ─── Step 1: System Updates ───────────────────────────────────────────────────
echo "📦 [1/9] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw

# ─── Step 2: Node.js 20 ──────────────────────────────────────────────────────
echo "📦 [2/9] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node.js $(node --version), npm $(npm --version)"

# ─── Step 3: Docker ──────────────────────────────────────────────────────────
echo "🐳 [3/9] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    # Add current user to docker group
    usermod -aG docker "${SUDO_USER:-ubuntu}"
fi
echo "  Docker $(docker --version)"

# ─── Step 4: PM2 (process manager) ───────────────────────────────────────────
echo "⚙️  [4/9] Installing PM2..."
npm install -g pm2 2>/dev/null
pm2 startup systemd -u "${SUDO_USER:-ubuntu}" --hp "/home/${SUDO_USER:-ubuntu}"

# ─── Step 5: Clone / Update App ──────────────────────────────────────────────
echo "📁 [5/9] Setting up CloudScale app at $APP_DIR..."
if [ -d "$APP_DIR" ]; then
    echo "  Updating existing repo..."
    cd "$APP_DIR" && git pull
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Install dependencies
npm install

# Build the React frontend
npm run build

# Copy production env
if [ -f ".env.production" ]; then
    cp .env.production .env
    echo "  ✅ .env.production loaded"
else
    echo "  ⚠️  WARNING: .env.production not found! Copy from .env.production.example and fill in your keys."
fi

# ─── Step 6: Nginx Configuration ─────────────────────────────────────────────
echo "🌐 [6/9] Configuring Nginx..."
# Substitute YOUR_DOMAIN placeholder in the nginx config
sed "s/YOUR_DOMAIN/${DOMAIN}/g" nginx/cloudscale.conf > /etc/nginx/sites-available/cloudscale
ln -sf /etc/nginx/sites-available/cloudscale /etc/nginx/sites-enabled/cloudscale
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# ─── Step 7: SSL Certificate ─────────────────────────────────────────────────
echo "🔐 [7/9] Issuing wildcard SSL certificate for *.${DOMAIN}..."
echo ""
echo "  This requires a DNS TXT challenge. Certbot will show you the TXT record"
echo "  to add to your DNS provider. Add it, wait ~60s, then press Enter."
echo ""
certbot certonly \
    --manual \
    --preferred-challenges dns \
    -d "${DOMAIN}" \
    -d "*.${DOMAIN}" \
    --agree-tos \
    --no-eff-email \
    --email "${EMAIL}"

# Auto-renew via cron
echo "0 12 * * * root certbot renew --quiet && systemctl reload nginx" >> /etc/cron.d/certbot-renew

# Start/reload nginx
systemctl enable nginx
systemctl restart nginx
echo "  ✅ Nginx + SSL configured"

# ─── Step 8: Oracle Cloud Firewall ───────────────────────────────────────────
echo "🔥 [8/9] Configuring Oracle Cloud iptables firewall rules..."
# Oracle Cloud VMs use iptables, not ufw by default
# Allow HTTP, HTTPS, and the Node.js port
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT
iptables -I INPUT -p tcp --dport 8000 -j ACCEPT
# Save rules so they persist across reboots
apt-get install -y iptables-persistent
netfilter-persistent save
echo "  ✅ Ports 80, 443, 8000 opened"
echo ""
echo "  ⚠️  IMPORTANT: Also open these ports in the Oracle Cloud Console:"
echo "     Security Lists → Ingress Rules → Add: TCP 80, 443, 8000"

# ─── Step 9: Start App with PM2 ──────────────────────────────────────────────
echo "🚀 [9/9] Starting CloudScale with PM2..."
cd "$APP_DIR"

# Create PM2 ecosystem config
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'cloudscale',
    script: 'server.ts',
    interpreter: 'tsx',
    env: {
      NODE_ENV: 'production',
      USE_DOCKER: 'true',
    },
    max_memory_restart: '1G',
    restart_delay: 3000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
EOF

pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║            ✅ CloudScale is Live!                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  App URL:      https://${DOMAIN}"
echo "  Deployments:  https://<id>.${DOMAIN}"
echo ""
echo "  Useful commands:"
echo "    pm2 logs cloudscale     — view live logs"
echo "    pm2 restart cloudscale  — restart server"
echo "    pm2 status              — check status"
echo ""
