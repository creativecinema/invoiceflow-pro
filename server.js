// ─────────────────────────────────────────────────
//  server.js – InvoiceFlow Pro API Server
// ─────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// ─── Middleware ────────────────────────────────────
app.use(compression());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte kurz warten.' }
});
app.use('/api/', apiLimiter);

// ─── File Upload ───────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ───────────────────────────────────────
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const uid = () => uuidv4().replace(/-/g, '').slice(0, 16);

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function addDays(dateStr, n) {
  if (!dateStr) return today();
  const p = dateStr.split('.');
  const d = new Date(p[2], p[1]-1, p[0]);
  d.setDate(d.getDate() + n);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function nextNr(table, prefix) {
  const rows = db.prepare(`SELECT nr FROM ${table} WHERE nr LIKE ? ORDER BY nr DESC LIMIT 1`).all(`${prefix}-%`);
  if (!rows.length) return `${prefix}-001`;
  const last = rows[0].nr;
  const parts = last.split('-');
  const num = parseInt(parts[parts.length-1]) || 0;
  const yr = new Date().getFullYear();
  return `${prefix}-${yr}-${String(num + 1).padStart(3,'0')}`;
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function logActivity(userId, userName, action, entity, entityId, details = '') {
  db.prepare('INSERT INTO activity_log (user_id, user_name, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)')
    .run(userId, userName, action, entity, entityId, details);
}

// ─── Auth Middleware ───────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies?.ifp_session || req.headers?.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht angemeldet' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")').get(token);
  if (!sess) return res.status(401).json({ error: 'Session abgelaufen' });
  req.user = { id: sess.user_id, email: sess.email, name: sess.name, role: sess.role };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Keine Berechtigung' });
    next();
  };
}

const isAdmin = requireRole('superadmin');
const isMgmt = requireRole('superadmin', 'management');

// ─── Static Files ──────────────────────────────────
app.use('/uploads', requireAuth, express.static(UPLOAD_DIR));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));

// ─── VERSION ──────────────────────────────────────
app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0', name: 'InvoiceFlow Pro', built: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════
app.get('/api/auth/check', (req, res) => {
  const token = req.cookies?.ifp_session || req.headers?.authorization?.replace('Bearer ', '');
  if (!token) return res.json({ ok: false });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")').get(token);
  if (!sess) return res.json({ ok: false });
  res.json({ ok: true, user: { id: sess.user_id, email: sess.email, name: sess.name, role: sess.role } });
});

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, email, name, role, expires_at) VALUES (?,?,?,?,?,?)').run(token, user.id, user.email, user.name, user.role, expires);
  res.cookie('ifp_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  logActivity(user.id, user.name, 'login', 'auth', String(user.id));
  res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, dept: user.dept } });
}));

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.ifp_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('ifp_session');
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
//  KUNDEN
// ═══════════════════════════════════════════════════
app.get('/api/kunden', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM kunden ORDER BY company COLLATE NOCASE').all());
}));

app.post('/api/kunden', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  if (!d.company) return res.status(400).json({ error: 'Firma erforderlich' });
  const maxNr = db.prepare("SELECT nr FROM kunden WHERE nr LIKE 'K-%' ORDER BY nr DESC LIMIT 1").get();
  const num = maxNr ? (parseInt(maxNr.nr.replace('K-','')) || 0) + 1 : 1;
  const id = uid();
  const nr = d.nr || `K-${String(num).padStart(3,'0')}`;
  db.prepare('INSERT INTO kunden (id,nr,company,name,email,phone,address,payment,discount,revenue,active,notes,uid_nr,steuer_nr,iban) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,nr,d.company,d.name||'',d.email||'',d.phone||'',d.address||'',d.payment||14,d.discount||0,d.revenue||0,d.active!==false?1:0,d.notes||'',d.uid_nr||'',d.steuer_nr||'',d.iban||'');
  logActivity(req.user.id, req.user.name, 'create', 'kunden', id, d.company);
  res.json(db.prepare('SELECT * FROM kunden WHERE id = ?').get(id));
}));

