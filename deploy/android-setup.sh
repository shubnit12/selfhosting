#!/bin/bash
# First-time setup script for Android/Termux

echo "🚀 Setting up Self-Hosted File Server on Android..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
pkg update -y
pkg install -y nodejs postgresql redis
# pkg install -y nodejs redis

# # 2. Initialize PostgreSQL
echo "🗄️ Initializing PostgreSQL..."
initdb $PREFIX/var/lib/postgresql
pg_ctl -D $PREFIX/var/lib/postgresql start
sleep 2

# # 3. Create database
echo "📊 Creating database..."
createdb selfhosting_db

# SQLite is included with Node.js - no separate install needed
echo "✅ SQLite will be used (included with Node.js)"

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

# 6. Initialize database schema
echo "🔧 Setting up database schema..."
npm run sync-db

# 7. Create storage directories
echo "📁 Creating storage directories..."
mkdir -p storage/files storage/temp storage/thumbnails

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your settings"
echo "2. Run: ./deploy/start-server.sh"
