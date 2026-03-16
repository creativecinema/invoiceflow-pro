# InvoiceFlow Pro — Hetzner Deployment Guide

## Projektstruktur

```
invoiceflow/
├── invoiceflow-pro.html          ← Haupt-App (Single Page App)
├── Dockerfile                    ← Docker Image Definition
├── docker-compose.yml            ← Container Orchestrierung
├── setup.sh                      ← Server-Setup-Script
├── nginx/
│   ├── nginx.conf                ← Nginx HTTP Konfiguration
│   └── ssl.conf.template         ← Nginx HTTPS Vorlage
└── .github/
    └── workflows/
        └── deploy.yml            ← GitHub Actions CI/CD
```

---

## SCHRITT 1 — Hetzner Server erstellen

1. Einloggen: https://console.hetzner.cloud
2. Neues Projekt anlegen → **"Add Server"**
3. Einstellungen:
   - **Location:** Nuremberg / Falkenstein (Deutschland, DSGVO-konform)
   - **Image:** Ubuntu 24.04 LTS ← WICHTIG
   - **Type:** CX22 (2 vCPU, 4 GB RAM) — empfohlen; CX11 reicht auch
   - **SSH Key:** Deinen Public Key eintragen (unbedingt!)
   - **Firewall:** Erstelle eine neue Firewall (Port 22, 80, 443 öffnen)
4. **"Create & Buy now"** klicken
5. Notiere die IPv4-Adresse des Servers

> Kosten: CX22 ≈ €4,35/Monat · CX11 ≈ €3,29/Monat

---

## SCHRITT 2 — Server einrichten (einmalig)

```bash
# Lokal: SSH-Verbindung aufbauen
ssh root@DEINE-SERVER-IP

# Auf dem Server: Setup-Script herunterladen und ausführen
# OHNE Domain (nur IP):
bash <(curl -fsSL https://raw.githubusercontent.com/DEIN-REPO/invoiceflow/main/setup.sh)

# MIT Domain (empfohlen, inkl. SSL):
bash <(curl -fsSL https://...) invoiceflow.deine-domain.de admin@deine-domain.de
```

**Was das Script macht:**
- System-Update & Sicherheitspakete
- UFW Firewall (Port 22/80/443)
- Fail2Ban (SSH Brute-Force Schutz)
- Docker CE + Docker Compose installieren
- Optional: SSL-Zertifikat via Certbot (Let's Encrypt)

---

## SCHRITT 3 — App deployen (manuell)

```bash
# Lokal: Dateien auf den Server übertragen
scp -r invoiceflow-pro.html Dockerfile docker-compose.yml nginx/ \
    root@DEINE-SERVER-IP:/opt/invoiceflow/

# Auf dem Server
ssh root@DEINE-SERVER-IP
cd /opt/invoiceflow

# Container bauen und starten
docker compose up -d --build

# Status prüfen
docker compose ps
docker compose logs -f
```

---

## SCHRITT 4 — Mit Domain & HTTPS (optional, empfohlen)

### DNS-Eintrag setzen
Bei deinem Domain-Anbieter einen A-Record erstellen:
```
Typ:   A
Name:  invoiceflow  (oder @)
Wert:  DEINE-SERVER-IP
TTL:   300
```

### Nginx als Reverse Proxy einrichten
```bash
# Auf dem Server
apt-get install -y nginx

# SSL-Template anpassen
cp /opt/invoiceflow/nginx/ssl.conf.template \
   /etc/nginx/sites-available/invoiceflow.conf

# DEINE_DOMAIN ersetzen
sed -i 's/DEINE_DOMAIN/invoiceflow.deine-domain.de/g' \
    /etc/nginx/sites-available/invoiceflow.conf

# Aktivieren
ln -s /etc/nginx/sites-available/invoiceflow.conf \
      /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## SCHRITT 5 — Automatisches CI/CD mit GitHub Actions

### Repository-Secrets setzen
In GitHub → Settings → Secrets → Actions:

| Secret | Wert |
|--------|------|
| `HETZNER_HOST` | Deine Server-IP |
| `HETZNER_SSH_KEY` | Inhalt deines privaten SSH-Keys (`cat ~/.ssh/id_ed25519`) |

### Workflow aktivieren
Der Deploy wird bei jedem `git push` auf `main` automatisch ausgelöst.

```bash
git add .
git commit -m "Update InvoiceFlow"
git push origin main
# → GitHub Actions deployed automatisch auf Hetzner
```

---

## Nützliche Befehle

```bash
# Container-Status
docker compose ps

# Live-Logs
docker compose logs -f invoiceflow

# App neu starten
docker compose restart

# App stoppen
docker compose down

# Image neu bauen (nach HTML-Änderungen)
docker compose up -d --build

# Disk-Aufräumen
docker system prune -f

# Server-Monitoring
htop
df -h
free -h
```

---

## Empfohlene Hetzner-Server-Größen

| Typ | vCPU | RAM | Preis/Monat | Empfehlung |
|-----|------|-----|-------------|------------|
| CX11 | 1 | 2 GB | ~€3,29 | Test/Dev |
| CX22 | 2 | 4 GB | ~€4,35 | **Produktion** ✓ |
| CX32 | 4 | 8 GB | ~€7,52 | Hohes Volumen |

---

## Sicherheits-Checkliste

- [x] SSH nur mit Key (kein Passwort-Login)
- [x] UFW Firewall aktiv
- [x] Fail2Ban aktiv
- [x] HTTPS/TLS (bei Domain)
- [ ] Regelmäßige Backups (Hetzner Snapshots empfohlen)
- [ ] Monitoring (Hetzner Cloud Dashboard oder Uptime Kuma)

---

## Backup-Snapshot erstellen

```bash
# Hetzner CLI installieren
wget -q https://github.com/hetznercloud/cli/releases/latest/download/hcloud-linux-amd64.tar.gz
tar -xzf hcloud-linux-amd64.tar.gz && mv hcloud /usr/local/bin/

# Snapshot erstellen (im Hetzner Cloud Dashboard)
# Oder automatisch per Hetzner Backup (20% Aufschlag auf Server-Preis)
```
