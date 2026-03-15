#!/bin/bash
# Start all services

echo "🚀 Starting Self-Hosted File Server..."

# Start PostgreSQL
echo "Starting PostgreSQL..."
pg_ctl -D $PREFIX/var/lib/postgresql start

# Start Redis
echo "Starting Redis..."
redis-server --daemonize yes

# Wait for services
sleep 2

# Start Nginx
echo "Starting Nginx..."
nginx

# Start autossh reverse tunnel to EC2
echo "Starting EC2 reverse tunnel..."
autossh -M 0 -N -f \
  -o "ServerAliveInterval 30" \
  -o "ServerAliveCountMax 3" \
  -o "StrictHostKeyChecking no" \
  -R 8080:localhost:8080 \
  -i ~/.ssh/ec2_tunnel_key \
  ubuntu@65.2.3.170
echo "✅ Tunnel started"

# Start backend
echo "Starting backend..."
cd backend
NODE_ENV=production node dist/server.js

echo "✅ Server started!"
echo "App:     http://localhost:8080"
echo "Backend: http://localhost:3000"
echo "Swagger: http://localhost:3000/api-docs"
