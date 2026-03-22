#!/bin/bash
# First-time setup script for Ubuntu (EC2)
# Working directory: /home/ubuntu/driveSelfHosting
set -e

DEPLOY_ROOT=/home/ubuntu/driveSelfHosting

echo "🚀 Setting up Self-Hosted File Server on Ubuntu (EC2)..."

# 1. Install system dependencies
echo "📦 Installing dependencies..."
sudo apt update -y
sudo apt install -y curl gnupg2

# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL, Redis, ffmpeg, nginx, pm2
sudo apt install -y postgresql postgresql-contrib redis-server ffmpeg nginx
sudo npm install -g pm2

# 2. Start and enable services
echo "🗄️ Starting PostgreSQL and Redis..."
sudo systemctl enable postgresql redis-server
sudo systemctl start postgresql redis-server
sleep 2

# 3. Setup environment
echo "⚙️ Setting up environment..."
if [ ! -f "$DEPLOY_ROOT/backend/.env" ]; then
    cp "$DEPLOY_ROOT/backend/.env.example" "$DEPLOY_ROOT/backend/.env"
    echo "⚠️  Please edit backend/.env with your configuration"
fi

# 4. Install backend dependencies
echo "📥 Installing backend dependencies..."
cd "$DEPLOY_ROOT/backend"
npm install --omit=dev

# 5. Create DB user and database
echo " Creating database user and database..."
source "$DEPLOY_ROOT/backend/.env"
sudo -u postgres psql -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# 6. Initialize database schema
echo "🔧 Setting up database schema..."
cd "$DEPLOY_ROOT/backend"
npm run sync-db

# 7. Create storage directories
echo "📁 Creating storage directories..."
mkdir -p "$DEPLOY_ROOT/backend/storage/files"
mkdir -p "$DEPLOY_ROOT/backend/storage/temp"
mkdir -p "$DEPLOY_ROOT/backend/storage/thumbnails"
mkdir -p "$DEPLOY_ROOT/backend/storage/assets"

# 8. Setup Nginx config
echo "🌐 Setting up Nginx..."
sudo cp "$DEPLOY_ROOT/deployEc2/nginx-drive.shubnit.com.conf" /etc/nginx/sites-available/drive.shubnit.com
sudo ln -sf /etc/nginx/sites-available/drive.shubnit.com /etc/nginx/sites-enabled/drive.shubnit.com
sudo chmod -R 755 "$DEPLOY_ROOT/frontend/dist"
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configured"

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit $DEPLOY_ROOT/backend/.env with your settings"
echo "2. Make sure DNS A record for drive.shubnit.com points to this EC2 IP"
echo "3. Run: sudo certbot --nginx -d drive.shubnit.com"
echo "4. Run: bash $DEPLOY_ROOT/deployEc2/start-server.sh"
