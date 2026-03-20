import Login from "./components/Login.jsx"
import Customers from "./components/Customers.jsx"
import Articles from "./components/Articles.jsx"
import Contacts from "./components/Contacts.jsx"
import Suppliers from "./components/Suppliers.jsx"
import Settings from "./components/Settings.jsx"
import OpenQuotes from "./components/OpenQuotes.jsx"
import Orders from "./components/Orders.jsx"
import Invoices from "./components/Invoices.jsx"
import CustomerStats from "./components/CustomerStats.jsx"
import UserAdmin from "./components/UserAdmin.jsx"
import { useAuth, ROLE_LABELS, ROLE_COLORS } from "./contexts/AuthContext.jsx"
import { useState, useEffect } from 'react'
import './app.css'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9)
const fmt = (n) =>
  Number(n || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const ROW_TYPES = {
  CATEGORY: 'category',
  ITEM: 'item',
  OPTIONAL: 'optional',
  TEXT: 'text',
  DIVIDER: 'divider',
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Data
// ─────────────────────────────────────────────────────────────────────────────
const defaultCompany = {
  name: 'CreativeCinema GmbH',
  street: 'Gundstraße 13a',
  city: '91056 Erlangen',
  phone: '01748484842',
  email: 'as@creative-cinema.net',
  web: '',
  iban: 'DE18 7635 0000 0060 1164 91',
  bic: 'BYLADEM1ERH',
  bank: 'Kreissparkasse Erlangen/Höchstadt',
  hrb: 'Handelsregister Fürth HRB 16243',
  ustid: 'DE312916038',
  manager: 'Andreas Schulz',
}

const defaultMeta = {
  number: '2444',
  date: new Date().toLocaleDateString('de-DE'),
  validUntil: '',
  commission: 'AS',
  customerRef: '',
  handler: 'Andreas Schulz',
  requestDate: new Date().toLocaleDateString('de-DE'),
  vat: 19,
  depositPercent: 20,
  depositDays: 7,
  greeting:
    'Sehr geehrte Damen und Herren,\nVielen Dank für Ihre Anfrage, anbei erhalten Sie Ihr Angebot.\nIch freue mich auf Ihr Feedback.\nMit freundlichen Grüßen',
  disclaimer:
    'Bei dem Angebot handelt sich um eine Aufwandsschätzung auf der Basis der aktuellen Angaben. Je nach Aufwand können weitere Kosten entstehen.',
}

const defaultCustomer = {
  company: 'AOK Medien GmbH',
  street: 'Lilienthalstr. 1-3',
  city: '53424 Remagen',
  custNo: 'C1215',
}

const defaultRows = [
  {
    id: uid(),
    type: ROW_TYPES.CATEGORY,
    description: 'Konzeption und Entwicklung',
    note: 'Produktion eines ca. 5-minütigen, weboptimierten Videos.',
    qty: '',
    price: '',
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Redakteur',
    note: 'Redaktionelle und konzeptionelle Entwicklung des Videoinhalts.',
    qty: 24,
    price: 98.5,
  },
  {
    id: uid(),
    type: ROW_TYPES.CATEGORY,
    description: 'Produktion',
    note: '',
    qty: '',
    price: '',
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Senior Producer',
    note: 'Notwendige Abstimmungen, Begleitung der Drehtage.',
    qty: 22,
    price: 98.5,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Tagessatz Redaktion',
    note: '8 Stunden pro Arbeitstag.',
    qty: 2,
    price: 840,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Kameramann',
    note: '8 Stunden am Set, Overtime doppelter Stundensatz.',
    qty: 2,
    price: 590,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Tagessatz Kameraassistent',
    note: 'Unterstützung des Kameramannes.',
    qty: 2,
    price: 425,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Kameratechnik',
    note: 'Sony FX9 inkl. Metabones, Optiken, Stativset, Speichermedien.',
    qty: 4,
    price: 300,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Lichttechnik Großes Paket',
    note: 'Kinoflows oder Ähnliches, inkl. Speisung, C-Stands.',
    qty: 2,
    price: 375,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Audio Set',
    note: 'Sounddevice 552, Tonangel, Richtmikrofon, Sennheiser G3Set.',
    qty: 2,
    price: 165,
  },
  {
    id: uid(),
    type: ROW_TYPES.CATEGORY,
    description: 'Postproduktion',
    note: '',
    qty: '',
    price: '',
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Redakteur',
    note: 'Redaktionelle Begleitung der Postproduktion.',
    qty: 12,
    price: 98.5,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Cutter',
    note: 'Videoschnitt, Einbau von Screencasts, Grafiken und Texteinblendungen.',
    qty: 48,
    price: 95,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Workstation',
    note: 'Inkl. professioneller Abhöranlage und farbverbindlichem Display.',
    qty: 6,
    price: 200,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Senior 3D Artist',
    note: '3D-Animationen und Motion-Elemente.',
    qty: 24,
    price: 97.5,
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Workstation 3D',
    note: '3D Workstation inkl. Cinema4D.',
    qty: 3,
    price: 275,
  },
  {
    id: uid(),
    type: ROW_TYPES.OPTIONAL,
    description: 'Cutter (Social Media)',
    note: 'Social-Media-Content-Formate auf Basis des Hauptmaterials.',
    qty: 16,
    price: 95,
  },
  {
    id: uid(),
    type: ROW_TYPES.OPTIONAL,
    description: 'Workstation (Opt.)',
    note: 'Workstation für den Filmbereich.',
    qty: 2,
    price: 200,
  },
  {
    id: uid(),
    type: ROW_TYPES.CATEGORY,
    description: 'Material & Lizenzen',
    note: '',
    qty: '',
    price: '',
  },
  {
    id: uid(),
    type: ROW_TYPES.ITEM,
    description: 'Nutzung externes Footage',
    note: 'Artgrid und Envato Elements.',
    qty: 1,
    price: 800,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
const icons = {
  file: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41" />
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  ),
  grip: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="5" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="15" cy="5" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
  ),
  print: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  save: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  building: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 22V12h6v10M3 9h18" />
    </svg>
  ),
  list: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
}

const Icon = ({ name }) => icons[name] || null

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, logout, isManagement } = useAuth()

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'var(--font-mono)',fontSize:13,color:'var(--ink3)'}}>
      Wird geladen…
    </div>
  )
  if (!user) return <Login />

  return <AppInner />
}

