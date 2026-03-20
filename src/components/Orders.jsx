import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})
const uid = () => Math.random().toString(36).slice(2,9)

const STATUS = {
  open:        { label:'Offen',         color:'#2a4a8a', bg:'#e8eef8' },
  in_progress: { label:'In Bearbeitung',color:'#7a6a1a', bg:'#fef8e8' },
  completed:   { label:'Abgeschlossen', color:'#2a7a2a', bg:'#e8f4e8' },
  cancelled:   { label:'Storniert',     color:'#8a2a2a', bg:'#f4e8e8' },
}

const ROW_TYPES = { CATEGORY:'category', ITEM:'item', OPTIONAL:'optional', TEXT:'text' }

export default function Orders() {
  const { apiFetch } = useAuth()
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [completing, setCompleting] = useState(false)

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  const load = async () => {
    const r = await apiFetch('/orders')
    if (r?.ok) setOrders(await r.json())
  }

  useEffect(() => { load() }, [])

  const openOrder = async (id) => {
    const r = await apiFetch(`/orders/${id}`)
    if (r?.ok) setSelected(await r.json())
  }

  const saveRows = async (rows) => {
    await apiFetch(`/orders/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({ rows }),
    })
    setSelected(s => ({ ...s, rows }))
    showToast('✓ Gespeichert')
  }

  const complete = async () => {
    if (!confirm(`Auftrag ${selected.order_number} abschließen und Rechnung erstellen?`)) return
    setCompleting(true)
    const r = await apiFetch(`/orders/${selected.id}/complete`, { method:'POST' })
    setCompleting(false)
    if (r?.ok) {
      const d = await r.json()
      showToast(`✓ Rechnung ${d.invoice_number} erstellt`)
      setSelected(null)
      load()
    } else {
      const e = await r.json().catch(()=>({}))
      showToast('Fehler: ' + (e.error||'Unbekannt'))
    }
  }

  const setStatus = async (status) => {
    await apiFetch(`/orders/${selected.id}`, { method:'PUT', body:JSON.stringify({ status }) })
    setSelected(s => ({ ...s, status }))
    load()
    showToast('✓ Status aktualisiert')
  }

  // ── Order detail / row editor ────────────────────────────────
  if (selected) {
    const rows = Array.isArray(selected.rows) ? selected.rows : JSON.parse(selected.rows||'[]')
    const netTotal = rows.reduce((s,r) => r.type==='item'&&r.qty&&r.price ? s+Number(r.qty)*Number(r.price) : s, 0)

    const updateRow = (id, key, val) => {
      const next = rows.map(r => r.id===id ? {...r,[key]:val} : r)
      saveRows(next)
    }
    const deleteRow = (id) => saveRows(rows.filter(r => r.id!==id))

    return (
      <div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setSelected(null)}>← Zurück</button>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:20,flex:1}}>
            Auftrag {selected.order_number}
          </h2>
          <span style={{...STATUS[selected.status],fontFamily:'var(--font-mono)',fontSize:10,
            padding:'4px 10px',borderRadius:3}}>
            {STATUS[selected.status]?.label}
          </span>
          <select
            value={selected.status}
            onChange={e=>setStatus(e.target.value)}
            style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--r)',
              fontFamily:'var(--font-mono)',fontSize:11,background:'var(--paper)'}}>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="completed">Abgeschlossen</option>
            <option value="cancelled">Storniert</option>
          </select>
          {selected.status !== 'completed' && selected.status !== 'cancelled' && (
            <button className="btn btn-primary btn-sm" onClick={complete} disabled={completing}>
              {completing ? '…' : '✓ Abschließen & Rechnung'}
            </button>
          )}
        </div>

        <div style={{marginBottom:16,display:'flex',gap:12}}>
          <div className="section" style={{flex:1,padding:0}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Kunde</div>
              <div style={{fontSize:13,fontWeight:600}}>
                {(typeof selected.customer==='string'?JSON.parse(selected.customer||'{}'):selected.customer)?.company || '—'}
              </div>
            </div>
          </div>
          <div className="section" style={{flex:1,padding:0}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Netto gesamt</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:18,fontWeight:500}}>{fmt(netTotal)} €</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header"><span className="section-title">Positionen</span></div>
          <table className="user-table">
            <thead>
              <tr><th>Pos.</th><th>Bezeichnung</th><th className="text-right">Menge</th><th className="text-right">Preis/Einh</th><th className="text-right">Gesamt</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((row,i) => {
                const total = row.type==='item'&&row.qty&&row.price ? Number(row.qty)*Number(row.price) : null
                if (row.type==='category') return (
                  <tr key={row.id} style={{background:'var(--paper2)'}}>
                    <td colSpan={6} style={{fontWeight:700,fontSize:13,padding:'8px 16px'}}>{row.description}</td>
                  </tr>
                )
                return (
                  <tr key={row.id}>
                    <td className="mono-small">{i+1}</td>
                    <td>
                      <div style={{fontWeight:600,fontSize:13}}>{row.description}</div>
                      {row.note && <div style={{fontSize:11,color:'var(--ink3)'}}>{row.note}</div>}
                    </td>
                    <td>
                      {total !== null && (
                        <input type="number" value={row.qty}
                          onChange={e=>updateRow(row.id,'qty',e.target.value)}
                          style={{width:70,textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,
                            border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'4px 6px',background:'var(--paper)'}}/>
                      )}
                    </td>
                    <td>
                      {total !== null && (
                        <input type="number" step="0.01" value={row.price}
                          onChange={e=>updateRow(row.id,'price',e.target.value)}
                          style={{width:90,textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,
                            border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'4px 6px',background:'var(--paper)'}}/>
                      )}
                    </td>
                    <td className="mono-small" style={{textAlign:'right',fontWeight:500}}>
                      {total !== null ? fmt(total)+' €' : '—'}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={()=>deleteRow(row.id)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{display:'flex',justifyContent:'flex-end',padding:'14px 16px',borderTop:'1px solid var(--border)'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:600}}>
              Netto gesamt: {fmt(netTotal)} €
            </div>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ── List ─────────────────────────────────────────────────────
  return (
    <div>
      <div className="section">
        <div className="section-header"><span className="section-title">Aufträge</span></div>
        <table className="user-table">
          <thead>
            <tr><th>Auftrags-Nr.</th><th>Kunde</th><th>Status</th><th>Erstellt</th><th className="text-right">Netto</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const rows = Array.isArray(o.rows) ? o.rows : JSON.parse(o.rows||'[]')
              const net = rows.reduce((s,r)=>r.type==='item'&&r.qty&&r.price?s+Number(r.qty)*Number(r.price):s,0)
              return (
                <tr key={o.id} style={{cursor:'pointer'}} onClick={()=>openOrder(o.id)}>
                  <td><strong style={{fontFamily:'var(--font-mono)',fontSize:12}}>{o.order_number}</strong></td>
                  <td>{o.customer_name||'—'}</td>
                  <td>
                    <span style={{...STATUS[o.status],fontFamily:'var(--font-mono)',fontSize:10,padding:'3px 8px',borderRadius:3}}>
                      {STATUS[o.status]?.label}
                    </span>
                  </td>
                  <td className="mono-small">{new Date(o.created_at).toLocaleDateString('de-DE')}</td>
                  <td className="mono-small" style={{textAlign:'right'}}>{fmt(net)} €</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();openOrder(o.id)}}>Öffnen</button></td>
                </tr>
              )
            })}
            {orders.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:28,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Aufträge</td></tr>}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
