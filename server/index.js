const express = require('express')
const cors    = require('cors')
const bcrypt  = require('bcryptjs')
const path    = require('path')
const { pool, init } = require('./db')
const { migrate, migrateSettings } = require('./migrate')
const auth           = require('./auth')

const app  = express()
const PORT = process.env.PORT || 3000
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Felder fehlen' })
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND active=true', [email])
    const user = rows[0]
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' })
    const token = auth.sign({ id: user.id, name: user.name, email: user.email, role: user.role })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/auth/me', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/auth/password', auth.verify, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id])
    if (!bcrypt.compareSync(currentPassword, rows[0].password))
      return res.status(401).json({ error: 'Aktuelles Passwort falsch' })
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [bcrypt.hashSync(newPassword, 10), req.user.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Users ─────────────────────────────────────────────────────────────────────
app.get('/api/users', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at DESC')
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/users', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!name||!email||!password||!role) return res.status(400).json({ error: 'Alle Felder erforderlich' })
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role',
      [name, email, bcrypt.hashSync(password, 10), role])
    res.status(201).json(rows[0])
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-Mail bereits vergeben' })
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/users/:id', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    const { name, email, role, active, password } = req.body
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const u = rows[0]
    if (password) {
      await pool.query('UPDATE users SET name=$1,email=$2,role=$3,active=$4,password=$5 WHERE id=$6',
        [name??u.name, email??u.email, role??u.role, active??u.active, bcrypt.hashSync(password,10), u.id])
    } else {
      await pool.query('UPDATE users SET name=$1,email=$2,role=$3,active=$4 WHERE id=$5',
        [name??u.name, email??u.email, role??u.role, active??u.active, u.id])
    }
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/users/:id', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Eigenen Account nicht löschbar' })
    await pool.query('UPDATE users SET active=false WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Articles ──────────────────────────────────────────────────────────────────
app.get('/api/articles/all', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM articles ORDER BY category, name')
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/articles/for-customer/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*,
        COALESCE(cap.price, a.price) AS effective_price,
        cap.price AS customer_price,
        cap.note  AS customer_price_note
      FROM articles a
      LEFT JOIN customer_article_prices cap ON cap.article_id=a.id AND cap.customer_id=$1
      WHERE a.active=true ORDER BY a.category, a.name`, [req.params.id])
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/articles/:id/prices', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cap.*, c.name AS customer_name, c.customer_number
      FROM customer_article_prices cap
      JOIN customers c ON cap.customer_id=c.id
      WHERE cap.article_id=$1`, [req.params.id])
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/articles/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM articles WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/articles', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM articles WHERE active=true ORDER BY category, name')
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/articles', auth.verify, async (req, res) => {
  try {
    const { number, name, description, unit, price, category } = req.body
    if (!name) return res.status(400).json({ error: 'Name erforderlich' })
    const { rows } = await pool.query(
      `INSERT INTO articles (number,name,description,unit,price,category,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [number||null, name, description||null, unit||'Std.', price||0, category||null, req.user.id])
    res.status(201).json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/articles/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM articles WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const a = rows[0]
    const { number, name, description, unit, price, category, active } = req.body
    await pool.query(
      `UPDATE articles SET number=$1,name=$2,description=$3,unit=$4,price=$5,
       category=$6,active=$7,updated_at=NOW() WHERE id=$8`,
      [number??a.number, name??a.name, description??a.description, unit??a.unit,
       price??a.price, category??a.category, active!==undefined?active:a.active, a.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/articles/:id', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    await pool.query('UPDATE articles SET active=false WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Customer article prices ───────────────────────────────────────────────────
app.get('/api/customers/:id/prices', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cap.*, a.name AS article_name, a.number AS article_number, a.unit, a.price AS default_price
      FROM customer_article_prices cap JOIN articles a ON cap.article_id=a.id
      WHERE cap.customer_id=$1`, [req.params.id])
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/customers/:id/prices', auth.verify, async (req, res) => {
  try {
    const { article_id, price, note } = req.body
    if (!article_id || price === undefined) return res.status(400).json({ error: 'Felder fehlen' })
    await pool.query(
      `INSERT INTO customer_article_prices (customer_id,article_id,price,note)
       VALUES ($1,$2,$3,$4) ON CONFLICT (customer_id,article_id) DO UPDATE SET price=$3,note=$4`,
      [req.params.id, article_id, price, note||null])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/customers/:id/prices/:article_id', auth.verify, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_article_prices WHERE customer_id=$1 AND article_id=$2',
      [req.params.id, req.params.article_id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Customers ─────────────────────────────────────────────────────────────────
app.get('/api/customers', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        COUNT(DISTINCT q.id) AS quote_count,
        COUNT(DISTINCT CASE WHEN q.status='accepted' THEN q.id END) AS accepted_count,
        COALESCE(SUM(CASE WHEN q.status='accepted'
          THEN (SELECT COALESCE(SUM((r->>'qty')::numeric*(r->>'price')::numeric),0)
                FROM jsonb_array_elements(q.rows) r WHERE r->>'type'='item') END),0) AS revenue_net,
        COALESCE(SUM(
          (SELECT COALESCE(SUM((r->>'qty')::numeric*(r->>'price')::numeric),0)
           FROM jsonb_array_elements(q.rows) r WHERE r->>'type'='item')),0) AS total_quoted,
        (SELECT row_to_json(a) FROM customer_addresses a
         WHERE a.customer_id=c.id AND a.is_default=true LIMIT 1) AS default_address,
        (SELECT row_to_json(ct) FROM customer_contacts ct
         WHERE ct.customer_id=c.id AND ct.is_primary=true LIMIT 1) AS primary_contact
      FROM customers c LEFT JOIN quotes q ON q.customer_id=c.id
      GROUP BY c.id ORDER BY c.name ASC`)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/customers/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const customer = rows[0]
    const [addresses, contacts, quotes, prices] = await Promise.all([
      pool.query('SELECT * FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC', [customer.id]),
      pool.query('SELECT * FROM customer_contacts WHERE customer_id=$1 ORDER BY is_primary DESC', [customer.id]),
      pool.query(`
        SELECT q.*, u.name AS owner_name,
          (SELECT COALESCE(SUM((r->>'qty')::numeric*(r->>'price')::numeric),0)
           FROM jsonb_array_elements(q.rows) r WHERE r->>'type'='item') AS net_total
        FROM quotes q JOIN users u ON q.owner_id=u.id
        WHERE q.customer_id=$1 ORDER BY q.created_at DESC`, [customer.id]),
      pool.query(`
        SELECT cap.*, a.name AS article_name, a.number AS article_number, a.unit, a.price AS default_price
        FROM customer_article_prices cap JOIN articles a ON cap.article_id=a.id
        WHERE cap.customer_id=$1`, [customer.id]),
    ])
    res.json({ ...customer, addresses: addresses.rows, contacts: contacts.rows,
               quotes: quotes.rows, custom_prices: prices.rows })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/customers', auth.verify, async (req, res) => {
  const { name, short_name, customer_number, payment_days, payment_note,
          website, industry, notes, addresses = [], contacts = [] } = req.body
  if (!name) return res.status(400).json({ error: 'Name erforderlich' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO customers (name,short_name,customer_number,payment_days,payment_note,website,industry,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, short_name||null, customer_number||null, payment_days||30,
       payment_note||null, website||null, industry||null, notes||null, req.user.id])
    const cid = rows[0].id
    for (const a of addresses) {
      await client.query(
        `INSERT INTO customer_addresses (customer_id,type,label,street,zip,city,country,is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cid, a.type||'main', a.label||null, a.street||null, a.zip||null,
         a.city||null, a.country||'Deutschland', !!a.is_default])
    }
    for (const c of contacts) {
      await client.query(
        `INSERT INTO customer_contacts (customer_id,salutation,first_name,last_name,position,email,phone,mobile,is_primary,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [cid, c.salutation||null, c.first_name||null, c.last_name||'',
         c.position||null, c.email||null, c.phone||null, c.mobile||null, !!c.is_primary, c.notes||null])
    }
    await client.query('COMMIT')
    res.status(201).json({ id: cid })
  } catch(e) {
    await client.query('ROLLBACK')
    if (e.code === '23505') return res.status(409).json({ error: 'Kundennummer bereits vergeben' })
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

app.put('/api/customers/:id', auth.verify, async (req, res) => {
  const { name, short_name, customer_number, payment_days, payment_note,
          website, industry, notes, addresses, contacts } = req.body
  const { rows } = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
  const c = rows[0]
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE customers SET name=$1,short_name=$2,customer_number=$3,payment_days=$4,
       payment_note=$5,website=$6,industry=$7,notes=$8,updated_at=NOW() WHERE id=$9`,
      [name??c.name, short_name??c.short_name, customer_number??c.customer_number,
       payment_days??c.payment_days, payment_note??c.payment_note, website??c.website,
       industry??c.industry, notes??c.notes, c.id])
    if (addresses !== undefined) {
      await client.query('DELETE FROM customer_addresses WHERE customer_id=$1', [c.id])
      for (const a of addresses) {
        await client.query(
          `INSERT INTO customer_addresses (customer_id,type,label,street,zip,city,country,is_default)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [c.id, a.type||'main', a.label||null, a.street||null, a.zip||null,
           a.city||null, a.country||'Deutschland', !!a.is_default])
      }
    }
    if (contacts !== undefined) {
      await client.query('DELETE FROM customer_contacts WHERE customer_id=$1', [c.id])
      for (const ct of contacts) {
        await client.query(
          `INSERT INTO customer_contacts (customer_id,salutation,first_name,last_name,position,email,phone,mobile,is_primary,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [c.id, ct.salutation||null, ct.first_name||null, ct.last_name||'',
           ct.position||null, ct.email||null, ct.phone||null, ct.mobile||null, !!ct.is_primary, ct.notes||null])
      }
    }
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

app.delete('/api/customers/:id', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Contacts ──────────────────────────────────────────────────────────────────
app.get('/api/contacts', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, cu.name AS customer_name
      FROM contacts c
      LEFT JOIN customers cu ON c.converted_to_customer=cu.id
      ORDER BY c.last_name, c.first_name, c.company`)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/contacts/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, cu.name AS customer_name FROM contacts c
      LEFT JOIN customers cu ON c.converted_to_customer=cu.id WHERE c.id=$1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/contacts', auth.verify, async (req, res) => {
  try {
    const { contact_type, relationship, salutation, first_name, last_name,
            company, email, phone, street, zip, city, state, country, notes } = req.body
    const { rows } = await pool.query(
      `INSERT INTO contacts (contact_type,relationship,salutation,first_name,last_name,
        company,email,phone,street,zip,city,state,country,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [contact_type||'person', relationship||[], salutation||null,
       first_name||null, last_name||null, company||null, email||null,
       phone||null, street||null, zip||null, city||null, state||null,
       country||'Deutschland', notes||null, req.user.id])
    res.status(201).json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/contacts/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM contacts WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const c = rows[0]
    const { contact_type, relationship, salutation, first_name, last_name,
            company, email, phone, street, zip, city, state, country, notes } = req.body
    await pool.query(
      `UPDATE contacts SET contact_type=$1,relationship=$2,salutation=$3,first_name=$4,
        last_name=$5,company=$6,email=$7,phone=$8,street=$9,zip=$10,city=$11,
        state=$12,country=$13,notes=$14,updated_at=NOW() WHERE id=$15`,
      [contact_type??c.contact_type, relationship??c.relationship,
       salutation??c.salutation, first_name??c.first_name, last_name??c.last_name,
       company??c.company, email??c.email, phone??c.phone, street??c.street,
       zip??c.zip, city??c.city, state??c.state, country??c.country, notes??c.notes, c.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/contacts/:id', auth.verify, async (req, res) => {
  try {
    await pool.query('DELETE FROM contacts WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/contacts/:id/convert', auth.verify, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM contacts WHERE id=$1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
  const contact = rows[0]
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: cust } = await client.query(
      `INSERT INTO customers (name,payment_days,notes,created_by) VALUES ($1,30,$2,$3) RETURNING id`,
      [contact.company || `${contact.first_name||''} ${contact.last_name||''}`.trim(),
       contact.notes||null, req.user.id])
    const cid = cust[0].id
    if (contact.street || contact.city) {
      await client.query(
        `INSERT INTO customer_addresses (customer_id,type,street,zip,city,state,country,is_default)
         VALUES ($1,'main',$2,$3,$4,$5,$6,true)`,
        [cid, contact.street||null, contact.zip||null,
         contact.city||null, contact.state||null, contact.country||'Deutschland'])
    }
    if (contact.first_name || contact.last_name) {
      await client.query(
        `INSERT INTO customer_contacts (customer_id,salutation,first_name,last_name,email,phone,is_primary)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [cid, contact.salutation||null, contact.first_name||null,
         contact.last_name||'', contact.email||null, contact.phone||null])
    }
    await client.query(
      `UPDATE contacts SET converted_to_customer=$1,
        relationship=array_append(relationship,'Kunde'),updated_at=NOW() WHERE id=$2`,
      [cid, contact.id])
    await client.query('COMMIT')
    res.json({ ok: true, customer_id: cid })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

// ── Suppliers ─────────────────────────────────────────────────────────────────
app.get('/api/suppliers', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM suppliers WHERE active=true ORDER BY company NULLS LAST, last_name')
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/suppliers/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/suppliers', auth.verify, async (req, res) => {
  try {
    const { contact_type, company, salutation, first_name, last_name,
            email, phone, website, street, zip, city, state, country, category, notes } = req.body
    const { rows } = await pool.query(
      `INSERT INTO suppliers (contact_type,company,salutation,first_name,last_name,
        email,phone,website,street,zip,city,state,country,category,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [contact_type||'company', company||null, salutation||null,
       first_name||null, last_name||null, email||null, phone||null,
       website||null, street||null, zip||null, city||null,
       state||null, country||'Deutschland', category||null, notes||null, req.user.id])
    res.status(201).json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/suppliers/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const s = rows[0]
    const { contact_type, company, salutation, first_name, last_name,
            email, phone, website, street, zip, city, state, country, category, notes, active } = req.body
    await pool.query(
      `UPDATE suppliers SET contact_type=$1,company=$2,salutation=$3,first_name=$4,
        last_name=$5,email=$6,phone=$7,website=$8,street=$9,zip=$10,city=$11,
        state=$12,country=$13,category=$14,notes=$15,active=$16,updated_at=NOW() WHERE id=$17`,
      [contact_type??s.contact_type, company??s.company, salutation??s.salutation,
       first_name??s.first_name, last_name??s.last_name, email??s.email,
       phone??s.phone, website??s.website, street??s.street, zip??s.zip,
       city??s.city, state??s.state, country??s.country, category??s.category,
       notes??s.notes, active!==undefined?active:s.active, s.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/suppliers/:id', auth.verify, async (req, res) => {
  try {
    await pool.query('UPDATE suppliers SET active=false WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats/customers', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.customer_number, c.payment_days,
        COUNT(DISTINCT q.id) AS quote_count,
        COUNT(DISTINCT CASE WHEN q.status='accepted' THEN q.id END) AS accepted_count,
        COUNT(DISTINCT CASE WHEN q.status='rejected' THEN q.id END) AS rejected_count,
        COUNT(DISTINCT CASE WHEN q.status='draft'    THEN q.id END) AS draft_count,
        COALESCE(SUM(CASE WHEN q.status='accepted'
          THEN (SELECT COALESCE(SUM((r->>'qty')::numeric*(r->>'price')::numeric),0)
                FROM jsonb_array_elements(q.rows) r WHERE r->>'type'='item') END),0)::numeric(12,2) AS revenue_net,
        COALESCE(SUM(
          (SELECT COALESCE(SUM((r->>'qty')::numeric*(r->>'price')::numeric),0)
           FROM jsonb_array_elements(q.rows) r WHERE r->>'type'='item')),0)::numeric(12,2) AS total_quoted
      FROM customers c LEFT JOIN quotes q ON q.customer_id=c.id
      GROUP BY c.id ORDER BY revenue_net DESC`)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Quotes ────────────────────────────────────────────────────────────────────
app.get('/api/quotes', auth.verify, async (req, res) => {
  try {
    const base = `
      SELECT qt.*, u.name AS owner_name, c.name AS customer_name,
        (SELECT COALESCE(SUM((r->>'qty')::numeric*(r->>'price')::numeric),0)
         FROM jsonb_array_elements(qt.rows) r WHERE r->>'type'='item') AS net_total
      FROM quotes qt JOIN users u ON qt.owner_id=u.id LEFT JOIN customers c ON qt.customer_id=c.id`
    const q = req.user.role === 'geschaeftsfuehrung'
      ? await pool.query(base + ' ORDER BY qt.updated_at DESC')
      : await pool.query(base + ' WHERE qt.owner_id=$1 ORDER BY qt.updated_at DESC', [req.user.id])
    res.json(q.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/quotes/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT qt.*, u.name AS owner_name FROM quotes qt
      JOIN users u ON qt.owner_id=u.id WHERE qt.id=$1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    if (rows[0].owner_id !== req.user.id && req.user.role !== 'geschaeftsfuehrung')
      return res.status(403).json({ error: 'Keine Berechtigung' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/quotes', auth.verify, async (req, res) => {
  try {
    const { number, customer_id, customer, meta, rows, status } = req.body
    const { rows: r } = await pool.query(
      `INSERT INTO quotes (number,owner_id,customer_id,customer,meta,rows,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [number||'NEU', req.user.id, customer_id||null,
       JSON.stringify(customer||{}), JSON.stringify(meta||{}),
       JSON.stringify(rows||[]), status||'draft'])
    res.status(201).json({ id: r[0].id })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/quotes/:id', auth.verify, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM quotes WHERE id=$1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const q = existing[0]
    if (q.owner_id !== req.user.id && req.user.role !== 'geschaeftsfuehrung')
      return res.status(403).json({ error: 'Keine Berechtigung' })
    const { number, customer_id, customer, meta, rows, status } = req.body
    await pool.query(
      `UPDATE quotes SET number=$1,customer_id=$2,customer=$3,meta=$4,rows=$5,status=$6,updated_at=NOW() WHERE id=$7`,
      [number??q.number, customer_id!==undefined?customer_id:q.customer_id,
       JSON.stringify(customer??q.customer), JSON.stringify(meta??q.meta),
       JSON.stringify(rows??q.rows), status??q.status, q.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/quotes/:id/approve', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    await pool.query('UPDATE quotes SET status=$1,approved_by=$2,approved_at=NOW(),updated_at=NOW() WHERE id=$3',
      ['accepted', req.user.id, req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/quotes/:id/reject', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    await pool.query('UPDATE quotes SET status=$1,updated_at=NOW() WHERE id=$2', ['rejected', req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/quotes/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    if (rows[0].owner_id !== req.user.id && req.user.role !== 'geschaeftsfuehrung')
      return res.status(403).json({ error: 'Keine Berechtigung' })
    await pool.query('DELETE FROM quotes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings ORDER BY key')
    const obj = {}
    rows.forEach(r => { obj[r.key] = r.value })
    res.json(obj)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/settings', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    const entries = Object.entries(req.body)
    if (entries.length === 0) return res.json({ ok: true })
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, value ?? '']
      )
    }
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// Logo upload (base64 stored in settings)
app.post('/api/settings/logo', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    const { data } = req.body  // base64 data URL
    if (!data) return res.status(400).json({ error: 'Keine Bilddaten' })
    if (data.length > 2_000_000) return res.status(400).json({ error: 'Bild zu groß (max 1.5 MB)' })
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('logo_data', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [data]
    )
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/settings/logo', auth.verify, auth.requireManagement, async (req, res) => {
  try {
    await pool.query("UPDATE settings SET value='' WHERE key='logo_data'")
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


// ── Orders ────────────────────────────────────────────────────────────────────

// Generate next order number
const nextNumber = async (settingKey, prefix) => {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key=$1", [settingKey])
  const next = (parseInt(rows[0]?.value || '0') + 1).toString().padStart(4, '0')
  await pool.query("UPDATE settings SET value=$1 WHERE key=$2", [next, settingKey])
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${next}`
}

app.get('/api/orders', auth.verify, async (req, res) => {
  try {
    const base = `
      SELECT o.*, u.name AS owner_name, c.name AS customer_name
      FROM orders o
      JOIN users u ON o.owner_id=u.id
      LEFT JOIN customers c ON o.customer_id=c.id`
    const q = req.user.role === 'geschaeftsfuehrung'
      ? await pool.query(base + ' ORDER BY o.created_at DESC')
      : await pool.query(base + ' WHERE o.owner_id=$1 ORDER BY o.created_at DESC', [req.user.id])
    res.json(q.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/orders/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, u.name AS owner_name FROM orders o
       JOIN users u ON o.owner_id=u.id WHERE o.id=$1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// Convert quote → order
app.post('/api/quotes/:id/convert-to-order', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Angebot nicht gefunden' })
    const quote = rows[0]
    const { rows: prefRow } = await pool.query("SELECT value FROM settings WHERE key='order_prefix'")
    const prefix = prefRow[0]?.value || 'AU'
    const orderNumber = await nextNumber('last_order_number', prefix)
    const { rows: order } = await pool.query(
      `INSERT INTO orders (order_number,quote_id,customer_id,owner_id,customer,meta,rows,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open') RETURNING id,order_number`,
      [orderNumber, quote.id, quote.customer_id, req.user.id,
       quote.customer, quote.meta, quote.rows])
    // Mark quote as accepted
    await pool.query("UPDATE quotes SET status='accepted',updated_at=NOW() WHERE id=$1", [quote.id])
    res.json({ ok: true, order_id: order[0].id, order_number: order[0].order_number })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/orders/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    const o = rows[0]
    const { rows: rawRows, meta, status, notes } = req.body
    await pool.query(
      `UPDATE orders SET rows=$1,meta=$2,status=$3,notes=$4,updated_at=NOW() WHERE id=$5`,
      [JSON.stringify(rawRows ?? o.rows), JSON.stringify(meta ?? o.meta),
       status ?? o.status, notes ?? o.notes, o.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// Complete order → auto-create invoice
app.post('/api/orders/:id/complete', auth.verify, async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM orders WHERE id=$1', [req.params.id])
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Nicht gefunden' }) }
    const order = rows[0]

    // Calculate totals
    const orderRows = Array.isArray(order.rows) ? order.rows : JSON.parse(order.rows || '[]')
    const netTotal = orderRows.reduce((s, r) => {
      if (r.type === 'item' && r.qty && r.price) return s + Number(r.qty) * Number(r.price)
      return s
    }, 0)
    const { rows: vatRow } = await client.query("SELECT value FROM settings WHERE key='vat_rate'")
    const vatRate = parseFloat(vatRow[0]?.value || '19')
    const vatAmount = netTotal * (vatRate / 100)
    const grossTotal = netTotal + vatAmount

    const { rows: prefRow } = await client.query("SELECT value FROM settings WHERE key='invoice_prefix'")
    const prefix = prefRow[0]?.value || 'RE'
    const invNumber = await nextNumber('last_invoice_number', prefix)

    // Due date: 14 days from now
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14)
    const perfDate = new Date().toISOString().slice(0, 10)

    const { rows: inv } = await client.query(
      `INSERT INTO invoices
         (invoice_number,order_id,quote_id,customer_id,owner_id,customer,meta,rows,
          vat_rate,net_total,vat_amount,gross_total,status,due_date,performance_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open',$13,$14)
       RETURNING id,invoice_number`,
      [invNumber, order.id, order.quote_id, order.customer_id, req.user.id,
       order.customer, order.meta, order.rows,
       vatRate, netTotal.toFixed(2), vatAmount.toFixed(2), grossTotal.toFixed(2),
       dueDate.toISOString().slice(0,10), perfDate])

    await client.query("UPDATE orders SET status='completed',updated_at=NOW() WHERE id=$1", [order.id])
    await client.query('COMMIT')
    res.json({ ok: true, invoice_id: inv[0].id, invoice_number: inv[0].invoice_number })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally { client.release() }
})

// ── Invoices ──────────────────────────────────────────────────────────────────
app.get('/api/invoices', auth.verify, async (req, res) => {
  try {
    const base = `
      SELECT i.*, u.name AS owner_name, c.name AS customer_name
      FROM invoices i
      JOIN users u ON i.owner_id=u.id
      LEFT JOIN customers c ON i.customer_id=c.id`
    const q = req.user.role === 'geschaeftsfuehrung'
      ? await pool.query(base + ' ORDER BY i.created_at DESC')
      : await pool.query(base + ' WHERE i.owner_id=$1 ORDER BY i.created_at DESC', [req.user.id])
    res.json(q.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/invoices/:id', auth.verify, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.name AS owner_name, c.* AS customer_data
       FROM invoices i
       JOIN users u ON i.owner_id=u.id
       LEFT JOIN customers c ON i.customer_id=c.id
       WHERE i.id=$1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/invoices/:id/status', auth.verify, async (req, res) => {
  try {
    const { status } = req.body
    const paidAt = status === 'paid' ? new Date().toISOString() : null
    await pool.query(
      'UPDATE invoices SET status=$1,paid_at=$2,updated_at=NOW() WHERE id=$3',
      [status, paidAt, req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Frontend (MUST BE LAST) ───────────────────────────────────────────────────
const DIST = path.join(__dirname, '../dist')
app.use(express.static(DIST))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.join(DIST, 'index.html'))
})

// ── Start ─────────────────────────────────────────────────────────────────────
init()
  .then(() => migrate())
  .then(() => migrateSettings())
  .then(() => app.listen(PORT, () => console.log(`✓ InvoiceFlow läuft auf Port ${PORT}`)))
  .catch(err => { console.error('Startup-Fehler:', err.message); process.exit(1) })
