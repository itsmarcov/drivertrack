#!/bin/bash
# ==============================================================
# DriverTRACK - Deployment Script for Ubuntu/Debian VPS
# ==============================================================
set -euo pipefail

APP_NAME="drivertrack"
APP_DIR="$HOME/$APP_NAME"
NODE_VERSION="20"

echo "==============================="
echo " DriverTRACK Deployment Script"
echo "==============================="

# --- 1. Update system ---
echo "[1/8] Updating system packages..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq

# --- 2. Install Node.js ---
echo "[2/8] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

# --- 3. Install PM2 ---
echo "[3/8] Installing PM2..."
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi
echo "  PM2: $(pm2 -v)"

# --- 4. Install Nginx ---
echo "[4/8] Installing Nginx..."
if ! command -v nginx &>/dev/null; then
  sudo apt-get install -y -qq nginx
fi

# --- 5. Clone or pull project ---
if [ -d "$APP_DIR" ]; then
  echo "[5/8] Updating project..."
  cd "$APP_DIR" && git pull
else
  echo "[5/8] Cloning project..."
  git clone <YOUR_REPO_URL> "$APP_DIR"
  cd "$APP_DIR"
fi

# --- 6. Install dependencies & build frontend ---
echo "[6/8] Installing dependencies..."
cd "$APP_DIR/backend" && npm install --omit=dev
cd "$APP_DIR/frontend" && npm install && npm run build

# --- 7. Setup Nginx proxy ---
echo "[7/8] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
echo "  Nginx configured"

# --- 8. Start with PM2 ---
echo "[8/8] Starting application with PM2..."
cd "$APP_DIR"
pm2 start ecosystem.config.js --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "==============================="
echo " Deployment Complete!"
echo "==============================="
echo ""
echo "  Access the app at: http://$(curl -s ifconfig.me)"
echo ""
echo "  Manage:"
echo "    pm2 status              - check status"
echo "    pm2 logs drivertrack    - view logs"
echo "    pm2 restart drivertrack - restart"
echo "==============================="
