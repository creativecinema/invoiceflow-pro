# Angebot Builder – Deployment auf Hetzner

Professionelle Angebotserstellung für Medienproduktionen.  
React + Vite → statische Dateien → Nginx auf Hetzner VPS.

---

## Schnellstart (3 Schritte)

### 1. Hetzner Server aufsetzen

Einen neuen Server anlegen (Empfehlung: **CX22**, Ubuntu 24.04 LTS).  
Dann einmalig das Setup-Skript übertragen und ausführen:

```bash
# Vom lokalen Rechner:
scp setup-server.sh root@DEINE_SERVER_IP:/root/
ssh root@DEINE_SERVER_IP "bash /root/setup-server.sh"
```

Das Skript installiert automatisch:
- Node.js 20 LTS
- Nginx (konfiguriert als SPA-Server)
- Certbot (für SSL)
- UFW Firewall (nur SSH + HTTP + HTTPS)
- Fail2ban (Brute-Force-Schutz)

---

### 2. App deployen

```bash
# Vom lokalen Rechner (im Projektverzeichnis):
./deploy.sh root@DEINE_SERVER_IP
```

Das Skript baut die App (`npm run build`) und überträgt die fertigen  
Dateien per `rsync` auf den Server. Kein SSH in der Mitte, kein Node.js  
nötig auf dem Server zur Laufzeit.

---

### 3. SSL aktivieren (optional, empfohlen)

Nachdem der DNS-Eintrag gesetzt ist (`A`-Record auf die Server-IP):

```bash
ssh root@DEINE_SERVER_IP
certbot --nginx -d angebot.meinefirma.de
```

Certbot ergänzt die Nginx-Konfiguration automatisch und richtet  
Auto-Renewal ein.

---

## Lokale Entwicklung

```bash
npm install
npm run dev        # Startet auf http://localhost:3000
```

Produktions-Build testen:
```bash
npm run build
npm run preview    # Startet auf http://localhost:4173
```

---

## Projektstruktur

```
angebot-app/
├── src/
│   ├── main.jsx          # React-Einstiegspunkt
│   ├── App.jsx           # Hauptkomponente (alle Views)
│   └── app.css           # Alle Styles
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.js
├── package.json
├── nginx.conf            # Nginx-Vorlage
├── deploy.sh             # Deployment-Skript (lokal → Server)
└── setup-server.sh       # Erstinstallation auf dem Server
```

---

## Manuelle Nginx-Konfiguration

Wenn gewünscht, `nginx.conf` anpassen:

```bash
# Domain eintragen:
nano /etc/nginx/sites-available/angebot
# DEINE_DOMAIN.de ersetzen

nginx -t                  # Konfiguration testen
systemctl reload nginx    # Neu laden
```

---

## Updates deployen

Einfach `deploy.sh` erneut ausführen – es überträgt nur geänderte Dateien:

```bash
./deploy.sh root@DEINE_SERVER_IP
```

---

## Empfohlene Hetzner-Konfiguration

| Einstellung      | Empfehlung                  |
|------------------|-----------------------------|
| Servertyp        | CX22 (2 vCPU, 4 GB RAM)     |
| Image            | Ubuntu 24.04 LTS            |
| Standort         | Nürnberg / Falkenstein      |
| Firewall         | SSH (22), HTTP (80), HTTPS (443) |
| Backups          | Aktivieren (20% Aufpreis)   |
| SSH-Key          | Hinterlegen vor Erstellung  |

---

## Erweiterungen (vorbereitet)

Die App ist modular aufgebaut und einfach erweiterbar:

- **Mehrsprachigkeit** → `i18n`-Library einbinden, Texte externalisieren
- **PDF-Export** → `@react-pdf/renderer` oder `jsPDF` + Autoprint
- **Backend/Datenbank** → API-Calls in `App.jsx` ergänzen (z. B. Express + SQLite)
- **Authentifizierung** → Nginx Basic Auth oder Auth-Proxy vorschalten
- **Mehrere Vorlagen** → Template-System in `defaultRows` ausbauen
- **Kundenportal** → Read-only Preview-Link per Hash-Routing

---

## Nginx Basic Auth (optionaler Passwortschutz)

Ohne Domain-Login kann die App mit einem Basisschutz versehen werden:

```bash
apt install apache2-utils
htpasswd -c /etc/nginx/.htpasswd admin

# In nginx.conf ergänzen:
# auth_basic "Angebot Builder";
# auth_basic_user_file /etc/nginx/.htpasswd;
```

---

## Lizenz

Privat / intern. Nicht zur Weitergabe bestimmt.