app.put('/api/kunden/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE kunden SET company=?,name=?,email=?,phone=?,address=?,payment=?,discount=?,revenue=?,active=?,notes=?,uid_nr=?,steuer_nr=?,iban=?,updated_at=datetime("now") WHERE id=?').run(d.company,d.name||'',d.email||'',d.phone||'',d.address||'',d.payment||14,d.discount||0,d.revenue||0,d.active!==false?1:0,d.notes||'',d.uid_nr||'',d.steuer_nr||'',d.iban||'',req.params.id);
  res.json(db.prepare('SELECT * FROM kunden WHERE id = ?').get(req.params.id));
}));

app.delete('/api/kunden/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  db.prepare('DELETE FROM kunden WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  KONTAKTE
// ═══════════════════════════════════════════════════
app.get('/api/kontakte', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM kontakte ORDER BY name COLLATE NOCASE').all());
}));

app.post('/api/kontakte', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const max = db.prepare("SELECT nr FROM kontakte WHERE nr LIKE 'C-%' ORDER BY nr DESC LIMIT 1").get();
  const num = max ? (parseInt(max.nr.replace('C-','')) || 0) + 1 : 1;
  const id = uid();
  db.prepare('INSERT INTO kontakte (id,nr,type,firma,name,vorname,email,phone,position,strasse,plz,stadt,land,status,kunden_id,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,`C-${String(num).padStart(3,'0')}`,d.type||'person',d.firma||'',d.name||'',d.vorname||'',d.email||'',d.phone||'',d.position||'',d.strasse||'',d.plz||'',d.stadt||'',d.land||'Deutschland',d.status||'aktiv',d.kunden_id||null,d.notes||'');
  res.json(db.prepare('SELECT * FROM kontakte WHERE id = ?').get(id));
}));

app.put('/api/kontakte/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE kontakte SET type=?,firma=?,name=?,vorname=?,email=?,phone=?,position=?,strasse=?,plz=?,stadt=?,land=?,status=?,kunden_id=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.type||'person',d.firma||'',d.name||'',d.vorname||'',d.email||'',d.phone||'',d.position||'',d.strasse||'',d.plz||'',d.stadt||'',d.land||'Deutschland',d.status||'aktiv',d.kunden_id||null,d.notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM kontakte WHERE id = ?').get(req.params.id));
}));

app.delete('/api/kontakte/:id', requireAuth, wrap(async (req, res) => {
  db.prepare('DELETE FROM kontakte WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  LIEFERANTEN
// ═══════════════════════════════════════════════════
app.get('/api/lieferanten', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM lieferanten ORDER BY company COLLATE NOCASE').all());
}));

app.post('/api/lieferanten', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const max = db.prepare("SELECT nr FROM lieferanten WHERE nr LIKE 'L-%' ORDER BY nr DESC LIMIT 1").get();
  const num = max ? (parseInt(max.nr.replace('L-','')) || 0) + 1 : 1;
  const id = uid();
  db.prepare('INSERT INTO lieferanten (id,nr,company,name,email,phone,address,payment,active,notes) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,`L-${String(num).padStart(3,'0')}`,d.company,d.name||'',d.email||'',d.phone||'',d.address||'',d.payment||30,d.active!==false?1:0,d.notes||'');
  res.json(db.prepare('SELECT * FROM lieferanten WHERE id = ?').get(id));
}));

app.put('/api/lieferanten/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE lieferanten SET company=?,name=?,email=?,phone=?,address=?,payment=?,active=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.company,d.name||'',d.email||'',d.phone||'',d.address||'',d.payment||30,d.active!==false?1:0,d.notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM lieferanten WHERE id = ?').get(req.params.id));
}));

app.delete('/api/lieferanten/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  db.prepare('DELETE FROM lieferanten WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  ARTIKEL
// ═══════════════════════════════════════════════════
app.get('/api/artikel', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM artikel ORDER BY name COLLATE NOCASE').all());
}));

