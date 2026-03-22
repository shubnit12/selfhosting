#!/bin/bash
# Auto-update script for Ubuntu EC2
# Working directory: /home/ubuntu/driveSelfHosting
REPO="shubnit12/selfhosting"
INSTALL_DIR="$HOME/driveSelfHosting"
PARENT_DIR="$HOME"
VERSION_FILE="$INSTALL_DIR/current_version.txt"

# Step 1: Copy self to parent dir so we survive rm -rf on INSTALL_DIR
SCRIPT_REAL=$(realpath "$0" 2>/dev/null || echo "$0")
RUNNER="$PARENT_DIR/driveSelfHosting-update-runner.sh"
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

# Step 3: Download new EC2 release tarball
curl -L -o /tmp/selfhosting-update.tar.gz \
    "https://github.com/$REPO/releases/download/$LATEST/selfhosting-ec2-$LATEST.tar.gz"

# Step 4: Stop backend (PM2)
pm2 delete driveSelfHosting 2>/dev/null || true
sleep 2

# Step 5: Back up .env before wiping
cp "$INSTALL_DIR/backend/.env" /tmp/selfhosting-backup.env 2>/dev/null || true

# Step 6: Replace install directory (keep storage intact)
rm -rf "$INSTALL_DIR/backend/dist"
rm -rf "$INSTALL_DIR/frontend/dist"
rm -rf "$INSTALL_DIR/deployEc2"
mkdir -p "$INSTALL_DIR"
tar -xzf /tmp/selfhosting-update.tar.gz -C "$INSTALL_DIR"

# Step 7: Restore .env
cp /tmp/selfhosting-backup.env "$INSTALL_DIR/backend/.env" 2>/dev/null || true

# Step 8: Install production dependencies
cd "$INSTALL_DIR/backend"
npm install --omit=dev

# Step 9: Save version
echo "$LATEST" > "$INSTALL_DIR/current_version.txt"

# Step 10: Start server
bash "$INSTALL_DIR/deployEc2/start-server.sh"

echo "✅ Updated to $LATEST!"
