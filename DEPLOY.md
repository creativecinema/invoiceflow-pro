# InvoiceFlow Pro – Deployment Guide

## Voraussetzungen
- Hetzner Server mit Ubuntu 22.04+
- GitHub Repository
- Docker installiert (`curl -fsSL https://get.docker.com | sh`)

---

## 1. GitHub Repository aufsetzen

```bash
# Lokal: Repository initialisieren
cd invoiceflow-pro
git init
git add .
git commit -m "Initial commit"
git branch -M main

# GitHub Remote hinzufügen (dein Repo)
git remote add origin https://github.com/DEIN-USER/invoiceflow-pro.git
git push -u origin main
```

---

## 2. GitHub Secrets hinterlegen

In GitHub → Repository → Settings → Secrets and variables → Actions:

| Secret | Wert |
|--------|------|
| `SERVER_IP` | Deine Hetzner IP (z.B. `135.181.156.140`) |
| `SSH_PRIVATE_KEY` | Inhalt von `~/.ssh/id_rsa` (privater Key) |

SSH-Key generieren falls noch keiner vorhanden:
```bash
# Lokal
ssh-keygen -t ed25519 -C "invoiceflow-deploy"
cat ~/.ssh/id_ed25519.pub  # → auf Server in authorized_keys eintragen
cat ~/.ssh/id_ed25519      # → als SSH_PRIVATE_KEY in GitHub Secrets
```

Server: Public Key autorisieren:
```bash
# Auf Hetzner Server
mkdir -p ~/.ssh
echo "DEIN-PUBLIC-KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## 3. Server einrichten (einmalig)

```bash
# Auf Hetzner Server als root
apt-get update && apt-get upgrade -y

# Docker installieren
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Verzeichnis anlegen
mkdir -p /opt/invoiceflow
cd /opt/invoiceflow

# Volumes anlegen
docker volume create ifp-data
docker volume create ifp-uploads

# Hetzner Firewall: Port 80 öffnen
# → Hetzner Cloud Console → Firewall → Port 80 TCP eingehend
```

---

## 4. Manueller Erst-Deploy (ohne GitHub Actions)

```bash
# Auf dem Server: direkt aus dem ZIP deployen
cd /opt/invoiceflow

# Dateien vom ZIP kopieren (nach scp invoiceflow-pro.zip root@SERVER:/opt/invoiceflow/)
unzip -o invoiceflow-pro.zip
cp -r invoiceflow-pro/* .

# Image bauen
docker build -t invoiceflow-app .

# Alten Container entfernen (falls vorhanden)
docker stop invoiceflow 2>/dev/null; docker rm invoiceflow 2>/dev/null; true

# Container starten
docker run -d \
  --name invoiceflow \
  --restart unless-stopped \
  -p 80:3000 \
  -v ifp-data:/app/data \
  -v ifp-uploads:/app/uploads \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATA_DIR=/app/data \
  invoiceflow-app

# Testen
sleep 5
curl http://localhost:80/api/auth/check
# → {"ok":false} = läuft ✅
```

---

## 5. GitHub Actions Deploy (automatisch)

Nach dem Setup: Jeder Push auf `main` triggert automatisch:
1. Docker Image bauen → ghcr.io pushen
2. SSH auf Server → alten Container stoppen → neuen starten

```bash
# Deploy triggern
git add .
git commit -m "Update"
git push origin main
# → GitHub Actions baut und deployed automatisch
```

---

## 6. Rollback

```bash
# In GitHub Actions: Actions → Deploy → Run workflow → rollback_to: v3-abc1234
# ODER direkt auf Server:
docker stop invoiceflow && docker rm invoiceflow
docker run -d --name invoiceflow --restart unless-stopped \
  -p 80:3000 -v ifp-data:/app/data -v ifp-uploads:/app/uploads \
  -e NODE_ENV=production -e PORT=3000 -e DATA_DIR=/app/data \
  ghcr.io/DEIN-USER/invoiceflow-pro:v3-abc1234
```

---

## 7. Update ohne GitHub Actions (direkt)

```bash
# Neue index.html auf Server kopieren
scp public/index.html root@SERVER:/opt/invoiceflow/

# Image neu bauen und Container ersetzen
ssh root@SERVER "cd /opt/invoiceflow && \
  docker build -t invoiceflow-app . && \
  docker stop invoiceflow && docker rm invoiceflow && \
  docker run -d --name invoiceflow --restart unless-stopped \
  -p 80:3000 -v ifp-data:/app/data -v ifp-uploads:/app/uploads \
  -e NODE_ENV=production -e PORT=3000 -e DATA_DIR=/app/data \
  invoiceflow-app"
```

---

## Demo-Zugänge

| Rolle | E-Mail | Passwort |
|-------|--------|----------|
| 👑 Superadmin | admin@invoiceflow.de | Admin2025! |
| 💼 Geschäftsführung | gf@invoiceflow.de | GF2025! |
| 👤 Mitarbeiter | demo@invoiceflow.de | Demo2025! |

**Passwörter sofort nach Ersteinrichtung ändern!**

---

## Troubleshooting

```bash
# Logs anzeigen
docker logs invoiceflow --tail 50 -f

# In Container einloggen
docker exec -it invoiceflow sh

# Port-Konflikt beheben
docker stop $(docker ps -q)  # alle Container stoppen
docker run -d --name invoiceflow ...  # neu starten

# Container läuft nicht
docker ps -a  # zeigt auch gestoppte Container
docker inspect invoiceflow  # Details

# Health check
curl -v http://localhost:80/api/auth/check
```