app.post('/api/artikel', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  if (!d.name) return res.status(400).json({ error: 'Name erforderlich' });
  const id = uid();
  const max = db.prepare("SELECT nr FROM artikel ORDER BY CAST(REPLACE(nr,'AB_0','') AS INTEGER) DESC LIMIT 1").get();
  const num = max ? (parseInt(max.nr.replace(/\D/g,'')) || 0) + 1 : 1;
  db.prepare('INSERT INTO artikel (id,nr,name,desc,unit,price,ek,vat,cat,active) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,d.nr||`AB_${String(num).padStart(2,'0')}_TS`,d.name,d.desc||'',d.unit||'h',d.price||0,d.ek||0,d.vat||19,d.cat||'Dienstleistung',d.active!==false?1:0);
  res.json(db.prepare('SELECT * FROM artikel WHERE id = ?').get(id));
}));

app.put('/api/artikel/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE artikel SET nr=?,name=?,desc=?,unit=?,price=?,ek=?,vat=?,cat=?,active=?,updated_at=datetime("now") WHERE id=?').run(d.nr,d.name,d.desc||'',d.unit||'h',d.price||0,d.ek||0,d.vat||19,d.cat||'Dienstleistung',d.active!==false?1:0,req.params.id);
  res.json(db.prepare('SELECT * FROM artikel WHERE id = ?').get(req.params.id));
}));

