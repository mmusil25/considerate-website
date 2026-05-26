#!/bin/bash
set -e

apt-get update
apt-get install -y curl git build-essential nginx

# Install nvm
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install pm2 for process management
npm install -g pm2

# Clone repo into /var/www/portfolio
git clone https://github.com/mmusil25/considerate-website.git /var/www/portfolio
cd /var/www/portfolio

# Navigate to app directory where package.json actually lives
cd app

# Set environment variables
cat > .env << EOF
DATABASE_URL=postgresql://${db_user}:${db_password}@${db_host}/${db_name}
NODE_ENV=production
PAYLOAD_SECRET=$(openssl rand -base64 32)
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000
EOF

# Install and build
npm install
npx payload generate:importmap
npm run build
NODE_ENV=production npx payload migrate

# Start with PM2 (from app directory)
pm2 start npm --name "portfolio" -- start
pm2 startup
pm2 save

# --- Reverse proxy: nginx on port 80 -> Next.js on 127.0.0.1:3000 ---
# Note: nginx vars below use $word (no braces), so Terraform's templatefile()
# leaves them untouched; only ${...} sequences are interpolated by Terraform.

# Map needed so WebSocket/HMR upgrade headers proxy correctly
cat > /etc/nginx/conf.d/upgrade-map.conf << 'MAP_EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
MAP_EOF

cat > /etc/nginx/sites-available/portfolio << 'NGINX_EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Allow Payload media uploads
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/portfolio
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx