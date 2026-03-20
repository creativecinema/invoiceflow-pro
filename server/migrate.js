const { pool } = require('./db')

const migrate = async () => {
  await pool.query(`
    -- customer_id in quotes
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='quotes' AND column_name='customer_id'
      ) THEN
        ALTER TABLE quotes ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
      END IF;
    END $$;

    -- Articles
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

    -- Contacts
    CREATE TABLE IF NOT EXISTS contacts (
      id                    SERIAL PRIMARY KEY,
      contact_type          TEXT    NOT NULL DEFAULT 'person'
                                    CHECK(contact_type IN ('person','company')),
      relationship          TEXT[]  NOT NULL DEFAULT '{}',
      salutation            TEXT,
      first_name            TEXT,
      last_name             TEXT,
      company               TEXT,
      email                 TEXT,
      phone                 TEXT,
      street                TEXT,
      zip                   TEXT,
      city                  TEXT,
      state                 TEXT,
      country               TEXT    NOT NULL DEFAULT 'Deutschland',
      notes                 TEXT,
      converted_to_customer INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      created_by            INTEGER REFERENCES users(id),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id           SERIAL PRIMARY KEY,
      contact_type TEXT    NOT NULL DEFAULT 'company'
                           CHECK(contact_type IN ('person','company')),
      company      TEXT,
      salutation   TEXT,
      first_name   TEXT,
      last_name    TEXT,
      email        TEXT,
      phone        TEXT,
      website      TEXT,
      street       TEXT,
      zip          TEXT,
      city         TEXT,
      state        TEXT,
      country      TEXT    NOT NULL DEFAULT 'Deutschland',
      category     TEXT,
      notes        TEXT,
      active       BOOLEAN NOT NULL DEFAULT true,
      created_by   INTEGER REFERENCES users(id),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  // Seed articles if empty
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM articles')
  if (Number(rows[0].n) === 0) {
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
      ('TECH-003','Audio Set','Sounddevice 552, Tonangel, Richtmikrofon','Tag',165.00,'Technik',1),
      ('TECH-004','Workstation','Professionelle Abhöranlage + farbverbindliches Display','Tag',200.00,'Technik',1),
      ('TECH-005','Workstation 3D','3D Workstation inkl. Cinema4D','Tag',275.00,'Technik',1),
      ('LIZ-001','Stockfootage Paket','Artgrid und Envato Elements','Pauschal',800.00,'Lizenzen',1)
    `)
    console.log('✓ Artikel-Seed angelegt')
  }

  console.log('✓ Migration abgeschlossen — alle Tabellen vorhanden')
}

module.exports = { migrate }

// Settings migration (called separately)
const migrateSettings = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Default settings
    INSERT INTO settings (key, value) VALUES
      ('company_name',      'CreativeCinema GmbH'),
      ('company_street',    'Gundstraße 13a'),
      ('company_city',      '91056 Erlangen'),
      ('company_phone',     '01748484842'),
      ('company_email',     'as@creative-cinema.net'),
      ('company_ustid',     'DE312916038'),
      ('company_hrb',       'Handelsregister Fürth HRB 16243'),
      ('company_manager',   'Andreas Schulz'),
      ('bank_name',         'Kreissparkasse Erlangen/Höchstadt'),
      ('bank_iban',         'DE18 7635 0000 0060 1164 91'),
      ('bank_bic',          'BYLADEM1ERH'),
      ('bank_name_2',       'Kreissparkasse Köln'),
      ('bank_iban_2',       'DE 87 3705 0299 0133 3002 24'),
      ('bank_bic_2',        'COKSDE33XXX'),
      ('payment_terms',     'Zahlbar sofort nach Rechnungseingang ohne Abzug.'),
      ('payment_methods',   'Banküberweisung'),
      ('deposit_percent',   '20'),
      ('deposit_days',      '7'),
      ('vat_rate',          '19'),
      ('quote_greeting',    'Sehr geehrte Damen und Herren,\nVielen Dank für Ihre Anfrage, anbei erhalten Sie Ihr Angebot.\nIch freue mich auf Ihr Feedback.\nMit freundlichen Grüßen'),
      ('quote_disclaimer',  'Bei dem Angebot handelt sich um eine Aufwandsschätzung auf der Basis der aktuellen Angaben. Je nach Aufwand können weitere Kosten entstehen.'),
      ('logo_data',         '')
    ON CONFLICT (key) DO NOTHING;
  `)
  console.log('✓ Settings-Tabelle bereit')

  // Orders
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              SERIAL PRIMARY KEY,
      order_number    TEXT        NOT NULL UNIQUE,
      quote_id        INTEGER     REFERENCES quotes(id) ON DELETE SET NULL,
      customer_id     INTEGER     REFERENCES customers(id) ON DELETE SET NULL,
      owner_id        INTEGER     NOT NULL REFERENCES users(id),
      customer        JSONB       NOT NULL DEFAULT '{}',
      meta            JSONB       NOT NULL DEFAULT '{}',
      rows            JSONB       NOT NULL DEFAULT '[]',
      status          TEXT        NOT NULL DEFAULT 'open'
                                  CHECK(status IN ('open','in_progress','completed','cancelled')),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id              SERIAL PRIMARY KEY,
      invoice_number  TEXT        NOT NULL UNIQUE,
      order_id        INTEGER     REFERENCES orders(id) ON DELETE SET NULL,
      quote_id        INTEGER     REFERENCES quotes(id) ON DELETE SET NULL,
      customer_id     INTEGER     REFERENCES customers(id) ON DELETE SET NULL,
      owner_id        INTEGER     NOT NULL REFERENCES users(id),
      customer        JSONB       NOT NULL DEFAULT '{}',
      meta            JSONB       NOT NULL DEFAULT '{}',
      rows            JSONB       NOT NULL DEFAULT '[]',
      vat_rate        NUMERIC(5,2) NOT NULL DEFAULT 19,
      net_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
      vat_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
      gross_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
      status          TEXT        NOT NULL DEFAULT 'open'
                                  CHECK(status IN ('open','paid','cancelled','overdue')),
      due_date        DATE,
      paid_at         TIMESTAMPTZ,
      performance_date DATE,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add order_number sequence tracking to settings
    INSERT INTO settings (key, value) VALUES ('last_order_number', '0')
      ON CONFLICT (key) DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('last_invoice_number', '0')
      ON CONFLICT (key) DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('order_prefix', 'AU')
      ON CONFLICT (key) DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('invoice_prefix', 'RE')
      ON CONFLICT (key) DO NOTHING;
  `)
  console.log('✓ Orders & Invoices Tabellen bereit')
}

module.exports = { migrate, migrateSettings }
