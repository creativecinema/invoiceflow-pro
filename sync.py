#!/usr/bin/env python3
"""
InvoiceFlow — Weclapp Daten-Sync
Lädt alle relevanten Daten aus Weclapp und speichert sie als data.json.
Wird per Cron oder GitHub Actions automatisch ausgeführt.

Verwendung:
  python3 sync.py --tenant meinefirma --token DEIN-TOKEN
  
Oder mit .env Datei:
  WECLAPP_TENANT=meinefirma WECLAPP_TOKEN=xxx python3 sync.py
"""

import os, json, sys, argparse
from urllib.request import Request, urlopen
from urllib.error   import HTTPError, URLError
from datetime       import datetime

# ── Konfiguration ─────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--tenant', default=os.getenv('WECLAPP_TENANT',''))
parser.add_argument('--token',  default=os.getenv('WECLAPP_TOKEN', ''))
parser.add_argument('--out',    default='data/weclapp.json')
args = parser.parse_args()

TENANT = args.tenant.strip()
TOKEN  = args.token.strip()
OUTFILE = args.out

if not TENANT or not TOKEN:
    print("FEHLER: --tenant und --token sind Pflicht")
    print("  python3 sync.py --tenant meinefirma --token DEIN-TOKEN")
    sys.exit(1)

BASE = f"https://{TENANT}.weclapp.com/webapp/api/v2"

def api(endpoint):
    """Weclapp API GET-Anfrage"""
    url = f"{BASE}/{endpoint}"
    req = Request(url, headers={
        "AuthenticationToken": TOKEN,
        "Accept":              "application/json",
    })
    try:
        with urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
            return data.get("result", data)
    except HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {endpoint}")
        return []
    except URLError as e:
        print(f"  ✗ Verbindungsfehler: {e.reason}")
        return []

# ── Daten laden ───────────────────────────────────────────
print(f"\n⚡ Weclapp Sync — {TENANT}.weclapp.com")
print(f"   Ausgabe: {OUTFILE}")
print()

data = {}

print("→ Rechnungen laden...")
data["invoices"] = api("salesInvoice?pageSize=200&sort=-invoiceDate")
print(f"  ✓ {len(data['invoices'])} Rechnungen")

print("→ Kunden laden...")
data["customers"] = api("party?partyType-eq=ORGANIZATION&pageSize=200&sort=company")
print(f"  ✓ {len(data['customers'])} Kunden")

print("→ Angebote laden...")
data["quotes"] = api("quotation?pageSize=100&sort=-quotationDate")
print(f"  ✓ {len(data['quotes'])} Angebote")

print("→ Aufträge laden...")
data["orders"] = api("salesOrder?pageSize=100&sort=-orderDate")
print(f"  ✓ {len(data['orders'])} Aufträge")

print("→ Artikel laden...")
data["articles"] = api("article?active-eq=true&pageSize=200")
print(f"  ✓ {len(data['articles'])} Artikel")

print("→ Zeiterfassung laden...")
data["timeRecords"] = api("timeRecord?pageSize=200&sort=-startDate")
print(f"  ✓ {len(data['timeRecords'])} Einträge")

# Metadaten hinzufügen
data["_meta"] = {
    "tenant":      TENANT,
    "syncedAt":    datetime.now().isoformat(),
    "syncedAtUtc": datetime.utcnow().isoformat() + "Z",
    "counts": {k: len(v) for k, v in data.items() if isinstance(v, list)}
}

# ── Speichern ─────────────────────────────────────────────
os.makedirs(os.path.dirname(OUTFILE) or ".", exist_ok=True)
with open(OUTFILE, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

size = os.path.getsize(OUTFILE)
print(f"\n✓ Gespeichert: {OUTFILE} ({size/1024:.1f} KB)")
print(f"  Synchronisiert: {data['_meta']['syncedAt']}")
print()
