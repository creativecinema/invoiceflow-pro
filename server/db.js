const { Pool } = require('pg')
const bcrypt    = require('bcryptjs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://invoiceflow:invoiceflow@localhost:5432/invoiceflow',
})

const init = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL,
      email      TEXT        NOT NULL UNIQUE,
      password   TEXT        NOT NULL,
      role       TEXT        NOT NULL CHECK(role IN ('mitarbeiter','producer','geschaeftsfuehrung')),
      active     BOOLEAN     NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id              SERIAL PRIMARY KEY,
      name            TEXT        NOT NULL,
      short_name      TEXT,
      customer_number TEXT        UNIQUE,
      payment_days    INTEGER     NOT NULL DEFAULT 30,
      payment_note    TEXT,
      website         TEXT,
      industry        TEXT,
      notes           TEXT,
      created_by      INTEGER     REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id          SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL DEFAULT 'main'
                          CHECK(type IN ('main','billing','delivery','other')),
      label       TEXT,
      street      TEXT,
      city        TEXT,
      zip         TEXT,
      country     TEXT    NOT NULL DEFAULT 'Deutschland',
      is_default  BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS customer_contacts (
      id          SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      salutation  TEXT,
      first_name  TEXT,
      last_name   TEXT    NOT NULL DEFAULT '',
      position    TEXT,
      email       TEXT,
      phone       TEXT,
      mobile      TEXT,
      is_primary  BOOLEAN NOT NULL DEFAULT false,
      notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS articles (
      id          SERIAL PRIMARY KEY,
      number      TEXT,
      name        TEXT    NOT NULL,
      description TEXT,
      unit        TEXT    NOT NULL DEFAULT 'Std.',
      price       NUMERIC(12,2) NOT NULL DEFAULT 0,
      category    TEXT,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customer_article_prices (
      id          SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      price       NUMERIC(12,2) NOT NULL,
      note        TEXT,
      UNIQUE(customer_id, article_id)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id          SERIAL PRIMARY KEY,
      number      TEXT        NOT NULL,
      owner_id    INTEGER     NOT NULL REFERENCES users(id),
      customer_id INTEGER     REFERENCES customers(id) ON DELETE SET NULL,
      customer    JSONB       NOT NULL DEFAULT '{}',
      meta        JSONB       NOT NULL DEFAULT '{}',
      rows        JSONB       NOT NULL DEFAULT '[]',
      status      TEXT        NOT NULL DEFAULT 'draft'
                              CHECK(status IN ('draft','sent','accepted','rejected')),
      approved_by INTEGER     REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM users')
  if (Number(rows[0].n) === 0) {
    const hash = (pw) => bcrypt.hashSync(pw, 10)
    await pool.query(
      'INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12)',
      [
        'Andreas Schulz','admin@creativecinema.net',       hash('admin123'),       'geschaeftsfuehrung',
        'Max Mustermann','producer@creativecinema.net',    hash('producer123'),    'producer',
        'Lisa Beispiel', 'mitarbeiter@creativecinema.net', hash('mitarbeiter123'), 'mitarbeiter',
      ]
    )
    const cust = await pool.query(
      `INSERT INTO customers (name,short_name,customer_number,payment_days,industry,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['AOK Medien GmbH','AOK','C1215',30,'Gesundheitswesen',1]
    )
    const cid = cust.rows[0].id
    await pool.query(
      `INSERT INTO customer_addresses (customer_id,type,street,zip,city,is_default) VALUES ($1,'main',$2,$3,$4,true)`,
      [cid,'Lilienthalstr. 1-3','53424','Remagen']
    )
    await pool.query(
      `INSERT INTO customer_contacts (customer_id,salutation,first_name,last_name,position,email,is_primary) VALUES ($1,'Herr','Thomas','Müller','Projektleiter','t.mueller@aok.de',true)`,
      [cid]
    )
    // Seed articles
    await pool.query(`
      INSERT INTO articles (number,name,description,unit,price,category,created_by) VALUES
      ('RED-001','Redakteur','Redaktionelle und konzeptionelle Entwicklung','Std.',98.50,'Personal',1),
      ('PRO-001','Senior Producer','Projektleitung, Abstimmungen intern/extern','Std.',98.50,'Personal',1),
      ('CAM-001','Kameramann','8 Stunden am Set','Tag',590.00,'Personal',1),
      ('CAM-002','Kameraassistent','Unterstützung des Kameramannes','Tag',425.00,'Personal',1),
      ('CUT-001','Cutter','Videoschnitt und Postproduktion','Std.',95.00,'Personal',1),
      ('3D-001','Senior 3D Artist','3D-Animationen und Motion-Elemente','Std.',97.50,'Personal',1),
      ('TECH-001','Kameratechnik Sony FX9','Sony FX9 inkl. Metabones, Optiken, Stativ','Tag',300.00,'Technik',1),
      ('TECH-002','Lichttechnik Großes Paket','Kinoflows inkl. Speisung und C-Stands','Tag',375.00,'Technik',1),
      ('TECH-003','Audio Set','Sounddevice 552, Tonangel, Richtmikrofon, Sennheiser G3','Tag',165.00,'Technik',1),
      ('TECH-004','Workstation','Professionelle Abhöranlage + farbverbindliches Display','Tag',200.00,'Technik',1),
      ('TECH-005','Workstation 3D','3D Workstation inkl. Cinema4D','Tag',275.00,'Technik',1),
      ('LIZ-001','Stockfootage Paket','Artgrid und Envato Elements','Pauschal',800.00,'Lizenzen',1)
    `)
    console.log('✓ Seed-Daten angelegt')
  }
  console.log('✓ Datenbank bereit')
}

module.exports = { pool, init }
