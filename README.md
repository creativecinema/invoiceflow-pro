# ⚡ InvoiceFlow Pro

> Moderne Abrechnungssoftware — besser als Weclapp. Gebaut mit HTML, Nginx & Docker. Deploybar auf Hetzner in unter 5 Minuten.

![Preview](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)
![Nginx](https://img.shields.io/badge/Nginx-1.27-green?logo=nginx)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Features

| Feature | Beschreibung |
|---|---|
| 📊 **Dashboard** | Live-KPIs, Umsatz-Charts, Offene Posten, Top-Kunden |
| 🧾 **Rechnungen** | Erstellen, filtern, Vorschau, PDF-Export |
| 📋 **Angebote** | 1-Klick Umwandlung in Rechnung |
| 👥 **Kunden-CRM** | Umsatzübersicht, Status, Kontaktdaten |
| ⏱ **Zeiterfassung** | Stoppuhr, manuelle Einträge, direkte Abrechnung |
| 🤖 **KI-Assistent** | Claude-API-Integration, Mahntext-Generator, Steuer-Tipps |
| 📈 **Analysen** | Umsatz nach Kunde, Zahlungsverhalten, Jahresvergleich |
| 🔒 **HTTPS/SSL** | Let's Encrypt via Certbot, Auto-Renewal |
| 🚀 **CI/CD** | GitHub Actions → automatisches Deploy auf Hetzner |
| 🇩🇪 **DSGVO** | Deutsches Rechenzentrum, XRechnung, DATEV-Export |

---

## 🗂 Projektstruktur

```
invoiceflow/
├── invoiceflow-pro.html          ← Komplette Single-Page-App
├── Dockerfile                    ← Nginx Alpine Image
├── docker-compose.yml            ← Container Orchestrierung
├── setup.sh                      ← Automatisches Server-Setup
├── nginx/
│   ├── nginx.conf                ← HTTP Konfiguration
│   └── ssl.conf.template         ← HTTPS / TLS 1.3 Vorlage
├── .github/
│   └── workflows/
│       └── deploy.yml            ← GitHub Actions CI/CD
├── DEPLOYMENT.md                 ← Vollständige Deployment-Anleitung
└── README.md                     ← Diese Datei
```

---

## 🚀 Schnellstart (lokal testen)

```bash
# Repository klonen
git clone https://github.com/DEIN-USERNAME/invoiceflow-pro.git
cd invoiceflow-pro

# Mit Docker starten
docker compose up -d --build

# Browser öffnen
open http://localhost:8080
```

---

## ☁️ Hetzner Deployment

### 1. Server erstellen
- [console.hetzner.cloud](https://console.hetzner.cloud) → Add Server
- Image: **Ubuntu 24.04 LTS**
- Typ: **CX22** (2 vCPU, 4 GB RAM, ~€4,35/Monat)
- SSH-Key hinterlegen

### 2. Server einrichten
```bash
ssh root@DEINE-SERVER-IP

# Repo klonen
git clone https://github.com/DEIN-USERNAME/invoiceflow-pro.git /opt/invoiceflow
cd /opt/invoiceflow

# Setup ausführen (Docker, UFW, Fail2Ban, optional SSL)
chmod +x setup.sh
bash setup.sh deine-domain.de admin@deine-email.de
```

### 3. App starten
```bash
cd /opt/invoiceflow
docker compose up -d --build
```

✅ Fertig! App läuft unter `https://deine-domain.de`

---

## 🔄 Automatisches CI/CD via GitHub Actions

Bei jedem `git push origin main` wird automatisch auf den Server deployed.

**GitHub Secrets setzen** (Settings → Secrets → Actions):

| Secret | Wert |
|---|---|
| `HETZNER_HOST` | Server-IP |
| `HETZNER_SSH_KEY` | Privater SSH-Key (`cat ~/.ssh/id_ed25519`) |

---

## 🛠 Nützliche Befehle

```bash
# Status
docker compose ps

# Logs
docker compose logs -f

# Neu bauen
docker compose up -d --build

# Stoppen
docker compose down

# Aufräumen
docker system prune -f
```

---

## 📋 Empfohlene Server-Größen

| Typ | vCPU | RAM | Preis/Monat | Für |
|---|---|---|---|---|
| CX11 | 1 | 2 GB | ~€3,29 | Test |
| **CX22** | 2 | 4 GB | **~€4,35** | **Produktion ✓** |
| CX32 | 4 | 8 GB | ~€7,52 | Hohes Volumen |

---

## 📄 Lizenz

MIT — frei verwendbar, anpassbar, kommerziell nutzbar.

---

> Gebaut mit ❤️ — Inspiriert von Weclapp, aber besser.
