// ─────────────────────────────────────────────────
//  database.js – InvoiceFlow Pro SQLite Schema
// ─────────────────────────────────────────────────
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'invoiceflow.sqlite');
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Core Schema ──────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    name       TEXT DEFAULT '',
    role       TEXT DEFAULT 'employee',
    dept       TEXT DEFAULT '',
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    email      TEXT NOT NULL,
    name       TEXT NOT NULL,
    role       TEXT DEFAULT 'employee',
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );

  -- ── CRM ──────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS kunden (
    id         TEXT PRIMARY KEY,
    nr         TEXT UNIQUE NOT NULL,
    company    TEXT NOT NULL DEFAULT '',
    name       TEXT DEFAULT '',
    email      TEXT DEFAULT '',
    phone      TEXT DEFAULT '',
    address    TEXT DEFAULT '',
    payment    INTEGER DEFAULT 14,
    discount   REAL DEFAULT 0,
    revenue    REAL DEFAULT 0,
    active     INTEGER DEFAULT 1,
    notes      TEXT DEFAULT '',
    uid_nr     TEXT DEFAULT '',
    steuer_nr  TEXT DEFAULT '',
    iban       TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kontakte (
    id         TEXT PRIMARY KEY,
    nr         TEXT UNIQUE NOT NULL,
    type       TEXT DEFAULT 'person',
    firma      TEXT DEFAULT '',
    name       TEXT DEFAULT '',
    vorname    TEXT DEFAULT '',
    email      TEXT DEFAULT '',
    phone      TEXT DEFAULT '',
    position   TEXT DEFAULT '',
    strasse    TEXT DEFAULT '',
    plz        TEXT DEFAULT '',
    stadt      TEXT DEFAULT '',
    land       TEXT DEFAULT 'Deutschland',
    status     TEXT DEFAULT 'aktiv',
    kunden_id  TEXT DEFAULT NULL,
    notes      TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lieferanten (
    id         TEXT PRIMARY KEY,
    nr         TEXT UNIQUE NOT NULL,
    company    TEXT NOT NULL DEFAULT '',
    name       TEXT DEFAULT '',
    email      TEXT DEFAULT '',
    phone      TEXT DEFAULT '',
    address    TEXT DEFAULT '',
    payment    INTEGER DEFAULT 30,
    active     INTEGER DEFAULT 1,
    notes      TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chancen (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL DEFAULT '',
    firma             TEXT DEFAULT '',
    kunden_id         TEXT DEFAULT NULL,
    wert              REAL DEFAULT 0,
    phase             TEXT DEFAULT 'Qualifizierung',
    wahrscheinlichkeit INTEGER DEFAULT 20,
    erwartet          TEXT DEFAULT '',
    status            TEXT DEFAULT 'offen',
    notes             TEXT DEFAULT '',
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  -- ── Artikel ──────────────────────────────────────

  CREATE TABLE IF NOT EXISTS artikel (
    id          TEXT PRIMARY KEY,
    nr          TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    desc        TEXT DEFAULT '',
    unit        TEXT DEFAULT 'h',
    price       REAL DEFAULT 0,
    ek          REAL DEFAULT 0,
    vat         REAL DEFAULT 19,
    cat         TEXT DEFAULT 'Dienstleistung',
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- ── Verkauf ───────────────────────────────────────

  CREATE TABLE IF NOT EXISTS angebote (
    id          TEXT PRIMARY KEY,
    nr          TEXT UNIQUE NOT NULL,
    kunden_id   TEXT DEFAULT NULL,
    customer    TEXT DEFAULT '',
    date        TEXT DEFAULT '',
    valid       TEXT DEFAULT '',
    status      TEXT DEFAULT 'offen',
    net         REAL DEFAULT 0,
    vat_pct     REAL DEFAULT 19,
    vat_amt     REAL DEFAULT 0,
    gross       REAL DEFAULT 0,
    notes       TEXT DEFAULT '',
    pdf_path    TEXT DEFAULT '',
    created_by  INTEGER DEFAULT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (kunden_id) REFERENCES kunden(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS angebot_positionen (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    angebot_id TEXT NOT NULL,
    pos        INTEGER DEFAULT 1,
    artikel_id TEXT DEFAULT NULL,
    desc       TEXT DEFAULT '',
    qty        REAL DEFAULT 1,
    unit       TEXT DEFAULT 'h',
    price      REAL DEFAULT 0,
    vat        REAL DEFAULT 19,
    total      REAL DEFAULT 0,
    FOREIGN KEY (angebot_id) REFERENCES angebote(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auftraege (
    id          TEXT PRIMARY KEY,
    nr          TEXT UNIQUE NOT NULL,
    kunden_id   TEXT DEFAULT NULL,
    customer    TEXT DEFAULT '',
    angebot_id  TEXT DEFAULT NULL,
    date        TEXT DEFAULT '',
    due         TEXT DEFAULT '',
    status      TEXT DEFAULT 'in Bearbeitung',
    fortschritt INTEGER DEFAULT 0,
    net         REAL DEFAULT 0,
    vat_pct     REAL DEFAULT 19,
    vat_amt     REAL DEFAULT 0,
    gross       REAL DEFAULT 0,
    notes       TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (kunden_id) REFERENCES kunden(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS auftrag_positionen (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    auftrag_id  TEXT NOT NULL,
    pos         INTEGER DEFAULT 1,
    artikel_id  TEXT DEFAULT NULL,
    desc        TEXT DEFAULT '',
    qty         REAL DEFAULT 1,
    unit        TEXT DEFAULT 'h',
    price       REAL DEFAULT 0,
    vat         REAL DEFAULT 19,
    total       REAL DEFAULT 0,
    FOREIGN KEY (auftrag_id) REFERENCES auftraege(id) ON DELETE CASCADE
  );

  -- ── Rechnungen (GoBD §146 – immutable nach Versand) ──

  CREATE TABLE IF NOT EXISTS rechnungen (
    id           TEXT PRIMARY KEY,
    nr           TEXT UNIQUE NOT NULL,
    kunden_id    TEXT DEFAULT NULL,
    customer     TEXT DEFAULT '',
    date         TEXT DEFAULT '',
    due          TEXT DEFAULT '',
    service_date TEXT DEFAULT '',
    status       TEXT DEFAULT 'draft',
    immutable    INTEGER DEFAULT 0,
    is_storno    INTEGER DEFAULT 0,
    storno_ref   TEXT DEFAULT '',
    net          REAL DEFAULT 0,
    vat_pct      REAL DEFAULT 19,
    vat_amt      REAL DEFAULT 0,
    gross        REAL DEFAULT 0,
    notes        TEXT DEFAULT '',
    bestell_nr   TEXT DEFAULT '',
    pdf_path     TEXT DEFAULT '',
    datev_exported INTEGER DEFAULT 0,
    datev_exported_at TEXT DEFAULT '',
    created_by   INTEGER DEFAULT NULL,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (kunden_id) REFERENCES kunden(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS rechnung_positionen (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    rechnung_id    TEXT NOT NULL,
    pos            INTEGER DEFAULT 1,
    artikel_id     TEXT DEFAULT NULL,
    desc           TEXT DEFAULT '',
    qty            REAL DEFAULT 1,
    unit           TEXT DEFAULT 'h',
    price          REAL DEFAULT 0,
    vat            REAL DEFAULT 19,
    total          REAL DEFAULT 0,
    FOREIGN KEY (rechnung_id) REFERENCES rechnungen(id) ON DELETE CASCADE
  );

  -- ── Einkauf ────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS bestellungen (
    id           TEXT PRIMARY KEY,
    nr           TEXT UNIQUE NOT NULL,
    lieferant_id TEXT DEFAULT NULL,
    lieferant    TEXT DEFAULT '',
    date         TEXT DEFAULT '',
    due          TEXT DEFAULT '',
    status       TEXT DEFAULT 'bestellt',
    net          REAL DEFAULT 0,
    vat_amt      REAL DEFAULT 0,
    gross        REAL DEFAULT 0,
    notes        TEXT DEFAULT '',
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ek_rechnungen (
    id           TEXT PRIMARY KEY,
    nr           TEXT UNIQUE NOT NULL,
    lieferant_id TEXT DEFAULT NULL,
    lieferant    TEXT DEFAULT '',
    date         TEXT DEFAULT '',
    due          TEXT DEFAULT '',
    status       TEXT DEFAULT 'offen',
    gross        REAL DEFAULT 0,
    notes        TEXT DEFAULT '',
    beleg_path   TEXT DEFAULT '',
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- ── Projekte & Zeit ────────────────────────────────

  CREATE TABLE IF NOT EXISTS projekte (
    id         TEXT PRIMARY KEY,
    nr         TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    kunden_id  TEXT DEFAULT NULL,
    client     TEXT DEFAULT '',
    status     TEXT DEFAULT 'active',
    budget     REAL DEFAULT 0,
    spent      REAL DEFAULT 0,
    start      TEXT DEFAULT '',
    end        TEXT DEFAULT '',
    color      TEXT DEFAULT '#f0b429',
    notes      TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS zeiterfassung (
    id         TEXT PRIMARY KEY,
    projekt_id TEXT DEFAULT NULL,
    user_id    INTEGER DEFAULT NULL,
    user_name  TEXT DEFAULT '',
    date       TEXT DEFAULT '',
    desc       TEXT DEFAULT '',
    hours      REAL DEFAULT 0,
    rate       REAL DEFAULT 120,
    total      REAL DEFAULT 0,
    status     TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projekt_files (
    id          TEXT PRIMARY KEY,
    projekt_id  TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    filename    TEXT NOT NULL DEFAULT '',
    size        INTEGER DEFAULT 0,
    mime_type   TEXT DEFAULT '',
    note        TEXT DEFAULT '',
    created_by  TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (projekt_id) REFERENCES projekte(id) ON DELETE CASCADE
  );

  -- ── Finanzen ───────────────────────────────────────

  CREATE TABLE IF NOT EXISTS belege (
    id          TEXT PRIMARY KEY,
    date        TEXT DEFAULT '',
    vendor      TEXT DEFAULT '',
    amount      REAL DEFAULT 0,
    cat         TEXT DEFAULT 'Sonstiges',
    notes       TEXT DEFAULT '',
    file_path   TEXT DEFAULT '',
    ocr_text    TEXT DEFAULT '',
    status      TEXT DEFAULT 'open',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS banking (
    id          TEXT PRIMARY KEY,
    date        TEXT DEFAULT '',
    description TEXT DEFAULT '',
    amount      REAL DEFAULT 0,
    account     TEXT DEFAULT '',
    matched_id  TEXT DEFAULT '',
    matched_type TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- ── Versicherungen ─────────────────────────────────

  CREATE TABLE IF NOT EXISTS versicherungen (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL DEFAULT '',
    insurer   TEXT DEFAULT '',
    nr        TEXT DEFAULT '',
    premium   REAL DEFAULT 0,
    start     TEXT DEFAULT '',
    end       TEXT DEFAULT '',
    status    TEXT DEFAULT 'active',
    coverage  TEXT DEFAULT '',
    cat       TEXT DEFAULT 'Haftpflicht',
    notes     TEXT DEFAULT '',
    doc_path  TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ── Audit Trail ────────────────────────────────────

  CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER DEFAULT NULL,
    user_name  TEXT DEFAULT '',
    action     TEXT DEFAULT '',
    entity     TEXT DEFAULT '',
    entity_id  TEXT DEFAULT '',
    details    TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Migrations (safe ALTER TABLE) ────────────────────
try { db.exec("ALTER TABLE rechnungen ADD COLUMN bestell_nr TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE angebote ADD COLUMN bestell_nr TEXT DEFAULT ''"); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS projekt_files (
  id TEXT PRIMARY KEY, projekt_id TEXT NOT NULL, name TEXT DEFAULT '', filename TEXT DEFAULT '',
  size INTEGER DEFAULT 0, mime_type TEXT DEFAULT '', note TEXT DEFAULT '',
  created_by TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
)`); } catch {}
try { db.exec("ALTER TABLE artikel ADD COLUMN long_desc TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE artikel ADD COLUMN internal_note TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE artikel ADD COLUMN min_stock INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE artikel ADD COLUMN stock INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE artikel ADD COLUMN weight REAL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE artikel ADD COLUMN ean TEXT DEFAULT ''"); } catch {}

// ─── Default Settings ──────────────────────────────
const defaults = {
  company: '',
  company_address: '',
  company_email: '',
  company_phone: '',
  tax_nr: '',
  uid_nr: '',
  iban: '',
  bic: '',
  handelsreg: '',
  payment_days: '14',
  skr: '03',
  datev_consultant: '',
  datev_client: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  invoice_prefix: 'RE',
  invoice_header_text: 'Sehr geehrte Damen und Herren,\n\nbitte überweisen Sie den nachfolgenden Rechnungsbetrag fristgerecht auf unser Konto.',
  invoice_footer_text: 'Wir danken für Ihr Vertrauen und stehen für Rückfragen gerne zur Verfügung.',
  invoice_payment_text: 'Bitte überweisen Sie den Rechnungsbetrag innerhalb von {{payment_days}} Tagen unter Angabe der Rechnungsnummer.',
  angebot_header_text: 'Sehr geehrte Damen und Herren,\n\ngerne unterbreiten wir Ihnen folgendes Angebot:',
  angebot_footer_text: 'Wir freuen uns auf Ihre Beauftragung und stehen für Rückfragen gerne zur Verfügung.',
  storno_text: 'Wir stornieren hiermit die oben genannte Rechnung gemäß §14 UStG.',
  quote_prefix: 'ANG',
  order_prefix: 'AU',
};
const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(defaults)) ins.run(k, v);

// ─── Default Admin User ────────────────────────────
const adminExists = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (adminExists.c === 0) {
  const hash = bcrypt.hashSync('Admin2025!', 10);
  const users = [
    { email: 'admin@invoiceflow.de', pw: hash, name: 'Alexandra Weber', role: 'superadmin', dept: 'Administration' },
    { email: 'gf@invoiceflow.de', pw: bcrypt.hashSync('GF2025!', 10), name: 'Julia Bauer', role: 'management', dept: 'Geschäftsführung' },
    { email: 'demo@invoiceflow.de', pw: bcrypt.hashSync('Demo2025!', 10), name: 'Max Mustermann', role: 'employee', dept: 'Buchhaltung' },
  ];
  const ins = db.prepare('INSERT INTO users (email, password, name, role, dept) VALUES (?, ?, ?, ?, ?)');
  users.forEach(u => ins.run(u.email, u.pw, u.name, u.role, u.dept));
}

// ─── Demo Data (only if empty) ─────────────────────
const kdCount = db.prepare('SELECT COUNT(*) as c FROM kunden').get();
if (kdCount.c === 0) {
  const uid = () => require('crypto').randomBytes(8).toString('hex');
  const kd = db.prepare('INSERT INTO kunden (id,nr,company,name,email,phone,address,payment,revenue,active) VALUES (?,?,?,?,?,?,?,?,?,1)');
  kd.run(uid(),'K-001','Acme GmbH','Thomas Müller','mueller@acme.de','+49 89 111222','Maximilianstr. 1, 80333 München',14,42800);
  kd.run(uid(),'K-002','TechStart AG','Sabine Koch','s.koch@techstart.de','+49 89 333444','Leopoldstr. 50, 80802 München',30,38200);
  kd.run(uid(),'K-003','FreshBrand GmbH','Mark Weber','weber@freshbrand.de','+49 89 555666','Schillerstr. 30, 80336 München',14,27600);

  const art = db.prepare('INSERT INTO artikel (id,nr,name,desc,unit,price,ek,vat,cat,active) VALUES (?,?,?,?,?,?,?,19,?,1)');
  art.run(uid(),'AB_01_TS','Webentwicklung','Frontend & Backend Entwicklung','h',120,72,'Dienstleistung');
  art.run(uid(),'AB_02_TS','Consulting','Strategieberatung & Projektmanagement','h',250,0,'Dienstleistung');
  art.run(uid(),'AB_03_TS','Design Paket','UI/UX Design komplett','Pauschal',3500,1200,'Produkt');
  art.run(uid(),'AB_04_TS','SEO Optimierung','On-Page & Off-Page SEO','h',200,0,'Dienstleistung');
  art.run(uid(),'AB_05_TS','Hosting Premium','Managed Hosting inkl. SSL','Monat',89,25,'Abo');
}

// ─── Exports ──────────────────────────────────────
module.exports = { db };