function AppInner() {
  const { user, logout, isManagement } = useAuth()
  const [view, setView] = useState('positions')
  const [showSettings, setShowSettings] = useState(false)
  const [company, setCompany] = useState(defaultCompany)
  const [customer, setCustomer] = useState(defaultCustomer)
  const [meta, setMeta] = useState(defaultMeta)
  const [rows, setRows] = useState(defaultRows)
  const [toast, setToast] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Load saved data on mount
  useEffect(() => {
    try {
      const d = localStorage.getItem('angebot_data')
      if (d) {
        const p = JSON.parse(d)
        if (p.company) setCompany(p.company)
        if (p.customer) setCustomer(p.customer)
        if (p.meta) setMeta(p.meta)
        if (p.rows) setRows(p.rows)
      }
    } catch {
      // silently ignore
    }
  }, [])

  // Calculations
  const netTotal = rows.reduce((s, r) => {
    if (r.type === ROW_TYPES.ITEM && r.qty && r.price)
      return s + Number(r.qty) * Number(r.price)
    return s
  }, 0)
  const optTotal = rows.reduce((s, r) => {
    if (r.type === ROW_TYPES.OPTIONAL && r.qty && r.price)
      return s + Number(r.qty) * Number(r.price)
    return s
  }, 0)
  const vatAmt = netTotal * (Number(meta.vat) / 100)
  const gross = netTotal + vatAmt

  // Row operations
  const updateRow = (id, key, val) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)))
  const deleteRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id))
  const addRow = (type) =>
    setRows((rs) => [
      ...rs,
      {
        id: uid(),
        type,
        description: '',
        note: '',
        qty:
          type === ROW_TYPES.ITEM || type === ROW_TYPES.OPTIONAL ? 1 : '',
        price:
          type === ROW_TYPES.ITEM || type === ROW_TYPES.OPTIONAL ? 0 : '',
      },
    ])
  const duplicateRow = (row) =>
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.id === row.id)
      const copy = { ...row, id: uid() }
      const next = [...rs]
      next.splice(idx + 1, 0, copy)
      return next
    })
  const moveRow = (fromIdx, toIdx) =>
    setRows((rs) => {
      const next = [...rs]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })

  const save = () => {
    try {
      localStorage.setItem(
        'angebot_data',
        JSON.stringify({ company, customer, meta, rows })
      )
      showToast('✓ Gespeichert')
    } catch {
      showToast('Fehler beim Speichern')
    }
  }

  // Export as JSON
  const exportJSON = () => {
    const data = JSON.stringify({ company, customer, meta, rows }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `angebot-${meta.number}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('✓ JSON exportiert')
  }

  // Import from JSON
  const importJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const p = JSON.parse(ev.target.result)
          if (p.company) setCompany(p.company)
          if (p.customer) setCustomer(p.customer)
          if (p.meta) setMeta(p.meta)
          if (p.rows) setRows(p.rows)
          showToast('✓ Importiert')
        } catch {
          showToast('Fehler beim Importieren')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const newQuote = () => {
    if (!confirm('Neues Angebot erstellen? Ungespeicherte Änderungen gehen verloren.')) return
    setCustomer(defaultCustomer)
    setMeta({
      ...defaultMeta,
      number: String(Number(meta.number || 2444) + 1),
      date: new Date().toLocaleDateString('de-DE'),
    })
    setRows([
      {
        id: uid(),
        type: ROW_TYPES.CATEGORY,
        description: 'Neue Position',
        note: '',
        qty: '',
        price: '',
      },
    ])
    showToast('Neues Angebot erstellt')
  }

  const navItems = [
    { id: 'positions', label: 'Positionen', icon: 'list' },
    { id: 'meta', label: 'Kopfdaten', icon: 'file' },
    { id: 'company', label: 'Absender', icon: 'building' },
    { id: 'customer', label: 'Empfänger', icon: 'user' },
    { id: 'customers', label: 'Kunden', icon: 'user' },
    { id: 'articles', label: 'Artikel', icon: 'list' },
    { id: 'preview', label: 'Vorschau / Druck', icon: 'eye' },
  ]
  const mgmtNavItems = [
    { id: 'users', label: 'Nutzerverwaltung', icon: 'settings' },
    { id: 'stats', label: 'Auswertung', icon: 'download' },
  ]

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>
            Angebot<span>.</span>
          </h1>
          <p>Angebotsverwaltung</p>
        </div>

        <nav className="sidebar-nav">
          {/* Verkauf */}
          <div className="nav-section">
            <div className="nav-label">Verkauf</div>
            {[
              { id:'open-quotes', label:'Offene Angebote', icon:'list' },
              { id:'positions',   label:'Angebot',         icon:'file' },
              { id:'orders',      label:'Aufträge',        icon:'copy' },
              { id:'invoices',    label:'Rechnungen',      icon:'download' },
            ].map(n=>(
              <button key={n.id} className={`nav-btn ${view===n.id?'active':''}`} onClick={()=>setView(n.id)}>
                <Icon name={n.icon}/>{n.label}
              </button>
            ))}
            <button className="nav-btn" onClick={save}><Icon name="save"/> Speichern</button>
            <button className="nav-btn" onClick={newQuote}><Icon name="plus"/> Neues Angebot</button>
            <button className="nav-btn" onClick={()=>{setView('preview');setTimeout(()=>window.print(),400)}}><Icon name="print"/> Drucken</button>
          </div>

          {/* CRM */}
          <div className="nav-section">
            <div className="nav-label">CRM</div>
            {[
              { id:'contacts',  label:'Kontakte',    icon:'user' },
              { id:'customers', label:'Kunden',      icon:'building' },
              { id:'suppliers', label:'Lieferanten', icon:'copy' },
            ].map(n=>(
              <button key={n.id} className={`nav-btn ${view===n.id?'active':''}`} onClick={()=>setView(n.id)}>
                <Icon name={n.icon}/>{n.label}
              </button>
            ))}
          </div>

          {/* Stammdaten */}
          <div className="nav-section">
            <div className="nav-label">Stammdaten</div>
            <button className={`nav-btn ${view==='articles'?'active':''}`} onClick={()=>setView('articles')}>
              <Icon name="list"/>Artikel
            </button>
          </div>

          {/* Verwaltung */}
          {isManagement && (
            <div className="nav-section">
              <div className="nav-label">Verwaltung</div>
              <button className={`nav-btn ${view==='users'?'active':''}`} onClick={()=>setView('users')}>
                <Icon name="settings"/>Nutzer
              </button>
              <button className={`nav-btn ${view==='stats'?'active':''}`} onClick={()=>setView('stats')}>
                <Icon name="download"/>Auswertung
              </button>
            </div>
          )}
        </nav>

        {/* User info */}
        <div className="user-info-box">
          <div className="user-info-name">{user.name}</div>
          <div className="user-info-role">{ROLE_LABELS[user.role]}</div>
          <button className="btn btn-ghost btn-sm user-logout" onClick={logout}>Ausloggen</button>
        </div>

        <div className="sidebar-summary">
          <h3>Zusammenfassung</h3>
          <div className="summary-row">
            <span className="s-label">Netto</span>
            <span className="s-value">{fmt(netTotal)} €</span>
          </div>
          {optTotal > 0 && (
            <div className="summary-row">
              <span className="s-label">Optional</span>
              <span className="s-value">{fmt(optTotal)} €</span>
            </div>
          )}
          <div className="summary-row">
            <span className="s-label">MwSt. {meta.vat}%</span>
            <span className="s-value">{fmt(vatAmt)} €</span>
          </div>
          <div className="summary-row total">
            <span className="s-label">Gesamt</span>
            <span className="s-value">{fmt(gross)} €</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <div className="topbar">
          <h2>
            {view === 'users' ? 'Nutzerverwaltung' : view === 'stats' ? 'Auswertung' : view === 'open-quotes' ? 'Offene Angebote' : view === 'orders' ? 'Aufträge' : view === 'invoices' ? 'Rechnungen' : view === 'contacts' ? 'Kontakte' : view === 'customers' ? 'Kunden' : view === 'suppliers' ? 'Lieferanten' : view === 'articles' ? 'Artikel' : navItems.find((n) => n.id === view)?.label}
          </h2>
          <span className="topbar-sub">
            Angebot Nr. {meta.number} · {meta.date}
          </span>
          {view !== 'preview' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setView('preview')}>
              <Icon name="eye" /> Vorschau
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={save}>
            <Icon name="save" /> Speichern
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowSettings(true)}
            title="Einstellungen"
            style={{ marginLeft:4 }}
          >
            <Icon name="settings" size={16} />
          </button>
        </div>

        <div className="content">
          {view === 'positions' && (
            <PositionsView
              rows={rows}
              updateRow={updateRow}
              deleteRow={deleteRow}
              addRow={addRow}
              duplicateRow={duplicateRow}
              moveRow={moveRow}
              netTotal={netTotal}
              optTotal={optTotal}
              vatAmt={vatAmt}
              gross={gross}
              meta={meta}
              dragIdx={dragIdx}
              setDragIdx={setDragIdx}
              dragOver={dragOver}
              setDragOver={setDragOver}
            />
          )}
          {view === 'meta' && <MetaView meta={meta} setMeta={setMeta} />}
          {view === 'company' && (
            <CompanyView company={company} setCompany={setCompany} />
          )}
          {view === 'customer' && (
            <CustomerView customer={customer} setCustomer={setCustomer} />
          )}
          {view === 'users' && isManagement && <UserAdmin />}
          {view === 'open-quotes' && <OpenQuotes onEditQuote={(id)=>{ if(id) {}; setView('positions') }} />}
          {view === 'orders'    && <Orders />}
          {view === 'invoices'  && <Invoices />}
          {view === 'contacts'  && <Contacts />}
          {view === 'customers' && <Customers />}
          {view === 'suppliers' && <Suppliers />}
          {view === 'articles' && <Articles />}
          {view === 'stats' && isManagement && <CustomerStats />}
          {view === 'preview' && (
            <PreviewView
              company={company}
              customer={customer}
              meta={meta}
              rows={rows}
              netTotal={netTotal}
              vatAmt={vatAmt}
              gross={gross}
            />
          )}
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Positions View
// ─────────────────────────────────────────────────────────────────────────────
function PositionsView({
  rows, updateRow, deleteRow, addRow, duplicateRow, moveRow,
  netTotal, optTotal, vatAmt, gross, meta,
  dragIdx, setDragIdx, dragOver, setDragOver,
}) {
  let posCounter = 0

  return (
    <div>
      <div className="section">
        <div className="row-table">
          <div className="row-table-header">
            <div />
            <div>Typ</div>
            <div>Bezeichnung &amp; Beschreibung</div>
            <div className="text-right">Menge</div>
            <div className="text-right">Preis/Einh</div>
            <div className="text-right">Gesamt</div>
            <div />
          </div>

          {rows.map((row, idx) => {
            if (row.type === ROW_TYPES.ITEM || row.type === ROW_TYPES.OPTIONAL)
              posCounter++
            const pos =
              row.type === ROW_TYPES.ITEM || row.type === ROW_TYPES.OPTIONAL
                ? posCounter
                : ''
            const rowTotal =
              (row.type === ROW_TYPES.ITEM || row.type === ROW_TYPES.OPTIONAL) &&
              row.qty &&
              row.price
                ? Number(row.qty) * Number(row.price)
                : null
            const isOver = dragOver === idx && dragIdx !== idx

            return (
              <div
                key={row.id}
                className={[
                  'row-item',
                  row.type === ROW_TYPES.CATEGORY ? 'is-category' : '',
                  row.type === ROW_TYPES.OPTIONAL ? 'is-optional' : '',
                  dragIdx === idx ? 'is-dragging' : '',
                  isOver ? 'is-dragover' : '',
                ].join(' ')}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(idx)
                }}
                onDrop={() => {
                  if (dragIdx !== null && dragIdx !== idx) moveRow(dragIdx, idx)
                  setDragIdx(null)
                  setDragOver(null)
                }}
                onDragEnd={() => {
                  setDragIdx(null)
                  setDragOver(null)
                }}
              >
                <div className="drag-handle">
                  <Icon name="grip" />
                </div>

                <div>
                  <span className={`type-badge ${row.type}`}>
                    {row.type === ROW_TYPES.CATEGORY
                      ? 'Titel'
                      : row.type === ROW_TYPES.ITEM
                      ? 'Position'
                      : row.type === ROW_TYPES.OPTIONAL
                      ? 'Optional'
                      : row.type === ROW_TYPES.TEXT
                      ? 'Text'
                      : 'Trenner'}
                  </span>
                  {pos ? <div className="pos-num">#{pos}</div> : null}
                </div>

                <div className="row-desc">
                  <input
                    className="desc-title"
                    value={row.description}
                    onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                    placeholder="Bezeichnung..."
                  />
                  {row.type !== ROW_TYPES.DIVIDER && (
                    <textarea
                      value={row.note}
                      onChange={(e) => updateRow(row.id, 'note', e.target.value)}
                      placeholder="Beschreibung (optional)..."
                      rows={2}
                    />
                  )}
                </div>

                <div>
                  {(row.type === ROW_TYPES.ITEM ||
                    row.type === ROW_TYPES.OPTIONAL) && (
                    <input
                      className="num-input"
                      type="number"
                      value={row.qty}
                      onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                      placeholder="0"
                    />
                  )}
                </div>

                <div>
                  {(row.type === ROW_TYPES.ITEM ||
                    row.type === ROW_TYPES.OPTIONAL) && (
                    <input
                      className="num-input"
                      type="number"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateRow(row.id, 'price', e.target.value)}
                      placeholder="0,00"
                    />
                  )}
                </div>

                <div className={`row-total ${rowTotal ? '' : 'zero'}`}>
                  {rowTotal !== null ? `${fmt(rowTotal)} €` : '—'}
                </div>

                <div className="row-actions">
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => duplicateRow(row)}
                    title="Duplizieren"
                  >
                    <Icon name="copy" />
                  </button>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => deleteRow(row.id)}
                    title="Löschen"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="add-row-bar">
          <span className="add-label">Hinzufügen:</span>
          <button className="btn btn-secondary btn-sm" onClick={() => addRow(ROW_TYPES.CATEGORY)}>
            <Icon name="plus" /> Titel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => addRow(ROW_TYPES.ITEM)}>
            <Icon name="plus" /> Position
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => addRow(ROW_TYPES.OPTIONAL)}>
            <Icon name="plus" /> Optional
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => addRow(ROW_TYPES.TEXT)}>
            <Icon name="plus" /> Textblock
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="totals-wrap">
        <div className="totals-box">
          <div className="totals-row">
            <span className="tl">Positionen netto</span>
            <span className="tv">{fmt(netTotal)} €</span>
          </div>
          {optTotal > 0 && (
            <div className="totals-row">
              <span className="tl">davon Optional</span>
              <span className="tv">{fmt(optTotal)} €</span>
            </div>
          )}
          <div className="totals-row vat-row">
            <span className="tl">MwSt. {meta.vat}%</span>
            <span className="tv">{fmt(vatAmt)} €</span>
          </div>
          <div className="totals-row grand">
            <span className="tl">Endsumme</span>
            <span className="tv">{fmt(gross)} €</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta View
// ─────────────────────────────────────────────────────────────────────────────
function MetaView({ meta, setMeta }) {
  const u = (k, v) => setMeta((m) => ({ ...m, [k]: v }))
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Kopfdaten &amp; Konditionen</span>
      </div>
      <div className="section-body">
        <div className="grid-4">
          <div className="field">
            <label>Angebotsnummer</label>
            <input value={meta.number} onChange={(e) => u('number', e.target.value)} />
          </div>
          <div className="field">
            <label>Datum</label>
            <input value={meta.date} onChange={(e) => u('date', e.target.value)} />
          </div>
          <div className="field">
            <label>Gültig bis</label>
            <input value={meta.validUntil} onChange={(e) => u('validUntil', e.target.value)} />
          </div>
          <div className="field">
            <label>Kommission</label>
            <input value={meta.commission} onChange={(e) => u('commission', e.target.value)} />
          </div>
          <div className="field">
            <label>Kunden-Nr.</label>
            <input value={meta.customerRef} onChange={(e) => u('customerRef', e.target.value)} />
          </div>
          <div className="field">
            <label>Bearbeiter</label>
            <input value={meta.handler} onChange={(e) => u('handler', e.target.value)} />
          </div>
          <div className="field">
            <label>Anfragedatum</label>
            <input value={meta.requestDate} onChange={(e) => u('requestDate', e.target.value)} />
          </div>
          <div className="field">
            <label>MwSt. (%)</label>
            <input type="number" value={meta.vat} onChange={(e) => u('vat', e.target.value)} />
          </div>
          <div className="field">
            <label>Anzahlung (%)</label>
            <input
              type="number"
              value={meta.depositPercent}
              onChange={(e) => u('depositPercent', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Zahlungsfrist (Tage)</label>
            <input
              type="number"
              value={meta.depositDays}
              onChange={(e) => u('depositDays', e.target.value)}
            />
          </div>
        </div>
        <div className="field mt-16">
          <label>Anschreiben</label>
          <textarea
            rows={5}
            value={greeting}
            onChange={(e) => u('greeting', e.target.value)}
          />
        </div>
        <div className="field mt-12">
          <label>Hinweis / Disclaimer</label>
          <textarea
            rows={3}
            value={meta.disclaimer}
            onChange={(e) => u('disclaimer', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Company View
// ─────────────────────────────────────────────────────────────────────────────
function CompanyView({ company, setCompany }) {
  const u = (k, v) => setCompany((c) => ({ ...c, [k]: v }))
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Absenderadresse &amp; Bankdaten</span>
      </div>
      <div className="section-body">
        <div className="grid-2">
          {[
            ['name', 'Firmenname'],
            ['street', 'Straße'],
            ['city', 'PLZ / Ort'],
            ['phone', 'Telefon'],
            ['email', 'E-Mail'],
            ['web', 'Website'],
            ['manager', 'Geschäftsführer'],
            ['hrb', 'Handelsregister'],
            ['ustid', 'UStID'],
          ].map(([k, label]) => (
            <div key={k} className="field">
              <label>{label}</label>
              <input value={company[k]} onChange={(e) => u(k, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="subsection-label">Bankverbindung</div>
        <div className="grid-3">
          {[
            ['bank', 'Bank'],
            ['iban', 'IBAN'],
            ['bic', 'BIC'],
          ].map(([k, label]) => (
            <div key={k} className="field">
              <label>{label}</label>
              <input value={company[k]} onChange={(e) => u(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer View
// ─────────────────────────────────────────────────────────────────────────────
function CustomerView({ customer, setCustomer }) {
  const u = (k, v) => setCustomer((c) => ({ ...c, [k]: v }))
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Empfänger</span>
      </div>
      <div className="section-body">
        <div className="grid-2">
          {[
            ['company', 'Firma'],
            ['custNo', 'Kunden-Nr.'],
            ['street', 'Straße'],
            ['city', 'PLZ / Ort'],
          ].map(([k, label]) => (
            <div key={k} className="field">
              <label>{label}</label>
              <input value={customer[k]} onChange={(e) => u(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview View
// ─────────────────────────────────────────────────────────────────────────────
function PreviewView({ company, customer, meta, rows, netTotal, vatAmt, gross }) {
  let posN = 0
  const { apiFetch } = useAuth()
  const [settings, setSettings] = useState({})

  useEffect(() => {
    apiFetch('/settings')
      .then(r => r?.ok ? r.json() : {})
      .then(d => setSettings(d || {}))
      .catch(() => setSettings({}))
  }, [])

  // Use settings values with fallback to props
  const s = settings || {}
  const companyName    = s.company_name    || company.name
  const companyStreet  = s.company_street  || company.street
  const companyCity    = s.company_city    || company.city
  const companyPhone   = s.company_phone   || company.phone
  const companyEmail   = s.company_email   || company.email
  const companyManager = s.company_manager || company.manager
  const companyHrb     = s.company_hrb     || company.hrb
  const companyUstid   = s.company_ustid   || company.ustid
  const bankName       = s.bank_name       || company.bank
  const bankIban       = s.bank_iban       || company.iban
  const bankBic        = s.bank_bic        || company.bic
  const vatRate        = s.vat_rate        || meta.vat
  const depositPct     = s.deposit_percent || meta.depositPercent
  const depositDays    = s.deposit_days    || meta.depositDays
  const disclaimer     = s.quote_disclaimer || meta.disclaimer
  const greeting       = s.quote_greeting   || meta.greeting
  const logoData       = s.logo_data && s.logo_data.length > 20 ? s.logo_data : null

  return (
    <div className="preview-wrap">
      <div className="preview-actions">
        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Icon name="print" /> Drucken / Als PDF speichern
        </button>
      </div>

      <div className="preview-page" id="preview-page">
        {/* Logo */}
        <div className="preview-logo" style={logoData ? {textTransform:'none',letterSpacing:0,fontFamily:'inherit'} : {}}>
          {logoData
            ? <img src={logoData} alt="Logo"
                style={{maxHeight:90, maxWidth:300, objectFit:'contain', display:'block', margin:'0 auto'}} />
            : <>{companyName}</>
          }
        </div>

        {/* Addresses */}
        <div className="preview-header-row">
          <div className="preview-addr">
            <div className="preview-from-line">
              {companyName} · {companyStreet} · {companyCity}
            </div>
            <div className="preview-customer">
              <strong>{customer.company}</strong>
              <div>{customer.street}</div>
              <div>{customer.city}</div>
            </div>
          </div>
          <div className="preview-sender">
            <strong>{companyName}</strong>
            <div>{companyStreet}</div>
            <div>{companyCity}</div>
            {companyPhone && <div>Tel: {companyPhone}</div>}
          </div>
        </div>

        {/* Meta table */}
        <div className="preview-title">Angebot {meta.number}</div>
        <table className="preview-meta-table">
          <tbody>
            <tr>
              <td>Datum:</td>
              <td>{meta.date}</td>
              <td>Gültig bis:</td>
              <td>{meta.validUntil}</td>
            </tr>
            <tr>
              <td>Kommission:</td>
              <td>{meta.commission}</td>
              <td>Ihre Anfrage vom:</td>
              <td>{meta.requestDate}</td>
            </tr>
            <tr>
              <td>Kunden-Nr.:</td>
              <td>{customer.custNo || meta.customerRef}</td>
              <td>Bearbeiter:</td>
              <td>{meta.handler}</td>
            </tr>
            <tr>
              <td />
              <td />
              <td>E-Mail:</td>
              <td>{company.email}</td>
            </tr>
          </tbody>
        </table>

        {/* Greeting */}
        <div className="preview-greeting">
          {meta.greeting}
          <br />
          {meta.handler}
        </div>

        {/* Positions table */}
        <table className="preview-table">
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Bezeichnung</th>
              <th className="r">Menge</th>
              <th className="r">Preis/Einh €</th>
              <th className="r">Gesamt €</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (
                row.type === ROW_TYPES.ITEM ||
                row.type === ROW_TYPES.OPTIONAL
              )
                posN++
              const pos =
                row.type === ROW_TYPES.ITEM || row.type === ROW_TYPES.OPTIONAL
                  ? posN
                  : ''
              const total =
                (row.type === ROW_TYPES.ITEM ||
                  row.type === ROW_TYPES.OPTIONAL) &&
                row.qty &&
                row.price
                  ? Number(row.qty) * Number(row.price)
                  : null

              if (row.type === ROW_TYPES.DIVIDER)
                return (
                  <tr key={row.id}>
                    <td
                      colSpan={5}
                      style={{ borderBottom: '2px solid #ccc', padding: '4px 0' }}
                    />
                  </tr>
                )
              if (row.type === ROW_TYPES.TEXT)
                return (
                  <tr key={row.id}>
                    <td colSpan={5} className="text-block">
                      {row.description}
                      {row.note && <div className="text-note">{row.note}</div>}
                    </td>
                  </tr>
                )

              return (
                <tr
                  key={row.id}
                  className={
                    row.type === ROW_TYPES.CATEGORY
                      ? 'cat-row'
                      : row.type === ROW_TYPES.OPTIONAL
                      ? 'opt-row'
                      : ''
                  }
                >
                  <td>{pos}</td>
                  <td>
                    <strong>
                      {row.description}
                      {row.type === ROW_TYPES.OPTIONAL && (
                        <span className="badge-opt">Opt.</span>
                      )}
                    </strong>
                    {row.note && <div className="p-note">{row.note}</div>}
                  </td>
                  <td className="r">{total !== null ? row.qty : ''}</td>
                  <td className="r">
                    {total !== null ? fmt(row.price) : ''}
                  </td>
                  <td className="r">
                    {total !== null ? fmt(total) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="preview-totals">
          <table>
            <tbody>
              <tr>
                <td>Positionen netto</td>
                <td className="r">{fmt(netTotal)} €</td>
              </tr>
              <tr>
                <td>
                  Positionen USt. {vatRate}% auf {fmt(netTotal)} €
                </td>
                <td className="r">{fmt(vatAmt)} €</td>
              </tr>
              <tr className="grand">
                <td>Endsumme</td>
                <td className="r">{fmt(gross)} €</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Disclaimer & deposit */}
        {disclaimer && (
          <div className="preview-disclaimer">{disclaimer}</div>
        )}
        {depositPct && (
          <div className="preview-deposit">
            Bei Beauftragung wird eine Anzahlung in Höhe von {depositPct}%
            des Angebotswertes binnen {depositDays} Tagen sofort fällig.
          </div>
        )}

        {/* Footer */}
        <div className="preview-footer-grid">
          <div>
            <strong>{companyName}</strong>
            <br />
            {companyStreet}
            <br />
            {companyCity}
            <br />
            Geschäftsführer: {companyManager}
          </div>
          <div>
            <strong>{bankName}</strong>
            <br />
            IBAN: {bankIban}
            <br />
            BIC: {bankBic}
          </div>
          <div>
            <strong>{companyHrb}</strong>
            <br />
            UstID: {companyUstid}
          </div>
          <div>
            <strong>Kontakt</strong>
            <br />
            {companyEmail}
            <br />
            {companyPhone}
          </div>
        </div>
      </div>
    </div>
  )
}
