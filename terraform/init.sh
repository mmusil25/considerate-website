#!/bin/bash
set -e

apt-get update
apt-get install -y curl git build-essential

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