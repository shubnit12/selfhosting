# Deployment Guide — Drive Self Hosting (EC2)

Complete guide to deploy on a fresh Ubuntu EC2 instance.

---

## Prerequisites

- Ubuntu EC2 instance (t3.small or higher recommended)
- Domain `drive.shubnit.com` with an A record pointing to the EC2 public IP
- SSH access to the instance
- GitHub repo: `shubnit12/selfhosting`

---

## Step 1 — SSH into EC2

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

---

## Step 2 — Install system dependencies

```bash
sudo apt update && sudo apt install -y unzip nginx curl gnupg2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
sudo apt install -y postgresql postgresql-contrib redis-server ffmpeg libheif-examples
```

---

## Step 3 — Download latest release

```bash
mkdir -p ~/driveSelfHosting
LATEST=$(curl -s https://api.github.com/repos/shubnit12/selfhosting/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -L -o /tmp/selfhosting.tar.gz "https://github.com/shubnit12/selfhosting/releases/download/$LATEST/selfhosting-ec2-$LATEST.tar.gz"
tar -xzf /tmp/selfhosting.tar.gz -C ~/driveSelfHosting
echo $LATEST > ~/driveSelfHosting/current_version.txt
```

---

## Step 4 — Configure environment

```bash
nano ~/driveSelfHosting/backend/.env
```

Update these values:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `DB_HOST` | `localhost` |
| `DB_NAME` | your db name |
| `DB_USER` | your db user |
| `DB_PASSWORD` | strong password |
| `JWT_SECRET` | long random string (64+ chars) |
| `JWT_REFRESH_SECRET` | different long random string |
| `FRONTEND_URL` | `https://drive.shubnit.com` |
| `BACKEND_URL` | `https://drive.shubnit.com` |
| `ADMIN_USERNAME` | your admin username |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_PASSWORD` | strong password |
| `ASSET_API_KEY` | long random string |

To generate random secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 5 — Run first-time setup

```bash
bash ~/driveSelfHosting/deployEc2/android-setup.sh
```

This will:
- Install all system dependencies
- Start PostgreSQL and Redis
- Install backend npm dependencies
- Create DB user and database
- Sync database schema (create all tables)
- Create storage directories (`files/`, `temp/`, `thumbnails/`, `assets/`)
- Configure nginx for `drive.shubnit.com`

---

## Step 6 — SSL certificate

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d drive.shubnit.com
```

If `drive.shubnit.com` is already on your wildcard cert:
```bash
sudo certbot certificates  # check existing certs
```

---

## Step 7 — Start the server

```bash
bash ~/driveSelfHosting/deployEc2/start-server.sh
```

On first start, the server automatically:
- Creates the admin user from your `.env` (`ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- Creates a test user (`sidhumoosa5911@legend.com` / `Sidhu@5911` / 1GB quota)
- Seeds initial folder structure for both users

---

## Step 8 — PM2 auto-start on reboot

```bash
pm2 startup
# Copy and run the command it prints, then:
pm2 save
```

---

## Step 9 — Auto-update cron job

```bash
crontab -e
```

Add this line:
```
*/5 * * * * /home/ubuntu/driveSelfHosting/deployEc2/update.sh >> /home/ubuntu/driveSelfHosting/update.log 2>&1
```

Every 5 minutes the script checks GitHub for a new release. If found, it downloads, deploys, and restarts — **without touching your database, storage files, or `.env`**.

---

## Step 10 — Verify

```bash
curl http://localhost:5000/health
pm2 list
```

Expected:
- Health check returns `{"status":"ok",...}`
- PM2 shows `driveSelfHosting` as `online`

Open in browser: `https://drive.shubnit.com`

---

## Deploying a New Version

Push a version tag from your local machine:

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions builds and publishes `selfhosting-ec2-v1.0.1.tar.gz`. The EC2 cron picks it up within 5 minutes automatically.

---

## Resetting the Database (if needed)

```bash
pm2 delete driveSelfHosting

# Replace 'fileserver' with your DB_NAME and DB_USER from .env
sudo -u postgres psql -c "DROP DATABASE fileserver;"
sudo -u postgres psql -c "CREATE DATABASE fileserver OWNER fileserver;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fileserver TO fileserver;"

cd ~/driveSelfHosting/backend
node dist/sync-db.js

bash ~/driveSelfHosting/deployEc2/start-server.sh
```

> ⚠️ To also wipe uploaded files from disk:
> ```bash
> rm -rf ~/driveSelfHosting/backend/storage/files/*
> rm -rf ~/driveSelfHosting/backend/storage/thumbnails/*
> ```

---

## Port Reference

| Domain | Port | Service |
|--------|------|---------|
| `shubnit.com` | static files | Portfolio |
| `blog.shubnit.com` | `3000` | Blog frontend |
| `api.shubnit.com` | `4000` | Blog backend API |
| `drive.shubnit.com` | `5000` | Self-hosting backend |

---

## Default Credentials (first boot)

| Role | Email | Password |
|------|-------|----------|
| Admin | from `ADMIN_EMAIL` in `.env` | from `ADMIN_PASSWORD` in `.env` |
| Test user | `testuser@example.com` | `Test@1234` |

> Change admin password after first login. Delete the test user when moving to production.

---

## File Locations on EC2

| Path | Description |
|------|-------------|
| `~/driveSelfHosting/backend/.env` | Environment config |
| `~/driveSelfHosting/backend/storage/` | All uploaded files |
| `~/driveSelfHosting/current_version.txt` | Currently deployed version |
| `~/driveSelfHosting/update.log` | Auto-update logs |
| `/etc/nginx/sites-available/drive.shubnit.com` | Nginx config |
