#!/bin/bash
REPO="shubnit12/selfhosting"
INSTALL_DIR="$HOME/selfhostin"
VERSION_FILE="$INSTALL_DIR/current_version.txt"

# Check if this is a fresh phone (dependencies not installed)
if ! command -v node &> /dev/null || ! command -v nginx &> /dev/null; then
    echo "❌ Dependencies not installed. Please run android-setup.sh first."
    exit 1
fi

if [ ! -d "$INSTALL_DIR" ]; then
    echo "❌ No existing installation found. Please run android-setup.sh first."
    exit 1
fi

echo "🔍 Checking for updates..."
LATEST=$(curl -s https://api.github.com/repos/$REPO/releases/latest | grep '"tag_name"' | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
    echo "❌ Failed to fetch version from GitHub"
    exit 1
fi

CURRENT=$(cat $VERSION_FILE 2>/dev/null || echo "none")
echo "Current: $CURRENT | Latest: $LATEST"

if [ "$LATEST" = "$CURRENT" ]; then
    echo "✅ Already on latest version"
    exit 0
fi

echo "🚀 Updating $CURRENT → $LATEST..."

curl -L -o /tmp/selfhosting-update.tar.gz \
    "https://github.com/$REPO/releases/download/$LATEST/selfhosting-android-$LATEST.tar.gz"

pkill -f "node dist/server.js" || true
pkill nginx || true
pkill autossh || true
sleep 2

rm -rf /tmp/selfhosting-new
mkdir -p /tmp/selfhosting-new
tar -xzf /tmp/selfhosting-update.tar.gz -C /tmp/selfhosting-new

cd /tmp/selfhosting-new/backend
npm install --production
npm run sync-db

sed "s|FRONTEND_DIST_PATH|$INSTALL_DIR/frontend/dist|g" \
    /tmp/selfhosting-new/deploy/nginx.conf > $PREFIX/etc/nginx/nginx.conf

rm -rf "$INSTALL_DIR"
mv /tmp/selfhosting-new "$INSTALL_DIR"

echo "$LATEST" > "$INSTALL_DIR/current_version.txt"

cd "$INSTALL_DIR"
bash deploy/start-server.sh

echo "✅ Updated to $LATEST!"
