# EC2 Setup Guide — Drive Self Hosting

Steps to set up the self-hosted file server on a fresh EC2 Ubuntu instance.

## 1. Install dependencies

```bash
sudo apt update && sudo apt install -y unzip nginx curl gnupg2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
sudo apt install -y postgresql postgresql-contrib redis-server ffmpeg libheif-examples
```

## 2. Create folder structure

```bash
mkdir -p ~/driveSelfHosting
```

## 3. Download latest release and extract

```bash
LATEST=$(curl -s https://api.github.com/repos/shubnit12/selfhosting/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
curl -L -o /tmp/selfhosting.tar.gz "https://github.com/shubnit12/selfhosting/releases/download/$LATEST/selfhosting-ec2-$LATEST.tar.gz"
tar -xzf /tmp/selfhosting.tar.gz -C ~/driveSelfHosting
```

## 4. Create .env file

```bash
cp ~/driveSelfHosting/backend/.env.example ~/driveSelfHosting/backend/.env
nano ~/driveSelfHosting/backend/.env
```

Key values to set:
- `PORT=5000`
- `HOST=localhost`
- `DB_HOST=localhost`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `FRONTEND_URL=https://drive.shubnit.com`
- `BACKEND_URL=https://drive.shubnit.com`
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — use long random strings
- `ASSET_API_KEY` — use a long random string

## 5. Run first-time setup

```bash
bash ~/driveSelfHosting/deployEc2/android-setup.sh
```

This installs all system dependencies, sets up PostgreSQL, creates the DB, syncs schema, and configures nginx.

## 6. SSL certificate

If `drive.shubnit.com` is not already on your cert:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d drive.shubnit.com
```

To check existing certs:
```bash
sudo certbot certificates
```

## 7. Start the server

```bash
bash ~/driveSelfHosting/deployEc2/start-server.sh
```

## 8. Set up PM2 auto-start on reboot

```bash
pm2 startup
```

Copy and run the command it prints, then:
```bash
pm2 save
```

## 9. Set up auto-update cron job

```bash
crontab -e
```

Add:
```
*/5 * * * * /home/ubuntu/driveSelfHosting/deployEc2/update.sh >> /home/ubuntu/driveSelfHosting/update.log 2>&1
```

## 10. Verify

```bash
curl http://localhost:5000/health
# Expected: {"status":"ok",...}

pm2 list
# Expected: driveSelfHosting online
```
