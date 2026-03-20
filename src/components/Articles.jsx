import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})
const UNITS = ['Std.','Tag','Pauschal','Stück','m²','m','km']
const EMPTY = { number:'', name:'', description:'', unit:'Std.', price:'', category:'' }

export default function Articles() {
  const { apiFetch, isManagement } = useAuth()
  const [articles, setArticles] = useState([])
  const [customers, setCustomers] = useState([])
  const [form, setForm]       = useState(null)
  const [detail, setDetail]   = useState(null)  // article with prices
  const [prices, setPrices]   = useState([])    // prices for detail article
  const [priceForm, setPriceForm] = useState(null)
  const [search, setSearch]   = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [toast, setToast]     = useState('')

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2200) }

  const load = async () => {
    const [ar, cu] = await Promise.all([
      apiFetch('/articles/all').then(r=>r?.ok?r.json():[]),
      apiFetch('/customers').then(r=>r?.ok?r.json():[]),
    ])
    setArticles(ar)
    setCustomers(cu)
  }

  const loadPrices = async (id) => {
    const r = await apiFetch(`/articles/${id}/prices`)
    if (r?.ok) setPrices(await r.json())
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    const isNew = !form.id
    const r = await apiFetch(isNew ? '/articles' : `/articles/${form.id}`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({...form, price: Number(form.price)||0}),
    })
    if (!r?.ok) { const d=await r.json(); showToast('Fehler: '+d.error); return }
    setForm(null); await load()
    showToast(isNew ? '✓ Artikel angelegt' : '✓ Artikel gespeichert')
  }

  const toggleActive = async (article) => {
    const action = article.active ? 'deaktivieren' : 'aktivieren'
    if (!confirm(`Artikel ${action}?`)) return
    await apiFetch(`/articles/${article.id}`, {
      method: 'PUT',
      body: JSON.stringify({ active: !article.active })
    })
    await load()
    showToast(article.active ? '✓ Deaktiviert' : '✓ Aktiviert')
  }

  const openDetail = async (a) => {
    setDetail(a)
    loadPrices(a.id)
  }

  const savePrice = async () => {
    if (!priceForm) return
    const r = await apiFetch(`/customers/${priceForm.customer_id}/prices`, {
      method: 'POST',
      body: JSON.stringify({ article_id: detail.id, price: Number(priceForm.price)||0, note: priceForm.note }),
    })
    if (r?.ok) { loadPrices(detail.id); setPriceForm(null); showToast('✓ Preis gespeichert') }
  }

  const deletePrice = async (customerId) => {
    await apiFetch(`/customers/${customerId}/prices/${detail.id}`, { method:'DELETE' })
    loadPrices(detail.id); showToast('✓ Preis entfernt')
  }

  const categories = ['all', ...new Set(articles.map(a=>a.category).filter(Boolean))]
  const filtered = articles.filter(a =>
    (catFilter==='all' || a.category===catFilter) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) ||
     (a.number||'').toLowerCase().includes(search.toLowerCase()))
  )

  // ── Detail view ────────────────────────────────────────────────
  if (detail) return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button className="btn btn-secondary btn-sm" onClick={()=>setDetail(null)}>← Zurück</button>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:20,flex:1}}>{detail.name}</h2>
        <button className="btn btn-secondary btn-sm" onClick={()=>setForm({...detail})}>Bearbeiten</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="section">
          <div className="section-header"><span className="section-title">Artikeldetails</span></div>
          <div className="section-body">
            {[
              ['Artikelnummer', detail.number],
              ['Kategorie', detail.category],
              ['Einheit', detail.unit],
              ['Standardpreis', fmt(detail.price)+' €'],
              ['Beschreibung', detail.description],
            ].filter(([,v])=>v).map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:12,marginBottom:8,fontSize:13}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',minWidth:120,paddingTop:2}}>{l}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <span className="section-title">Kundenpreise</span>
            <button className="btn btn-primary btn-sm" onClick={()=>setPriceForm({customer_id:'',price:'',note:''})}>
              + Kundenpreis
            </button>
          </div>
          {prices.length===0
            ? <div style={{padding:'16px 20px',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink3)'}}>Keine individuellen Preise hinterlegt</div>
            : <table className="user-table">
                <thead><tr><th>Kunde</th><th className="text-right">Standardpreis</th><th className="text-right">Kundenpreis</th><th></th></tr></thead>
                <tbody>
                  {prices.map(p=>(
                    <tr key={p.id}>
                      <td><strong>{p.customer_name}</strong><div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)'}}>{p.customer_number}</div></td>
                      <td className="mono-small" style={{textAlign:'right',color:'var(--ink3)',textDecoration:'line-through'}}>{fmt(detail.price)} €</td>
                      <td className="mono-small" style={{textAlign:'right',fontWeight:600,color:'var(--accent)'}}>{fmt(p.price)} €</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={()=>deletePrice(p.customer_id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>

      {/* Price form modal */}
      {priceForm && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setPriceForm(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="section-title">Kundenpreis hinterlegen</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setPriceForm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div className="field"><label>Kunde</label>
                  <select value={priceForm.customer_id} onChange={e=>setPriceForm(f=>({...f,customer_id:e.target.value}))}
                    style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}>
                    <option value="">— Kunde wählen —</option>
                    {customers.filter(c=>!prices.find(p=>p.customer_id===c.id)).map(c=>(
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field"><label>Kundenpreis (€)</label>
                  <input type="number" step="0.01" value={priceForm.price}
                    onChange={e=>setPriceForm(f=>({...f,price:e.target.value}))}
                    placeholder={fmt(detail.price)} />
                </div>
                <div className="field"><label>Notiz (optional)</label>
                  <input value={priceForm.note||''} onChange={e=>setPriceForm(f=>({...f,note:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPriceForm(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={savePrice}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {form && <ArticleForm form={form} setForm={setForm} save={save} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── List view ──────────────────────────────────────────────────
  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span className="section-title">Artikelverwaltung</span>
          <div style={{display:'flex',gap:8}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen…"
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}/>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper)'}}>
              {categories.map(c=><option key={c} value={c}>{c==='all'?'Alle Kategorien':c}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={()=>setForm({...EMPTY})}>+ Neuer Artikel</button>
          </div>
        </div>

        <table className="user-table">
          <thead>
            <tr><th>Artikel</th><th>Kategorie</th><th>Einheit</th><th className="text-right">Standardpreis</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(a=>(
              <tr key={a.id} style={{cursor:'pointer',opacity:a.active?1:0.45}} onClick={()=>openDetail(a)}>
                <td>
                  <strong>{a.name}</strong>
                  {a.number&&<span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',marginLeft:8}}>{a.number}</span>}
                  {a.description&&<div style={{fontSize:11,color:'var(--ink3)',marginTop:2}}>{a.description.slice(0,60)}{a.description.length>60?'…':''}</div>}
                </td>
                <td className="mono-small">{a.category||'—'}</td>
                <td className="mono-small">{a.unit}</td>
                <td className="mono-small" style={{textAlign:'right',fontWeight:500}}>{fmt(a.price)} €</td>
                <td><span className={`status-pill ${a.active?'status-active':'status-inactive'}`}>{a.active?'Aktiv':'Inaktiv'}</span></td>
                <td onClick={e=>e.stopPropagation()} style={{display:'flex',gap:6}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setForm({...a})}>Bearbeiten</button>
                  {isManagement&&<button
                    className={`btn btn-sm ${a.active?'btn-danger':'btn-secondary'}`}
                    onClick={e=>{e.stopPropagation();toggleActive(a)}}>
                    {a.active?'Deaktiv.':'Aktivieren'}
                  </button>}
                </td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Artikel</td></tr>}
          </tbody>
        </table>
      </div>

      {form && <ArticleForm form={form} setForm={setForm} save={save} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function ArticleForm({ form, setForm, save }) {
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setForm(null)}>
      <div className="modal">
        <div className="modal-header">
          <span className="section-title">{form.id?'Artikel bearbeiten':'Neuer Artikel'}</span>
          <button className="btn btn-ghost btn-icon" onClick={()=>setForm(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="grid-2">
              <div className="field"><label>Artikelnummer</label>
                <input value={form.number||''} onChange={e=>setForm(f=>({...f,number:e.target.value}))} placeholder="z.B. RED-001" /></div>
              <div className="field"><label>Kategorie</label>
                <input value={form.category||''} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="z.B. Personal, Technik…" /></div>
              <div className="field" style={{gridColumn:'1/-1'}}><label>Name *</label>
                <input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
              <div className="field"><label>Einheit</label>
                <select value={form.unit||'Std.'} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}
                  style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',fontFamily:'var(--font-body)',fontSize:13,background:'var(--paper)'}}>
                  {UNITS.map(u=><option key={u}>{u}</option>)}
                </select></div>
              <div className="field"><label>Standardpreis (€)</label>
                <input type="number" step="0.01" value={form.price||''} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0,00" /></div>
            </div>
            <div className="field"><label>Beschreibung</label>
              <textarea rows={3} value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={()=>setForm(null)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={save}>Speichern</button>
        </div>
      </div>
    </div>
  )
}
