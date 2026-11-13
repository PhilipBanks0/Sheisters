#!/usr/bin/env bash
# One-time BanksCloud setup for Sheisters. Safe to run again.
#   bash ~/setup-sheisters.sh
# Asks for the sudo password for: the app folder, the nginx site, and the SSL certificate.
set -euo pipefail

APP=sheisters
DIR=/var/www/$APP
PORT=3010
DOMAIN=sheisters.bomberboys.us
REPO=https://github.com/PhilipBanks0/Sheisters.git
APPS=/opt/webhook/apps.json

echo "== 1/5 App folder"
if [ ! -d "$DIR/.git" ]; then
  sudo mkdir -p "$DIR" && sudo chown "$USER:$USER" "$DIR"
  git clone "$REPO" "$DIR"
else
  git -C "$DIR" pull origin main
fi

echo "== 2/5 PM2 process on port $PORT"
if pm2 describe "$APP" >/dev/null 2>&1; then
  pm2 restart "$APP" --update-env
else
  PORT=$PORT pm2 start "$DIR/serve.js" --name "$APP" --cwd "$DIR"
fi
pm2 save

echo "== 3/5 Auto-deploy list"
cp "$APPS" "$HOME/apps.json.before-$APP"
node - "$APPS" <<'EOF'
const fs = require('fs'), P = process.argv[2], apps = JSON.parse(fs.readFileSync(P, 'utf8'));
if (!apps['PhilipBanks0/Sheisters']) {
  apps['PhilipBanks0/Sheisters'] = { name: 'sheisters', dir: '/var/www/sheisters', branch: 'main', install: false, pm2: 'sheisters' };
  fs.writeFileSync(P, JSON.stringify(apps, null, 2) + '\n');
  console.log('added to apps.json');
} else console.log('already in apps.json');
EOF

echo "== 4/5 Nginx site"
if [ ! -f /etc/nginx/sites-available/$APP ]; then
  sudo tee /etc/nginx/sites-available/$APP >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
    }
}
EOF
  sudo ln -sf /etc/nginx/sites-available/$APP /etc/nginx/sites-enabled/$APP
fi
sudo nginx -t && sudo systemctl reload nginx

echo "== 5/5 SSL certificate"
if getent hosts "$DOMAIN" >/dev/null; then
  sudo certbot --nginx -d "$DOMAIN" --redirect -n \
    || echo "!! certbot failed. In Cloudflare, switch the $DOMAIN record to 'DNS only' (grey cloud), run this script again, then switch it back."
else
  echo "!! $DOMAIN does not resolve yet. Add the DNS record (copy the driz record in Cloudflare), then run this script again."
fi

echo
curl -s -o /dev/null -w "local check: http %{http_code}\n" "http://127.0.0.1:$PORT/"
echo "Done. https://$DOMAIN"
