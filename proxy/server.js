/**
 * InvoiceFlow Pro — Weclapp API CORS Proxy
 * 
 * Leitet Anfragen vom Browser sicher an die Weclapp REST API v2 weiter.
 * Schützt den API-Token vor direkter Browser-Exposition.
 * 
 * Endpunkt: POST /api/weclapp
 * Body: { tenant, token, method, endpoint, body? }
 */

const express    = require('express');
const https      = require('https');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Sicherheit ────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// CORS: nur eigene Domain erlaubt
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost,http://localhost:8080')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Postman / Server-zu-Server ohne Origin erlauben
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
      return cb(null, true);
    }
    cb(new Error(`CORS blockiert: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting: max 60 Anfragen / Minute pro IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Zu viele Anfragen. Bitte warte eine Minute.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'InvoiceFlow Weclapp Proxy', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Hilfsfunktion: Weclapp API-Anfrage ───────────────────
function weclappRequest({ tenant, token, method = 'GET', endpoint, body = null }) {
  return new Promise((resolve, reject) => {
    if (!tenant || !token || !endpoint) {
      return reject(new Error('tenant, token und endpoint sind Pflichtfelder'));
    }

    // Sicherheits-Whitelist: nur erlaubte Weclapp-Endpoints
    const ALLOWED_ENDPOINTS = [
      'salesInvoice', 'salesOrder', 'quotation', 'party', 'customer',
      'article', 'timeRecord', 'contract', 'ticket', 'warehouse',
      'warehouseStock', 'user', 'currency', 'taxRate', 'unitOfMeasurement',
      'paymentMethod', 'shipmentMethod', 'incomingGoods', 'shipment',
    ];
    const base = endpoint.split('?')[0].split('/')[0];
    if (!ALLOWED_ENDPOINTS.includes(base)) {
      return reject(new Error(`Endpoint nicht erlaubt: ${base}`));
    }

    const path  = `/webapp/api/v2/${endpoint}`;
    const data  = body ? JSON.stringify(body) : null;
    const options = {
      hostname: `${tenant}.weclapp.com`,
      port: 443,
      path,
      method: method.toUpperCase(),
      headers: {
        'AuthenticationToken': token,
        'Accept':              'application/json',
        'Content-Type':        'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: raw });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Weclapp API Timeout (10s)')); });
    if (data) req.write(data);
    req.end();
  });
}

// ── Haupt-Proxy-Endpoint ──────────────────────────────────
app.post('/api/weclapp', async (req, res) => {
  const { tenant, token, method = 'GET', endpoint, body } = req.body;

  if (!tenant || !token || !endpoint) {
    return res.status(400).json({ error: 'tenant, token, endpoint erforderlich' });
  }

  // Tenant-Format validieren (nur alphanumerisch + Bindestrich)
  if (!/^[a-zA-Z0-9-]+$/.test(tenant)) {
    return res.status(400).json({ error: 'Ungültiges Tenant-Format' });
  }

  // Token-Format validieren (UUID-ähnlich)
  if (!/^[a-fA-F0-9-]{8,}$/.test(token)) {
    return res.status(400).json({ error: 'Ungültiges Token-Format' });
  }

  try {
    const result = await weclappRequest({ tenant, token, method, endpoint, body });
    console.log(`[PROXY] ${method} /v2/${endpoint} → ${result.status} (${tenant})`);
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error(`[PROXY ERROR] ${err.message}`);
    res.status(502).json({ error: err.message || 'Proxy-Fehler' });
  }
});

// ── Verbindungstest ───────────────────────────────────────
app.post('/api/weclapp/test', async (req, res) => {
  const { tenant, token } = req.body;
  if (!tenant || !token) return res.status(400).json({ error: 'tenant und token erforderlich' });

  try {
    const result = await weclappRequest({
      tenant, token, method: 'GET',
      endpoint: 'user/currentUser',
    });
    if (result.status === 200) {
      res.json({ ok: true, user: result.data, tenant: `${tenant}.weclapp.com` });
    } else {
      res.status(result.status).json({ ok: false, error: `Status ${result.status}`, detail: result.data });
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ InvoiceFlow Weclapp Proxy läuft auf Port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  CORS erlaubt für: ${ALLOWED_ORIGINS.join(', ')}`);
});
