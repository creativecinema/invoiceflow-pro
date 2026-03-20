import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const RELATIONSHIPS = [
  { key: 'Interessent', label: 'Interessent' },
  { key: 'Kunde',       label: 'Kunde' },
  { key: 'Lieferant',   label: 'Lieferant' },
  { key: 'Wettbewerber',label: 'Wettbewerber' },
]

const REL_COLORS = {
  Interessent:  { bg:'#e8eef8', color:'#2a4a8a' },
  Kunde:        { bg:'#e8f4e8', color:'#2a7a2a' },
  Lieferant:    { bg:'#f4eee8', color:'#7a4a1a' },
  Wettbewerber: { bg:'#f4e8e8', color:'#8a2a2a' },
}

const EMPTY = {
  contact_type:'person', relationship:[], salutation:'', first_name:'', last_name:'',
  company:'', email:'', phone:'', street:'', zip:'', city:'', state:'', country:'Deutschland', notes:''
}

export default function Contacts() {
  const { apiFetch } = useAuth()
  const [contacts, setContacts] = useState([])
  const [form, setForm]         = useState(null)
  const [search, setSearch]     = useState('')
  const [relFilter, setRelFilter] = useState('all')
  const [toast, setToast]       = useState('')
  const [converting, setConverting] = useState(null)

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  const load = async () => {
    try {
      const r = await apiFetch('/contacts')
      if (r?.ok) {
        const data = await r.json()
        setContacts(data)
      } else if (r) {
        const err = await r.json().catch(()=>({}))
        console.error('Contacts.jsx load error:', r.status, err)
      }
    } catch(e) {
      console.error('Contacts.jsx load exception:', e)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    const isNew = !form.id
    const r = await apiFetch(isNew ? '/contacts' : `/contacts/${form.id}`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(form),
    })
    if (!r?.ok) { const d=await r.json(); showToast('Fehler: '+d.error); return }
    setForm(null)
    await load()
    showToast(isNew ? '✓ Kontakt angelegt' : '✓ Gespeichert')
  }

  const del = async (id) => {
    if (!confirm('Kontakt löschen?')) return
    await apiFetch(`/contacts/${id}`, { method:'DELETE' })
    await load()
    showToast('✓ Gelöscht')
  }

  const convert = async (contact) => {
    setConverting(contact.id)
    const r = await apiFetch(`/contacts/${contact.id}/convert`, { method:'POST' })
    setConverting(null)
    if (r?.ok) { await load(); showToast('✓ Zu Kunde konvertiert') }
    else { const d=await r.json(); showToast('Fehler: '+d.error) }
  }

  const toggleRel = (rel) => setForm(f => {
    const current = f.relationship || []
    return { ...f, relationship: current.includes(rel) ? current.filter(r=>r!==rel) : [...current, rel] }
  })

  const filtered = contacts.filter(c => {
    const name = [c.first_name, c.last_name, c.company].filter(Boolean).join(' ').toLowerCase()
    const matchSearch = name.includes(search.toLowerCase()) || (c.email||'').toLowerCase().includes(search.toLowerCase())
    const matchRel = relFilter === 'all' || (c.relationship||[]).includes(relFilter)
    return matchSearch && matchRel
  })

  const displayName = (c) => c.contact_type === 'company'
    ? c.company || '(Firma)'
    : [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company || '(Kontakt)'

  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span className="section-title">Kontakte</span>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen…"
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)',width:160}}/>
            <select value={relFilter} onChange={e=>setRelFilter(e.target.value)}
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper)'}}>
              <option value="all">Alle</option>
              {RELATIONSHIPS.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={()=>setForm({...EMPTY})}>+ Neuer Kontakt</button>
          </div>
        </div>

        <table className="user-table">
          <thead>
            <tr><th>Name / Firma</th><th>Art</th><th>Geschäftsbeziehung</th><th>E-Mail</th><th>Telefon</th><th>Ort</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id}>
                <td>
                  <strong>{displayName(c)}</strong>
                  {c.contact_type==='person' && c.company && <div style={{fontSize:11,color:'var(--ink3)'}}>{c.company}</div>}
                  {c.converted_to_customer && <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'#2a7a2a',marginTop:2}}>→ Kunde: {c.customer_name}</div>}
                </td>
                <td><span style={{fontFamily:'var(--font-mono)',fontSize:10,padding:'2px 6px',borderRadius:3,background:'var(--paper2)',color:'var(--ink2)'}}>{c.contact_type==='company'?'Firma':'Person'}</span></td>
                <td>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {(c.relationship||[]).map(r=>(
                      <span key={r} style={{...REL_COLORS[r],fontFamily:'var(--font-mono)',fontSize:9,padding:'2px 6px',borderRadius:3}}>{r}</span>
                    ))}
                  </div>
                </td>
                <td style={{fontSize:12}}>{c.email||'—'}</td>
                <td style={{fontSize:12,fontFamily:'var(--font-mono)'}}>{c.phone||'—'}</td>
                <td style={{fontSize:12}}>{[c.zip,c.city].filter(Boolean).join(' ')||'—'}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setForm({...c,relationship:c.relationship||[]})}>Bearbeiten</button>
                    {!c.converted_to_customer && (
                      <button className="btn btn-secondary btn-sm"
                        disabled={converting===c.id}
                        onClick={()=>convert(c)}
                        title="Zu Kunde konvertieren">
                        {converting===c.id?'…':'→ Kunde'}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={()=>del(c.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:24,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Kontakte gefunden</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {form && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setForm(null)}>
          <div className="modal" style={{maxWidth:620,maxHeight:'90vh',overflow:'auto'}}>
            <div className="modal-header">
              <span className="section-title">{form.id?'Kontakt bearbeiten':'Neuer Kontakt'}</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setForm(null)}>✕</button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:16}}>

              {/* Kontaktart */}
              <div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Kontaktart</div>
                <div style={{display:'flex',gap:16}}>
                  {[['person','Person'],['company','Firma']].map(([val,label])=>(
                    <label key={val} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                      <input type="radio" name="contact_type" value={val}
                        checked={form.contact_type===val}
                        onChange={()=>setForm(f=>({...f,contact_type:val}))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Geschäftsbeziehung */}
              <div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Geschäftsbeziehung</div>
                <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                  {RELATIONSHIPS.map(r=>(
                    <label key={r.key} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                      <input type="checkbox"
                        checked={(form.relationship||[]).includes(r.key)}
                        onChange={()=>toggleRel(r.key)} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Name fields */}
              <div className="grid-2">
                <div className="field"><label>Anrede</label>
                  <select value={form.salutation||''} onChange={e=>setForm(f=>({...f,salutation:e.target.value}))}
                    style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}>
                    <option value="">—</option><option>Herr</option><option>Frau</option><option>Divers</option>
                  </select>
                </div>
                <div className="field"><label>Firma</label>
                  <input value={form.company||''} onChange={e=>setForm(f=>({...f,company:e.target.value}))} /></div>
                <div className="field"><label>Vorname</label>
                  <input value={form.first_name||''} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} /></div>
                <div className="field"><label>Nachname</label>
                  <input value={form.last_name||''} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} /></div>
                <div className="field"><label>E-Mail</label>
                  <input type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Telefon</label>
                  <input value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>

              {/* Address */}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:14}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Adresse</div>
                <div className="grid-2">
                  <div className="field" style={{gridColumn:'1/-1'}}><label>Straße</label>
                    <input value={form.street||''} onChange={e=>setForm(f=>({...f,street:e.target.value}))} /></div>
                  <div className="field"><label>PLZ</label>
                    <input value={form.zip||''} onChange={e=>setForm(f=>({...f,zip:e.target.value}))} /></div>
                  <div className="field"><label>Stadt</label>
                    <input value={form.city||''} onChange={e=>setForm(f=>({...f,city:e.target.value}))} /></div>
                  <div className="field"><label>Bundesland</label>
                    <input value={form.state||''} onChange={e=>setForm(f=>({...f,state:e.target.value}))} /></div>
                  <div className="field"><label>Land</label>
                    <input value={form.country||'Deutschland'} onChange={e=>setForm(f=>({...f,country:e.target.value}))} /></div>
                </div>
              </div>

              <div className="field"><label>Notizen</label>
                <textarea rows={3} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setForm(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={save}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
