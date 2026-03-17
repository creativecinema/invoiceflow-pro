# InvoiceFlow Pro

Enterprise-Abrechnungssoftware für Kreativagenturen.

## Stack
- **Backend**: Node.js + Express + SQLite (better-sqlite3)
- **Frontend**: React 18 (Single HTML, kein Build-Step, CDN)
- **Deploy**: Docker + nginx HTTPS + GitHub Actions → Hetzner

## Module
- CRM: Kontakte, Kunden, Lieferanten, Chancen-Pipeline
- Verkauf: Angebote → Aufträge → Rechnungen (§14 UStG / GoBD)
- Artikel: Stammdaten, Verkaufspreise, Spanne
- Projekte + Zeiterfassung mit Stoppuhr
- Finanzen: Belege, Versicherungen
- DATEV CSV-Export (Buchungsstapel v700, SKR03/04)
- PDF-Generierung (Rechnung, Angebot, Stornorechnung)

## Ersteinrichtung

```bash
# Lokal
npm install
node server.js
# → http://localhost:3000

# Hetzner
bash scripts/setup-server.sh
```

## Demo-Zugänge

| Rolle | E-Mail | Passwort |
|-------|--------|----------|
| 👑 Superadmin | admin@invoiceflow.de | Admin2025! |
| 💼 Geschäftsführung | gf@invoiceflow.de | GF2025! |
| 👤 Mitarbeiter | demo@invoiceflow.de | Demo2025! |

## Deploy

```bash
git push origin main
# → GitHub Actions baut Docker Image
# → Pushed zu ghcr.io
# → SSH deploy auf Hetzner
```

## Rechtliches
- §14 UStG: Rechnungspflichtangaben
- GoBD §146: Unveränderlichkeit nach Versand
- §147 AO: 10 Jahre Aufbewahrungspflicht
- E-Rechnung (XRechnung/ZUGFeRD) ab 01.01.2025
