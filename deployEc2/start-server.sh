#!/bin/bash
# Start all services on Ubuntu (EC2)
# Working directory: /home/ubuntu/driveSelfHosting
set -e

DEPLOY_ROOT=/home/ubuntu/driveSelfHosting

echo "🚀 Starting Self-Hosted File Server..."

# Ensure PostgreSQL and Redis are running (systemd manages them)
echo "Starting PostgreSQL..."
sudo systemctl start postgresql

echo "Starting Redis..."
sudo systemctl start redis-server

# Wait for services to be ready
sleep 2

# Ensure Nginx is running
echo "Starting Nginx..."
sudo systemctl start nginx

# Start backend with PM2
echo "Starting backend with PM2..."
cd "$DEPLOY_ROOT/backend"
pm2 delete driveSelfHosting 2>/dev/null || true
pm2 start dist/server.js --name driveSelfHosting --env production
pm2 save

echo "✅ Server started!"
echo "App:     https://drive.shubnit.com"
echo "Backend: http://localhost:5000"
echo "Swagger: http://localhost:5000/api-docs"