app.delete('/api/artikel/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  db.prepare('DELETE FROM artikel WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  ANGEBOTE
// ═══════════════════════════════════════════════════
function getAngebotPositionen(angebotId) {
  return db.prepare('SELECT * FROM angebot_positionen WHERE angebot_id = ? ORDER BY pos').all(angebotId);
}

function savePositionen(table, parentField, parentId, items) {
  db.prepare(`DELETE FROM ${table} WHERE ${parentField} = ?`).run(parentId);
  const ins = db.prepare(`INSERT INTO ${table} (${parentField},pos,artikel_id,desc,qty,unit,price,vat,total) VALUES (?,?,?,?,?,?,?,?,?)`);
  (items || []).forEach((it, i) => ins.run(parentId, i+1, it.artikel_id||null, it.desc||'', it.qty||1, it.unit||'h', it.price||0, it.vat||19, it.total||0));
}

app.get('/api/angebote', requireAuth, wrap(async (req, res) => {
  const rows = db.prepare('SELECT * FROM angebote ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, items: getAngebotPositionen(r.id) })));
}));

app.get('/api/angebote/:id', requireAuth, wrap(async (req, res) => {
  const r = db.prepare('SELECT * FROM angebote WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ ...r, items: getAngebotPositionen(r.id) });
}));

app.post('/api/angebote', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  const yr = new Date().getFullYear();
  const max = db.prepare(`SELECT nr FROM angebote WHERE nr LIKE 'ANG-${yr}-%' ORDER BY nr DESC LIMIT 1`).get();
  const num = max ? (parseInt(max.nr.split('-')[2]) || 0) + 1 : 1;
  const nr = d.nr || `ANG-${yr}-${String(num).padStart(3,'0')}`;
  const net = (d.items||[]).reduce((s,it) => s + (it.total||0), 0);
  const vatAmt = Math.round(net * (d.vat_pct||19) / 100 * 100) / 100;
  const gross = net + vatAmt;
  db.prepare('INSERT INTO angebote (id,nr,kunden_id,customer,date,valid,status,net,vat_pct,vat_amt,gross,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,nr,d.kunden_id||null,d.customer||'',d.date||today(),d.valid||addDays(today(),30),d.status||'offen',net,d.vat_pct||19,vatAmt,gross,d.notes||'',req.user.id);
  savePositionen('angebot_positionen', 'angebot_id', id, d.items);
  logActivity(req.user.id, req.user.name, 'create', 'angebote', id, nr);
  res.json({ ...db.prepare('SELECT * FROM angebote WHERE id = ?').get(id), items: getAngebotPositionen(id) });
}));

app.put('/api/angebote/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const net = (d.items||[]).reduce((s,it) => s + (it.total||0), 0);
  const vatAmt = Math.round(net * (d.vat_pct||19) / 100 * 100) / 100;
  const gross = net + vatAmt;
  db.prepare('UPDATE angebote SET kunden_id=?,customer=?,date=?,valid=?,status=?,net=?,vat_pct=?,vat_amt=?,gross=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.kunden_id||null,d.customer||'',d.date,d.valid,d.status,net,d.vat_pct||19,vatAmt,gross,d.notes||'',req.params.id);
  savePositionen('angebot_positionen', 'angebot_id', req.params.id, d.items);
  res.json({ ...db.prepare('SELECT * FROM angebote WHERE id = ?').get(req.params.id), items: getAngebotPositionen(req.params.id) });
}));

app.delete('/api/angebote/:id', requireAuth, wrap(async (req, res) => {
  db.prepare('DELETE FROM angebote WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  AUFTRAEGE
// ═══════════════════════════════════════════════════
function getAuftragPositionen(id) {
  return db.prepare('SELECT * FROM auftrag_positionen WHERE auftrag_id = ? ORDER BY pos').all(id);
}

app.get('/api/auftraege', requireAuth, wrap(async (req, res) => {
  const rows = db.prepare('SELECT * FROM auftraege ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, items: getAuftragPositionen(r.id) })));
}));

app.post('/api/auftraege', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  const yr = new Date().getFullYear();
  const max = db.prepare(`SELECT nr FROM auftraege WHERE nr LIKE 'AU-${yr}-%' ORDER BY nr DESC LIMIT 1`).get();
  const num = max ? (parseInt(max.nr.split('-')[2]) || 0) + 1 : 1;
  const nr = d.nr || `AU-${yr}-${String(num).padStart(3,'0')}`;
  const net = (d.items||[]).reduce((s,it) => s + (it.total||0), 0);
  const vatAmt = Math.round(net * 0.19 * 100) / 100;
  const gross = net + vatAmt;
  db.prepare('INSERT INTO auftraege (id,nr,kunden_id,customer,angebot_id,date,due,status,fortschritt,net,vat_pct,vat_amt,gross,notes) VALUES (?,?,?,?,?,?,?,?,?,?,19,?,?,?)').run(id,nr,d.kunden_id||null,d.customer||'',d.angebot_id||null,d.date||today(),d.due||addDays(today(),90),d.status||'in Bearbeitung',d.fortschritt||0,net,vatAmt,gross,d.notes||'');
  savePositionen('auftrag_positionen', 'auftrag_id', id, d.items);
  res.json({ ...db.prepare('SELECT * FROM auftraege WHERE id = ?').get(id), items: getAuftragPositionen(id) });
}));

app.put('/api/auftraege/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const net = (d.items||[]).reduce((s,it) => s + (it.total||0), 0);
  const vatAmt = Math.round(net * 0.19 * 100) / 100;
  db.prepare('UPDATE auftraege SET kunden_id=?,customer=?,date=?,due=?,status=?,fortschritt=?,net=?,vat_amt=?,gross=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.kunden_id||null,d.customer||'',d.date,d.due,d.status,d.fortschritt||0,net,vatAmt,net+vatAmt,d.notes||'',req.params.id);
  if (d.items) savePositionen('auftrag_positionen', 'auftrag_id', req.params.id, d.items);
  res.json({ ...db.prepare('SELECT * FROM auftraege WHERE id = ?').get(req.params.id), items: getAuftragPositionen(req.params.id) });
}));

app.delete('/api/auftraege/:id', requireAuth, wrap(async (req, res) => {
  db.prepare('DELETE FROM auftraege WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  RECHNUNGEN (§14 UStG / GoBD)
// ═══════════════════════════════════════════════════
function getRechnungPositionen(id) {
  return db.prepare('SELECT * FROM rechnung_positionen WHERE rechnung_id = ? ORDER BY pos').all(id);
}

app.get('/api/rechnungen', requireAuth, wrap(async (req, res) => {
  const rows = db.prepare('SELECT * FROM rechnungen ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, items: getRechnungPositionen(r.id) })));
}));

app.get('/api/rechnungen/:id', requireAuth, wrap(async (req, res) => {
  const r = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ ...r, items: getRechnungPositionen(r.id) });
}));

app.post('/api/rechnungen', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  const yr = new Date().getFullYear();
  const prefix = getSetting('invoice_prefix') || 'RE';
  const max = db.prepare(`SELECT nr FROM rechnungen WHERE nr LIKE '${prefix}-${yr}-%' ORDER BY nr DESC LIMIT 1`).get();
  const num = max ? (parseInt(max.nr.split('-')[2]) || 0) + 1 : 1;
  const nr = d.nr || `${prefix}-${yr}-${String(num).padStart(3,'0')}`;
  const net = (d.items||[]).reduce((s,it) => s + (it.total||0), 0);
  const vatAmt = Math.round(net * (d.vat_pct||19) / 100 * 100) / 100;
  const gross = net + vatAmt;
  db.prepare('INSERT INTO rechnungen (id,nr,kunden_id,customer,date,due,service_date,status,immutable,is_storno,storno_ref,net,vat_pct,vat_amt,gross,notes,created_by) VALUES (?,?,?,?,?,?,?,?,0,0,"",?,19,?,?,?,?)').run(id,nr,d.kunden_id||null,d.customer||'',d.date||today(),d.due||addDays(today(),14),d.service_date||d.date||today(),d.status||'draft',net,vatAmt,gross,d.notes||'',req.user.id);
  savePositionen('rechnung_positionen', 'rechnung_id', id, d.items);
  logActivity(req.user.id, req.user.name, 'create', 'rechnungen', id, nr);
  res.json({ ...db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(id), items: getRechnungPositionen(id) });
}));

app.put('/api/rechnungen/:id', requireAuth, wrap(async (req, res) => {
  const existing = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
  // GoBD: immutable nach Versand
  if (existing.immutable) return res.status(403).json({ error: 'Rechnung ist unveränderlich (GoBD §146). Bitte Storno erstellen.' });
  const d = req.body;
  const net = (d.items||[]).reduce((s,it) => s + (it.total||0), 0);
  const vatAmt = Math.round(net * (d.vat_pct||19) / 100 * 100) / 100;
  // Mark immutable when status leaves draft
  const nowImmutable = (d.status !== 'draft') ? 1 : 0;
  db.prepare('UPDATE rechnungen SET kunden_id=?,customer=?,date=?,due=?,service_date=?,status=?,immutable=?,net=?,vat_pct=?,vat_amt=?,gross=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.kunden_id||null,d.customer||'',d.date,d.due,d.service_date||d.date,d.status,nowImmutable,net,d.vat_pct||19,vatAmt,net+vatAmt,d.notes||'',req.params.id);
  if (!existing.immutable && d.items) savePositionen('rechnung_positionen', 'rechnung_id', req.params.id, d.items);
  res.json({ ...db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id), items: getRechnungPositionen(req.params.id) });
}));

// Storno (§14 UStG)
app.post('/api/rechnungen/:id/storno', requireAuth, isMgmt, wrap(async (req, res) => {
  const inv = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Nicht gefunden' });
  if (inv.is_storno || inv.status === 'cancelled') return res.status(400).json({ error: 'Bereits storniert' });
  const yr = new Date().getFullYear();
  const stornoNr = inv.nr.replace(/^RE-/, 'SRE-').replace(/^ANG-/, 'SANG-');
  const stornoId = uid();
  db.prepare('UPDATE rechnungen SET status="cancelled", immutable=1, updated_at=datetime("now") WHERE id=?').run(inv.id);
  db.prepare('INSERT INTO rechnungen (id,nr,kunden_id,customer,date,due,service_date,status,immutable,is_storno,storno_ref,net,vat_pct,vat_amt,gross,notes,created_by) VALUES (?,?,?,?,?,?,?,"storno",1,1,?,?,19,?,?,?,?)').run(stornoId,stornoNr,inv.kunden_id,inv.customer,today(),today(),today(),inv.nr,-inv.net,-inv.vat_amt,-inv.gross,`Stornorechnung zu ${inv.nr}`,req.user.id);
  const origItems = getRechnungPositionen(inv.id);
  savePositionen('rechnung_positionen', 'rechnung_id', stornoId, origItems.map(it => ({...it, price: -it.price, total: -it.total})));
  logActivity(req.user.id, req.user.name, 'storno', 'rechnungen', stornoId, `Storno zu ${inv.nr}`);
  res.json({ storno: { ...db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(stornoId), items: getRechnungPositionen(stornoId) } });
}));

// Mark paid
app.post('/api/rechnungen/:id/paid', requireAuth, wrap(async (req, res) => {
  db.prepare('UPDATE rechnungen SET status="paid", immutable=1, updated_at=datetime("now") WHERE id=?').run(req.params.id);
  res.json(db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id));
}));

app.delete('/api/rechnungen/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  const inv = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Nicht gefunden' });
  if (inv.immutable) return res.status(403).json({ error: 'Unveränderliche Rechnung kann nicht gelöscht werden. Bitte Storno erstellen.' });
  db.prepare('DELETE FROM rechnungen WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// DATEV Export (ASCII Buchungsstapel v700)
app.get('/api/rechnungen/:id/datev', requireAuth, isMgmt, wrap(async (req, res) => {
  const inv = db.prepare('SELECT * FROM rechnungen WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Nicht gefunden' });
  const consultNr = getSetting('datev_consultant') || '1001';
  const clientNr = getSetting('datev_client') || '12345';
  const skr = getSetting('skr') || '03';
  const company = getSetting('company') || 'InvoiceFlow';
  const erloesKto = skr === '04' ? '4400' : '8400';
  const now = new Date();
  const ds = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const ts = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}000`;
  const yr = String(now.getFullYear()).slice(-2);
  const p = inv.date.split('.');
  const bd = `${(p[0]||'01').padStart(2,'0')}${(p[1]||'01').padStart(2,'0')}`;
  const gross = Math.abs(inv.gross);
  const header = `"EXTF";700;21;"Buchungsstapel";7;${ds}${ts};"";"RE";"";;${consultNr};${clientNr};${yr}01;0;${yr}01;${yr}12;"${company.replace(/"/g,'""')}";;;"EUR";;0;;;\r\n`;
  const cols = `"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext"\r\n`;
  const row = `${gross.toFixed(2).replace('.',',')};"${inv.gross<0?'H':'S'}";"EUR";;;"10000";"${erloesKto}";"9";"${bd}";"${inv.nr}";"${inv.nr}";;"${(inv.is_storno?'Storno ':'')+inv.nr} ${inv.customer}"\r\n`;
  const csv = '\uFEFF' + header + cols + row;
  db.prepare('UPDATE rechnungen SET datev_exported=1, datev_exported_at=datetime("now") WHERE id=?').run(inv.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="DATEV_${inv.nr}_${ds}.csv"`);
  res.send(csv);
}));

// ═══════════════════════════════════════════════════
//  PROJEKTE & ZEITERFASSUNG
// ═══════════════════════════════════════════════════
app.get('/api/projekte', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM projekte ORDER BY created_at DESC').all());
}));

app.post('/api/projekte', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  const max = db.prepare("SELECT nr FROM projekte WHERE nr LIKE 'P-%' ORDER BY nr DESC LIMIT 1").get();
  const num = max ? (parseInt(max.nr.replace('P-','')) || 0) + 1 : 1;
  db.prepare('INSERT INTO projekte (id,nr,name,kunden_id,client,status,budget,spent,start,end,color,notes) VALUES (?,?,?,?,?,?,?,0,?,?,?,?)').run(id,`P-${String(num).padStart(3,'0')}`,d.name,d.kunden_id||null,d.client||'',d.status||'active',d.budget||0,d.start||today(),d.end||'',d.color||'#f0b429',d.notes||'');
  res.json(db.prepare('SELECT * FROM projekte WHERE id = ?').get(id));
}));

app.put('/api/projekte/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE projekte SET name=?,kunden_id=?,client=?,status=?,budget=?,spent=?,start=?,end=?,color=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.name,d.kunden_id||null,d.client||'',d.status||'active',d.budget||0,d.spent||0,d.start||'',d.end||'',d.color||'#f0b429',d.notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM projekte WHERE id = ?').get(req.params.id));
}));

app.delete('/api/projekte/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  db.prepare('DELETE FROM projekte WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/zeiterfassung', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM zeiterfassung ORDER BY date DESC, created_at DESC').all());
}));

app.post('/api/zeiterfassung', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  const total = (d.hours||0) * (d.rate||120);
  db.prepare('INSERT INTO zeiterfassung (id,projekt_id,user_id,user_name,date,desc,hours,rate,total,status) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,d.projekt_id||null,req.user.id,req.user.name,d.date||today(),d.desc||'',d.hours||0,d.rate||120,total,d.status||'open');
  res.json(db.prepare('SELECT * FROM zeiterfassung WHERE id = ?').get(id));
}));

app.put('/api/zeiterfassung/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const total = (d.hours||0) * (d.rate||120);
  db.prepare('UPDATE zeiterfassung SET projekt_id=?,user_name=?,date=?,desc=?,hours=?,rate=?,total=?,status=? WHERE id=?').run(d.projekt_id||null,d.user_name||req.user.name,d.date,d.desc||'',d.hours||0,d.rate||120,total,d.status||'open',req.params.id);
  res.json(db.prepare('SELECT * FROM zeiterfassung WHERE id = ?').get(req.params.id));
}));

app.delete('/api/zeiterfassung/:id', requireAuth, wrap(async (req, res) => {
  db.prepare('DELETE FROM zeiterfassung WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  CHANCEN
// ═══════════════════════════════════════════════════
app.get('/api/chancen', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM chancen ORDER BY wert DESC').all());
}));

app.post('/api/chancen', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  db.prepare('INSERT INTO chancen (id,name,firma,kunden_id,wert,phase,wahrscheinlichkeit,erwartet,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,d.name,d.firma||'',d.kunden_id||null,d.wert||0,d.phase||'Qualifizierung',d.wahrscheinlichkeit||20,d.erwartet||'',d.status||'offen',d.notes||'');
  res.json(db.prepare('SELECT * FROM chancen WHERE id = ?').get(id));
}));

app.put('/api/chancen/:id', requireAuth, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE chancen SET name=?,firma=?,kunden_id=?,wert=?,phase=?,wahrscheinlichkeit=?,erwartet=?,status=?,notes=?,updated_at=datetime("now") WHERE id=?').run(d.name,d.firma||'',d.kunden_id||null,d.wert||0,d.phase||'Qualifizierung',d.wahrscheinlichkeit||20,d.erwartet||'',d.status||'offen',d.notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM chancen WHERE id = ?').get(req.params.id));
}));

app.delete('/api/chancen/:id', requireAuth, wrap(async (req, res) => {
  db.prepare('DELETE FROM chancen WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  BELEGE & VERSICHERUNGEN
// ═══════════════════════════════════════════════════
app.get('/api/belege', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM belege ORDER BY date DESC').all());
}));

app.post('/api/belege', requireAuth, upload.single('file'), wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  db.prepare('INSERT INTO belege (id,date,vendor,amount,cat,notes,file_path,status) VALUES (?,?,?,?,?,?,?,?)').run(id,d.date||today(),d.vendor||'',d.amount||0,d.cat||'Sonstiges',d.notes||'',req.file?.filename||'',d.status||'open');
  res.json(db.prepare('SELECT * FROM belege WHERE id = ?').get(id));
}));

app.get('/api/versicherungen', requireAuth, wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM versicherungen ORDER BY end ASC').all());
}));

app.post('/api/versicherungen', requireAuth, isMgmt, wrap(async (req, res) => {
  const d = req.body;
  const id = uid();
  db.prepare('INSERT INTO versicherungen (id,name,insurer,nr,premium,start,end,status,coverage,cat,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,d.name,d.insurer||'',d.nr||'',d.premium||0,d.start||'',d.end||'',d.status||'active',d.coverage||'',d.cat||'Haftpflicht',d.notes||'');
  res.json(db.prepare('SELECT * FROM versicherungen WHERE id = ?').get(id));
}));

app.put('/api/versicherungen/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  const d = req.body;
  db.prepare('UPDATE versicherungen SET name=?,insurer=?,nr=?,premium=?,start=?,end=?,status=?,coverage=?,cat=?,notes=? WHERE id=?').run(d.name,d.insurer||'',d.nr||'',d.premium||0,d.start||'',d.end||'',d.status||'active',d.coverage||'',d.cat||'Haftpflicht',d.notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM versicherungen WHERE id = ?').get(req.params.id));
}));

app.delete('/api/versicherungen/:id', requireAuth, isMgmt, wrap(async (req, res) => {
  db.prepare('DELETE FROM versicherungen WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════
//  SETTINGS & USERS
// ═══════════════════════════════════════════════════
app.get('/api/settings', requireAuth, wrap(async (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  // Don't expose SMTP password
  if (obj.smtp_pass) obj.smtp_pass = '***';
  res.json(obj);
}));

app.put('/api/settings', requireAuth, isMgmt, wrap(async (req, res) => {
  const up = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((data) => {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'smtp_pass' && v === '***') continue;
      up.run(k, v);
    }
  });
  tx(req.body);
  res.json({ ok: true });
}));

app.get('/api/users', requireAuth, isAdmin, wrap(async (req, res) => {
  res.json(db.prepare('SELECT id,email,name,role,dept,active,created_at FROM users ORDER BY name').all());
}));

app.post('/api/users', requireAuth, isAdmin, wrap(async (req, res) => {
  const d = req.body;
  if (!d.email || !d.password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  const hash = bcrypt.hashSync(d.password, 10);
  const info = db.prepare('INSERT INTO users (email,password,name,role,dept,active) VALUES (?,?,?,?,?,?)').run(d.email.toLowerCase(),hash,d.name||'',d.role||'employee',d.dept||'',d.active!==false?1:0);
  res.json(db.prepare('SELECT id,email,name,role,dept,active FROM users WHERE id=?').get(info.lastInsertRowid));
}));

app.put('/api/users/:id', requireAuth, isAdmin, wrap(async (req, res) => {
  const d = req.body;
  if (d.password) {
    db.prepare('UPDATE users SET email=?,password=?,name=?,role=?,dept=?,active=? WHERE id=?').run(d.email,bcrypt.hashSync(d.password,10),d.name,d.role,d.dept||'',d.active?1:0,req.params.id);
  } else {
    db.prepare('UPDATE users SET email=?,name=?,role=?,dept=?,active=? WHERE id=?').run(d.email,d.name,d.role,d.dept||'',d.active?1:0,req.params.id);
  }
  res.json(db.prepare('SELECT id,email,name,role,dept,active FROM users WHERE id=?').get(req.params.id));
}));

// ═══════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════
app.get('/api/dashboard', requireAuth, wrap(async (req, res) => {
  const revenue = db.prepare("SELECT COALESCE(SUM(gross),0) as v FROM rechnungen WHERE status='paid'").get().v;
  const openAmt = db.prepare("SELECT COALESCE(SUM(gross),0) as v FROM rechnungen WHERE status IN ('open','overdue')").get().v;
  const overdue = db.prepare("SELECT COUNT(*) as c FROM rechnungen WHERE status='overdue'").get().c;
  const pipeline = db.prepare('SELECT COALESCE(SUM(wert * wahrscheinlichkeit / 100.0),0) as v FROM chancen').get().v;
  const activeKunden = db.prepare('SELECT COUNT(*) as c FROM kunden WHERE active=1').get().c;
  const activeAngebote = db.prepare("SELECT COUNT(*) as c FROM angebote WHERE status IN ('offen','versendet')").get().c;
  const recentInvoices = db.prepare('SELECT id,nr,customer,gross,status FROM rechnungen ORDER BY created_at DESC LIMIT 5').all();
  const activeProjekte = db.prepare("SELECT p.*, k.company as kunden_company FROM projekte p LEFT JOIN kunden k ON p.kunden_id=k.id WHERE p.status='active' ORDER BY p.created_at DESC LIMIT 3").all();
  const phases = db.prepare("SELECT phase, COALESCE(SUM(wert),0) as total FROM chancen GROUP BY phase").all();
  const topKunden = db.prepare('SELECT id,nr,company,revenue FROM kunden ORDER BY revenue DESC LIMIT 5').all();
  const recentActivity = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10').all();
  res.json({ revenue, openAmt, overdue, pipeline, activeKunden, activeAngebote, recentInvoices, activeProjekte, phases, topKunden, recentActivity });
}));

// ─── Error Handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack?.split('\n')[1]);
  res.status(500).json({ error: 'Serverfehler: ' + err.message });
});

// ─── Start ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  InvoiceFlow Pro`);
  console.log(`  Port: ${PORT}`);
  console.log(`  DB:   ${process.env.DATA_DIR || './data'}/invoiceflow.sqlite`);
  console.log(`  Env:  ${process.env.NODE_ENV || 'development'}\n`);
});
