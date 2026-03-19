#!/bin/bash
# First-time setup script for Android/Termux
DEPLOY_ROOT=$(pwd)

echo "🚀 Setting up Self-Hosted File Server on Android..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
pkg update -y
pkg install -y nodejs postgresql redis ffmpeg nginx
# pkg install -y nodejs redis

# # 2. Initialize PostgreSQL
echo "🗄️ Initializing PostgreSQL..."
initdb $PREFIX/var/lib/postgresql
pg_ctl -D $PREFIX/var/lib/postgresql start
sleep 2


# 4. Install backend dependencies
echo "📥 Installing backend dependencies..."
cd backend
npm install --production

# 5. Setup environment
echo "⚙️ Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your configuration"
fi
# 6. Create postgres superuser (skip if already exists) and  Create DB user and database
echo "🔑 Creating postgres superuser..."
psql -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname='postgres';" | grep -q 1 || \
    createuser --superuser postgres 2>/dev/null || true


echo "👤 Creating database user and database..."
source .env
psql -d postgres -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
psql -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
# 7. Initialize database schema
echo "🔧 Setting up database schema..."
npm run sync-db

# 8. Create storage directories
echo "📁 Creating storage directories..."
mkdir -p storage/files storage/temp storage/thumbnails

# 9. Setup Nginx config
echo "🌐 Setting up Nginx..."
sed "s|FRONTEND_DIST_PATH|$DEPLOY_ROOT/frontend/dist|g" "$DEPLOY_ROOT/deploy/nginx.conf" > $PREFIX/etc/nginx/nginx.conf
echo "✅ Nginx configured"

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your settings"
echo "2. Run: ./deploy/start-server.sh"
