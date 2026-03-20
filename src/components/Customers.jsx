import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})
const ADDR_TYPES = { main:'Hauptadresse', billing:'Rechnungsadresse', delivery:'Lieferadresse', other:'Sonstige' }
const STATUS_LABELS = { draft:'Entwurf', sent:'Versendet', accepted:'Bestellt', rejected:'Abgelehnt' }
const STATUS_COLORS = { draft:'quote-status-draft', sent:'quote-status-sent', accepted:'quote-status-accepted', rejected:'quote-status-rejected' }

const EMPTY = {
  name:'', short_name:'', customer_number:'', payment_days:30,
  payment_note:'', website:'', industry:'', notes:'',
  addresses:[{type:'main',street:'',zip:'',city:'',country:'Deutschland',is_default:true}],
  contacts:[{salutation:'',first_name:'',last_name:'',position:'',email:'',phone:'',mobile:'',is_primary:true}]
}

export default function Customers() {
  const { apiFetch, isManagement } = useAuth()
  const [customers, setCustomers] = useState([])
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState(null)
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState('')

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2200) }

  const load = async () => {
    const r = await apiFetch('/customers')
    if (r?.ok) setCustomers(await r.json())
  }

  const loadDetail = async (id) => {
    const r = await apiFetch(`/customers/${id}`)
    if (r?.ok) { const d = await r.json(); setSelected(d); return d }
  }

  useEffect(() => { load() }, [])

  const openEdit = async (c, e) => {
    if (e) e.stopPropagation()
    const detail = await loadDetail(c.id)
    if (detail) setForm({
      id: detail.id,
      name: detail.name, short_name: detail.short_name||'',
      customer_number: detail.customer_number||'',
      payment_days: detail.payment_days||30,
      payment_note: detail.payment_note||'',
      website: detail.website||'', industry: detail.industry||'', notes: detail.notes||'',
      addresses: detail.addresses?.length ? detail.addresses : EMPTY.addresses,
      contacts:  detail.contacts?.length  ? detail.contacts  : EMPTY.contacts,
    })
  }

  const save = async () => {
    const isNew = !form.id
    const r = await apiFetch(isNew ? '/customers' : `/customers/${form.id}`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(form),
    })
    const data = await r.json()
    if (!r?.ok) { showToast('Fehler: '+(data.error||'Unbekannt')); return }
    setForm(null)
    await load()
    if (selected) await loadDetail(selected.id)
    showToast(isNew ? '✓ Kunde angelegt' : '✓ Gespeichert')
  }

  const del = async (id) => {
    if (!confirm('Kunden löschen? Alle zugehörigen Angebote werden getrennt.')) return
    await apiFetch(`/customers/${id}`, { method:'DELETE' })
    setSelected(null); load(); showToast('✓ Gelöscht')
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_number||'').toLowerCase().includes(search.toLowerCase())
  )

  const setAddr = (i,k,v) => setForm(f=>{const addresses=[...f.addresses];addresses[i]={...addresses[i],[k]:v};return{...f,addresses}})
  const addAddr = () => setForm(f=>({...f,addresses:[...f.addresses,{type:'other',street:'',zip:'',city:'',country:'Deutschland',is_default:false}]}))
  const removeAddr = (i) => setForm(f=>({...f,addresses:f.addresses.filter((_,j)=>j!==i)}))
  const setContact = (i,k,v) => setForm(f=>{const contacts=[...f.contacts];contacts[i]={...contacts[i],[k]:v};return{...f,contacts}})
  const addContact = () => setForm(f=>({...f,contacts:[...f.contacts,{salutation:'',first_name:'',last_name:'',position:'',email:'',phone:'',mobile:'',is_primary:false}]}))
  const removeContact = (i) => setForm(f=>({...f,contacts:f.contacts.filter((_,j)=>j!==i)}))

  // ── Detail view ───────────────────────────────────────────────
  if (selected) return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button className="btn btn-secondary btn-sm" onClick={()=>setSelected(null)}>← Zurück</button>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:20,flex:1}}>{selected.name}</h2>
        <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(selected)}>Bearbeiten</button>
        {isManagement&&<button className="btn btn-danger btn-sm" onClick={()=>del(selected.id)}>Löschen</button>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="section">
          <div className="section-header"><span className="section-title">Kennzahlen</span></div>
          <div className="section-body" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              ['Angebote','', selected.quotes?.length||0],
              ['Bestellt','#2a7a2a', selected.quotes?.filter(q=>q.status==='accepted').length||0],
              ['Umsatz netto','', fmt(selected.quotes?.filter(q=>q.status==='accepted').reduce((s,q)=>s+Number(q.net_total||0),0)||0)+' €'],
              ['Gesamtvolumen','', fmt(selected.quotes?.reduce((s,q)=>s+Number(q.net_total||0),0)||0)+' €'],
            ].map(([label,color,val])=>(
              <div key={label} style={{background:'var(--paper)',padding:'12px 14px',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{label}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:16,fontWeight:500,color:color||'var(--ink)'}}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-header"><span className="section-title">Stammdaten</span></div>
          <div className="section-body">
            {[['Kundennummer',selected.customer_number],['Zahlungsziel',selected.payment_days?selected.payment_days+' Tage':'—'],
              ['Zahlungshinweis',selected.payment_note],['Branche',selected.industry],['Website',selected.website]]
              .filter(([,v])=>v).map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:12,marginBottom:6,fontSize:13}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',minWidth:120,paddingTop:2}}>{l}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="section">
          <div className="section-header"><span className="section-title">Adressen</span></div>
          <div className="section-body">
            {selected.addresses?.map((a,i)=>(
              <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',textTransform:'uppercase',marginBottom:4}}>
                  {ADDR_TYPES[a.type]||a.type}{a.is_default&&' ★'}
                </div>
                <div style={{fontSize:13,lineHeight:1.7}}>{a.street}<br/>{a.zip} {a.city}<br/>{a.country}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="section">
          <div className="section-header"><span className="section-title">Ansprechpartner</span></div>
          <div className="section-body">
            {selected.contacts?.map((c,i)=>(
              <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:600,fontSize:13}}>{c.salutation} {c.first_name} {c.last_name}
                  {c.is_primary&&<span className="badge-you">primär</span>}</div>
                {c.position&&<div style={{fontSize:11,color:'var(--ink3)'}}>{c.position}</div>}
                {c.email&&<div style={{fontSize:12,marginTop:2}}>✉ {c.email}</div>}
                {c.phone&&<div style={{fontSize:12}}>☎ {c.phone}</div>}
                {c.mobile&&<div style={{fontSize:12}}>📱 {c.mobile}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom prices */}
      {selected.custom_prices?.length > 0 && (
        <div className="section" style={{marginBottom:16}}>
          <div className="section-header"><span className="section-title">Individuelle Artikelpreise</span></div>
          <table className="user-table">
            <thead><tr><th>Artikel</th><th>Einheit</th><th className="text-right">Standardpreis</th><th className="text-right">Kundenpreis</th><th>Notiz</th></tr></thead>
            <tbody>
              {selected.custom_prices.map(p=>(
                <tr key={p.id}>
                  <td><strong>{p.article_name}</strong>{p.article_number&&<span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',marginLeft:8}}>{p.article_number}</span>}</td>
                  <td className="mono-small">{p.unit}</td>
                  <td className="mono-small" style={{textAlign:'right',color:'var(--ink3)',textDecoration:'line-through'}}>{fmt(p.default_price)} €</td>
                  <td className="mono-small" style={{textAlign:'right',fontWeight:600,color:'var(--accent)'}}>{fmt(p.price)} €</td>
                  <td style={{fontSize:12,color:'var(--ink3)'}}>{p.note||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <div className="section-header"><span className="section-title">Angebote</span></div>
        {!selected.quotes?.length
          ? <div style={{padding:'20px',color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Angebote vorhanden</div>
          : <table className="user-table">
              <thead><tr><th>Nr.</th><th>Datum</th><th>Bearbeiter</th><th>Status</th><th className="text-right">Netto</th></tr></thead>
              <tbody>
                {selected.quotes.map(q=>(
                  <tr key={q.id}>
                    <td><strong>{q.number}</strong></td>
                    <td className="mono-small">{new Date(q.created_at).toLocaleDateString('de-DE')}</td>
                    <td>{q.owner_name}</td>
                    <td><span className={`status-pill ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span></td>
                    <td className="mono-small" style={{textAlign:'right'}}>{fmt(q.net_total)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {form && <CustomerForm form={form} setForm={setForm} save={save}
        setAddr={setAddr} addAddr={addAddr} removeAddr={removeAddr}
        setContact={setContact} addContact={addContact} removeContact={removeContact} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── List view ──────────────────────────────────────────────────
  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span className="section-title">Kunden</span>
          <div style={{display:'flex',gap:8}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen…"
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}/>
            <button className="btn btn-primary btn-sm" onClick={()=>setForm({...EMPTY})}>+ Neuer Kunde</button>
          </div>
        </div>
        <table className="user-table">
          <thead>
            <tr><th>Kunde</th><th>Kunden-Nr.</th><th>Zahlungsziel</th><th>Angebote</th><th className="text-right">Bestellt</th><th className="text-right">Umsatz netto</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>loadDetail(c.id)}>
                <td>
                  <strong>{c.name}</strong>
                  {c.primary_contact&&<div style={{fontSize:11,color:'var(--ink3)'}}>{c.primary_contact.first_name} {c.primary_contact.last_name}</div>}
                </td>
                <td className="mono-small">{c.customer_number||'—'}</td>
                <td className="mono-small">{c.payment_days} Tage</td>
                <td className="mono-small">{c.quote_count}</td>
                <td className="mono-small" style={{textAlign:'right'}}>{c.accepted_count}</td>
                <td className="mono-small" style={{textAlign:'right',fontWeight:500}}>{fmt(c.revenue_net)} €</td>
                <td onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={(e)=>openEdit(c,e)}>Bearbeiten</button>
                </td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:24,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Kunden</td></tr>}
          </tbody>
        </table>
      </div>

      {form && <CustomerForm form={form} setForm={setForm} save={save}
        setAddr={setAddr} addAddr={addAddr} removeAddr={removeAddr}
        setContact={setContact} addContact={addContact} removeContact={removeContact} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function CustomerForm({ form, setForm, save, setAddr, addAddr, removeAddr, setContact, addContact, removeContact }) {
  const [tab, setTab] = useState('stamm')
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setForm(null)}>
      <div className="modal" style={{maxWidth:680,maxHeight:'90vh',overflow:'auto'}}>
        <div className="modal-header">
          <span className="section-title">{form.id?'Kunde bearbeiten':'Neuer Kunde'}</span>
          <button className="btn btn-ghost btn-icon" onClick={()=>setForm(null)}>✕</button>
        </div>
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',padding:'0 24px'}}>
          {[['stamm','Stammdaten'],['adressen','Adressen'],['kontakte','Ansprechpartner']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'10px 16px',background:'transparent',border:'none',cursor:'pointer',
              fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'0.05em',
              color:tab===id?'var(--accent)':'var(--ink3)',
              borderBottom:tab===id?'2px solid var(--accent)':'2px solid transparent',marginBottom:-1}}>
              {label}
            </button>
          ))}
        </div>
        <div className="modal-body">
          {tab==='stamm'&&(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="grid-2">
                <div className="field"><label>Firmenname *</label><input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
                <div className="field"><label>Kurzname</label><input value={form.short_name||''} onChange={e=>setForm(f=>({...f,short_name:e.target.value}))} /></div>
                <div className="field"><label>Kundennummer</label><input value={form.customer_number||''} onChange={e=>setForm(f=>({...f,customer_number:e.target.value}))} /></div>
                <div className="field"><label>Branche</label><input value={form.industry||''} onChange={e=>setForm(f=>({...f,industry:e.target.value}))} /></div>
                <div className="field"><label>Zahlungsziel (Tage)</label><input type="number" value={form.payment_days||30} onChange={e=>setForm(f=>({...f,payment_days:Number(e.target.value)}))} /></div>
                <div className="field"><label>Website</label><input value={form.website||''} onChange={e=>setForm(f=>({...f,website:e.target.value}))} /></div>
              </div>
              <div className="field"><label>Zahlungshinweis</label><input value={form.payment_note||''} onChange={e=>setForm(f=>({...f,payment_note:e.target.value}))} /></div>
              <div className="field"><label>Notizen</label><textarea rows={3} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>
          )}
          {tab==='adressen'&&(
            <div>
              {(form.addresses||[]).map((a,i)=>(
                <div key={i} style={{border:'1px solid var(--border)',borderRadius:'var(--r)',padding:14,marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <select value={a.type} onChange={e=>setAddr(i,'type',e.target.value)}
                      style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:'var(--r)',background:'var(--paper)'}}>
                      {Object.entries(ADDR_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <label style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',display:'flex',gap:6,alignItems:'center'}}>
                        <input type="checkbox" checked={!!a.is_default} onChange={e=>setAddr(i,'is_default',e.target.checked)} />Standard
                      </label>
                      {(form.addresses||[]).length>1&&<button className="btn btn-danger btn-sm" onClick={()=>removeAddr(i)}>✕</button>}
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field" style={{gridColumn:'1/-1'}}><label>Straße</label><input value={a.street||''} onChange={e=>setAddr(i,'street',e.target.value)} /></div>
                    <div className="field"><label>PLZ</label><input value={a.zip||''} onChange={e=>setAddr(i,'zip',e.target.value)} /></div>
                    <div className="field"><label>Ort</label><input value={a.city||''} onChange={e=>setAddr(i,'city',e.target.value)} /></div>
                    <div className="field"><label>Land</label><input value={a.country||'Deutschland'} onChange={e=>setAddr(i,'country',e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addAddr}>+ Adresse</button>
            </div>
          )}
          {tab==='kontakte'&&(
            <div>
              {(form.contacts||[]).map((c,i)=>(
                <div key={i} style={{border:'1px solid var(--border)',borderRadius:'var(--r)',padding:14,marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink3)'}}>Kontakt {i+1}</span>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <label style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',display:'flex',gap:6,alignItems:'center'}}>
                        <input type="checkbox" checked={!!c.is_primary} onChange={e=>setContact(i,'is_primary',e.target.checked)} />Primär
                      </label>
                      {(form.contacts||[]).length>1&&<button className="btn btn-danger btn-sm" onClick={()=>removeContact(i)}>✕</button>}
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field"><label>Anrede</label>
                      <select value={c.salutation||''} onChange={e=>setContact(i,'salutation',e.target.value)}
                        style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}>
                        <option value="">—</option><option>Herr</option><option>Frau</option><option>Divers</option>
                      </select></div>
                    <div className="field"><label>Position</label><input value={c.position||''} onChange={e=>setContact(i,'position',e.target.value)} /></div>
                    <div className="field"><label>Vorname</label><input value={c.first_name||''} onChange={e=>setContact(i,'first_name',e.target.value)} /></div>
                    <div className="field"><label>Nachname *</label><input value={c.last_name||''} onChange={e=>setContact(i,'last_name',e.target.value)} /></div>
                    <div className="field"><label>E-Mail</label><input type="email" value={c.email||''} onChange={e=>setContact(i,'email',e.target.value)} /></div>
                    <div className="field"><label>Telefon</label><input value={c.phone||''} onChange={e=>setContact(i,'phone',e.target.value)} /></div>
                    <div className="field"><label>Mobil</label><input value={c.mobile||''} onChange={e=>setContact(i,'mobile',e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addContact}>+ Ansprechpartner</button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={()=>setForm(null)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={save}>Speichern</button>
        </div>
      </div>
    </div>
  )
}
