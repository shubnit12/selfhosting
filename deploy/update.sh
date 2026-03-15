#!/bin/bash
REPO="shubnit12/selfhosting"
INSTALL_DIR="$HOME/selfhostin"
PARENT_DIR="$HOME"
VERSION_FILE="$INSTALL_DIR/current_version.txt"

# Step 1: Copy self to parent dir so we survive rm -rf on INSTALL_DIR
SCRIPT_REAL=$(realpath "$0" 2>/dev/null || echo "$0")
RUNNER="$PARENT_DIR/selfhosting-update-runner.sh"
if [ "$SCRIPT_REAL" != "$RUNNER" ]; then
    cp "$SCRIPT_REAL" "$RUNNER"
    exec bash "$RUNNER"
fi

# Step 2: Check for update
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

# Step 3: Download new release
curl -L -o /tmp/selfhosting-update.tar.gz \
    "https://github.com/$REPO/releases/download/$LATEST/selfhosting-android-$LATEST.tar.gz"

# Step 4: Stop all services
pkill -f "node dist/server.js" || true
pkill nginx || true
pkill autossh || true
sleep 2

# Step 5: Replace install directory
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf /tmp/selfhosting-update.tar.gz -C "$INSTALL_DIR"

# Step 6: Save version
echo "$LATEST" > "$INSTALL_DIR/current_version.txt"

# Step 7: Run setup (idempotent - skips initdb/createdb if already done)
cd "$INSTALL_DIR"
bash deploy/android-setup.sh

# Step 8: Start server
bash deploy/start-server.sh

echo "✅ Updated to $LATEST!"
