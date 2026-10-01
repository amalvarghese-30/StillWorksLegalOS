# LEGALOS — DEPLOYMENT READINESS & ENVIRONMENT ARCHITECTURE

**Date:** October 2, 2026  
**Auditor:** Principal DevOps & Site Reliability Engineer  
**Scope:** Verification of deployment portability for a future cloud VPS environment while maintaining strict localhost development isolation.

---

## 1. Absolute Environment Separation

The codebase strictly enforces the separation between **Local Development** and **Future Cloud Production**.

```
DEVELOPMENT ENVIRONMENT (Current & Authoritative)
  ┌────────────────────────────────────────────────────────┐
  │ React/Vite Frontend      →  http://localhost:5174      │
  │ Node.js/Express API      →  http://localhost:3001      │
  │ Socket.IO Server         →  ws://localhost:3001        │
  │ MongoDB Database         →  mongodb://localhost:27017  │
  │ Storage Root             →  ./uploads                  │
  │ Electron Desktop         →  connects to localhost:3001 │
  └────────────────────────────────────────────────────────┘

FUTURE CLOUD VPS ENVIRONMENT (Prepared & Decoupled)
  ┌────────────────────────────────────────────────────────┐
  │ Public Web Domain        →  https://legal.yourfirm.com │
  │ Reverse Proxy            →  Nginx / Caddy (SSL/TLS)    │
  │ Node.js/Express API      →  http://127.0.0.1:3001      │
  │ Socket.IO WSS            →  wss://legal.yourfirm.com   │
  │ MongoDB Cloud / Cluster  →  mongodb+srv://...          │
  │ Storage Directory        →  /var/lib/legalos/storage   │
  │ Packaged Electron Client →  configured VITE_API_URL    │
  └────────────────────────────────────────────────────────┘
```

**Zero Legacy VPS Reconnection:** All hardcoded fallbacks to the obsolete VPS domain (`legalos.stillworks.in`) have been eliminated from all source files.

---

## 2. Production Environment Variable Specifications

When deploying LegalOS to the new VPS, set the following environment variables:

| Variable | Required in Prod | Recommended Value / Description | Example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | `production` | `production` |
| `PORT` | **YES** | Port for Express server to bind | `3001` |
| `MONGODB_URI` | **YES** | MongoDB connection string (Atlas or local replica set) | `mongodb+srv://legalos_app:...@cluster.mongodb.net/legalos?retryWrites=true&w=majority` |
| `JWT_SECRET` | **YES** | High-entropy random secret (>= 64 chars) for access tokens | `openssl rand -base64 48` |
| `REFRESH_TOKEN_SECRET`| **YES** | High-entropy random secret for refresh tokens | `openssl rand -base64 48` |
| `STORAGE_DIR` | **YES** | Absolute filesystem path for application storage | `/var/lib/legalos/storage` |
| `CLIENT_ORIGIN` | **YES** | Comma-delimited allowed origins for CORS | `https://legal.yourfirm.com` |
| `TRUST_PROXY` | **YES** | `true` or `loopback` when running behind Nginx / Cloudflare | `true` |
| `SECURE_COOKIES` | **YES** | `true` (enforces `Secure; HttpOnly; SameSite=Lax` on cookies) | `true` |

---

## 3. Reverse Proxy & WebSocket Configuration (Nginx Reference)

```nginx
# /etc/nginx/sites-available/legalos.conf
server {
    listen 80;
    server_name legal.yourfirm.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name legal.yourfirm.com;

    ssl_certificate /etc/letsencrypt/live/legal.yourfirm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/legal.yourfirm.com/privkey.pem;

    client_max_body_size 100M; # Match LegalOS upload ceiling

    # Static Web App (or reverse-proxy to same-origin Node server)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Realtime Socket.IO WebSocket Upgrades
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }
}
```

---

## 4. Operational Lifecycle Commands

```bash
# 1. Install dependencies
npm install --prefix server
npm install

# 2. Build backend and frontend
npm run build
npm run build:server

# 3. Seed initial admin account (First-time deployment only)
node server/dist/seed.js

# 4. Start production daemon (via PM2 or systemd)
node server/dist/index.js
# Or with PM2: pm2 start server/dist/index.js --name legalos-server

# 5. Verify health & readiness
curl -f http://127.0.0.1:3001/api/health
curl -f http://127.0.0.1:3001/api/ready
```

---

## 5. Storage Directory Permissions & Backups

1. **Permissions:**
   ```bash
   mkdir -p /var/lib/legalos/storage/{cases,clients,general,chat,avatars}
   chown -R legalos:legalos /var/lib/legalos/storage
   chmod -R 750 /var/lib/legalos/storage
   ```
2. **Automated Daily Backup Procedure:**
   - **Database:** `mongodump --uri="$MONGODB_URI" --archive=/backup/legalos-$(date +%F).archive --gzip`
   - **Storage:** `rsync -avz --delete /var/lib/legalos/storage/ /backup/storage-mirror/`

---

## 6. Readiness Verdict

LegalOS is completely decoupled from any legacy infrastructure and is **100% prepared for future cloud VPS deployment** upon client demand.
