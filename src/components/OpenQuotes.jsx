import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})
const STATUS = {
  draft:    { label:'Entwurf',   cls:'quote-status-draft' },
  sent:     { label:'Versendet', cls:'quote-status-sent' },
  accepted: { label:'Bestellt',  cls:'quote-status-accepted' },
  rejected: { label:'Abgelehnt',cls:'quote-status-rejected' },
}

export default function OpenQuotes({ onEditQuote }) {
  const { apiFetch } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [sort, setSort]     = useState({ col:'created_at', dir:'desc' })
  const [filter, setFilter] = useState('open') // open | all
  const [toast, setToast]   = useState('')

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    apiFetch('/quotes').then(r=>r?.ok&&r.json()).then(d=>d&&setQuotes(d))
  }, [])

  const convertToOrder = async (quote) => {
    if (!confirm(`Angebot ${quote.number} in einen Auftrag umwandeln?`)) return
    const r = await apiFetch(`/quotes/${quote.id}/convert-to-order`, { method:'POST' })
    if (r?.ok) {
      const d = await r.json()
      showToast(`✓ Auftrag ${d.order_number} erstellt`)
      apiFetch('/quotes').then(r=>r?.ok&&r.json()).then(d=>d&&setQuotes(d))
    } else {
      const e = await r.json().catch(()=>({}))
      showToast('Fehler: ' + (e.error||'Unbekannt'))
    }
  }

  const sorted = [...quotes]
    .filter(q => filter === 'all' || (filter === 'open' && ['draft','sent'].includes(q.status)))
    .sort((a,b) => {
      let av = a[sort.col]||'', bv = b[sort.col]||''
      if (sort.col === 'net_total') { av = Number(av); bv = Number(bv) }
      return sort.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1)
    })

  const SortBtn = ({col, label}) => (
    <span onClick={()=>setSort(s=>({col, dir:s.col===col&&s.dir==='asc'?'desc':'asc'}))}
      style={{cursor:'pointer',userSelect:'none',
        color:sort.col===col?'var(--accent)':'inherit',
        fontWeight:sort.col===col?'600':'400'}}>
      {label}{sort.col===col?(sort.dir==='asc'?' ↑':' ↓'):''}
    </span>
  )

  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span className="section-title">Offene Angebote</span>
          <div style={{display:'flex',gap:8}}>
            <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:'var(--r)',overflow:'hidden'}}>
              {[['open','Offen'],['all','Alle']].map(([val,label])=>(
                <button key={val} onClick={()=>setFilter(val)} style={{
                  padding:'5px 14px', border:'none', cursor:'pointer',
                  fontFamily:'var(--font-mono)', fontSize:11,
                  background: filter===val ? 'var(--ink)' : 'transparent',
                  color: filter===val ? '#fff' : 'var(--ink3)',
                }}>{label}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={()=>onEditQuote(null)}>
              + Neues Angebot
            </button>
          </div>
        </div>

        <table className="user-table">
          <thead>
            <tr>
              <th><SortBtn col="number" label="Angebotsnr." /></th>
              <th><SortBtn col="customer_name" label="Kunde" /></th>
              <th><SortBtn col="created_at" label="Erstellt" /></th>
              <th><SortBtn col="valid_until" label="Gültig bis" /></th>
              <th>Status</th>
              <th className="text-right"><SortBtn col="net_total" label="Netto" /></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(q => {
              const meta = typeof q.meta === 'string' ? JSON.parse(q.meta||'{}') : (q.meta||{})
              const validUntil = meta.validUntil || '—'
              return (
                <tr key={q.id}>
                  <td><strong style={{fontFamily:'var(--font-mono)',fontSize:12}}>{q.number}</strong></td>
                  <td>{q.customer_name || <span style={{color:'var(--ink3)'}}>—</span>}</td>
                  <td className="mono-small">{new Date(q.created_at).toLocaleDateString('de-DE')}</td>
                  <td className="mono-small">{validUntil}</td>
                  <td>
                    <span className={`status-pill ${STATUS[q.status]?.cls}`}>
                      {STATUS[q.status]?.label}
                    </span>
                  </td>
                  <td className="mono-small" style={{textAlign:'right'}}>{fmt(q.net_total)} €</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>onEditQuote(q.id)}>
                        Bearbeiten
                      </button>
                      {['draft','sent'].includes(q.status) && (
                        <button className="btn btn-primary btn-sm" onClick={()=>convertToOrder(q)}>
                          → Auftrag
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {sorted.length===0 && (
              <tr><td colSpan={7} style={{textAlign:'center',padding:28,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>
                Keine Angebote vorhanden
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
