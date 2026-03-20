import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const EMPTY = {
  contact_type:'company', company:'', salutation:'', first_name:'', last_name:'',
  email:'', phone:'', website:'', street:'', zip:'', city:'', state:'',
  country:'Deutschland', category:'', notes:''
}

export default function Suppliers() {
  const { apiFetch } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm]           = useState(null)
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState('')

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  const load = async () => {
    try {
      const r = await apiFetch('/suppliers')
      if (r?.ok) {
        const data = await r.json()
        setSuppliers(data)
      } else if (r) {
        const err = await r.json().catch(()=>({}))
        console.error('Suppliers.jsx load error:', r.status, err)
      }
    } catch(e) {
      console.error('Suppliers.jsx load exception:', e)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    const isNew = !form.id
    const r = await apiFetch(isNew ? '/suppliers' : `/suppliers/${form.id}`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(form),
    })
    if (!r?.ok) { const d=await r.json(); showToast('Fehler: '+d.error); return }
    setForm(null)
    await load()
    showToast(isNew ? '✓ Lieferant angelegt' : '✓ Gespeichert')
  }

  const deactivate = async (id) => {
    if (!confirm('Lieferant deaktivieren?')) return
    await apiFetch(`/suppliers/${id}`, { method:'PUT', body:JSON.stringify({active:false}) })
    await load()
    showToast('✓ Deaktiviert')
  }

  const displayName = (s) => s.contact_type === 'company'
    ? s.company || '(Firma)'
    : [s.first_name, s.last_name].filter(Boolean).join(' ') || s.company || '(Lieferant)'

  const filtered = suppliers.filter(s =>
    displayName(s).toLowerCase().includes(search.toLowerCase()) ||
    (s.email||'').toLowerCase().includes(search.toLowerCase()) ||
    (s.category||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span className="section-title">Lieferanten</span>
          <div style={{display:'flex',gap:8}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen…"
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)',width:160}}/>
            <button className="btn btn-primary btn-sm" onClick={()=>setForm({...EMPTY})}>+ Neuer Lieferant</button>
          </div>
        </div>

        <table className="user-table">
          <thead>
            <tr><th>Name / Firma</th><th>Art</th><th>Kategorie</th><th>E-Mail</th><th>Telefon</th><th>Ort</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(s=>(
              <tr key={s.id} style={{opacity:s.active?1:0.45}}>
                <td>
                  <strong>{displayName(s)}</strong>
                  {s.contact_type==='person' && s.company && <div style={{fontSize:11,color:'var(--ink3)'}}>{s.company}</div>}
                  {s.website && <div style={{fontSize:10,color:'var(--ink3)',fontFamily:'var(--font-mono)'}}>{s.website}</div>}
                </td>
                <td><span style={{fontFamily:'var(--font-mono)',fontSize:10,padding:'2px 6px',borderRadius:3,background:'var(--paper2)',color:'var(--ink2)'}}>{s.contact_type==='company'?'Firma':'Person'}</span></td>
                <td style={{fontSize:12}}>{s.category||'—'}</td>
                <td style={{fontSize:12}}>{s.email||'—'}</td>
                <td style={{fontSize:12,fontFamily:'var(--font-mono)'}}>{s.phone||'—'}</td>
                <td style={{fontSize:12}}>{[s.zip,s.city].filter(Boolean).join(' ')||'—'}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setForm({...s})}>Bearbeiten</button>
                    {s.active && <button className="btn btn-danger btn-sm" onClick={()=>deactivate(s.id)}>Deaktiv.</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:24,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Lieferanten</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setForm(null)}>
          <div className="modal" style={{maxWidth:620,maxHeight:'90vh',overflow:'auto'}}>
            <div className="modal-header">
              <span className="section-title">{form.id?'Lieferant bearbeiten':'Neuer Lieferant'}</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setForm(null)}>✕</button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:16}}>

              {/* Kontaktart */}
              <div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Kontaktart</div>
                <div style={{display:'flex',gap:16}}>
                  {[['person','Person'],['company','Firma']].map(([val,label])=>(
                    <label key={val} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                      <input type="radio" name="sup_type" value={val}
                        checked={form.contact_type===val}
                        onChange={()=>setForm(f=>({...f,contact_type:val}))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid-2">
                <div className="field" style={{gridColumn:'1/-1'}}><label>Firma</label>
                  <input value={form.company||''} onChange={e=>setForm(f=>({...f,company:e.target.value}))} /></div>
                <div className="field"><label>Anrede</label>
                  <select value={form.salutation||''} onChange={e=>setForm(f=>({...f,salutation:e.target.value}))}
                    style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}>
                    <option value="">—</option><option>Herr</option><option>Frau</option><option>Divers</option>
                  </select></div>
                <div className="field"><label>Kategorie</label>
                  <input value={form.category||''} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="z.B. Dienstleister, Technik…"/></div>
                <div className="field"><label>Vorname</label>
                  <input value={form.first_name||''} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} /></div>
                <div className="field"><label>Nachname</label>
                  <input value={form.last_name||''} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} /></div>
                <div className="field"><label>E-Mail</label>
                  <input type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Telefon</label>
                  <input value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
                <div className="field" style={{gridColumn:'1/-1'}}><label>Website</label>
                  <input value={form.website||''} onChange={e=>setForm(f=>({...f,website:e.target.value}))} /></div>
              </div>

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
