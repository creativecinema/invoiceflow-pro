import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})

const STATUS = {
  open:      { label:'Offen',     color:'#2a4a8a', bg:'#e8eef8' },
  paid:      { label:'Bezahlt',   color:'#2a7a2a', bg:'#e8f4e8' },
  overdue:   { label:'Überfällig',color:'#8a2a2a', bg:'#f4e8e8' },
  cancelled: { label:'Storniert', color:'#6a6a6a', bg:'#f0f0f0' },
}

export default function Invoices() {
  const { apiFetch } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [selected, setSelected] = useState(null)
  const [settings, setSettings] = useState({})
  const [toast, setToast] = useState('')

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    apiFetch('/invoices').then(r=>r?.ok&&r.json()).then(d=>d&&setInvoices(d))
    apiFetch('/settings').then(r=>r?.ok&&r.json()).then(d=>d&&setSettings(d))
  }, [])

  const markPaid = async (id) => {
    const r = await apiFetch(`/invoices/${id}/status`, {
      method:'PUT', body:JSON.stringify({ status:'paid' })
    })
    if (r?.ok) {
      setInvoices(inv => inv.map(i => i.id===id ? {...i,status:'paid'} : i))
      if (selected?.id===id) setSelected(s=>({...s,status:'paid'}))
      showToast('✓ Als bezahlt markiert')
    }
  }

  const markCancelled = async (id) => {
    if (!confirm('Rechnung stornieren?')) return
    const r = await apiFetch(`/invoices/${id}/status`, {
      method:'PUT', body:JSON.stringify({ status:'cancelled' })
    })
    if (r?.ok) {
      setInvoices(inv => inv.map(i => i.id===id ? {...i,status:'cancelled'} : i))
      showToast('✓ Storniert')
    }
  }

  // ── Invoice detail / print view ────────────────────────────
  if (selected) {
    const rows = Array.isArray(selected.rows) ? selected.rows : JSON.parse(selected.rows||'[]')
    const customer = typeof selected.customer==='string' ? JSON.parse(selected.customer||'{}') : (selected.customer||{})
    const meta = typeof selected.meta==='string' ? JSON.parse(selected.meta||'{}') : (selected.meta||{})
    const s = settings
    let posN = 0

    return (
      <div>
        <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setSelected(null)}>← Zurück</button>
          <span style={{flex:1}}/>
          {selected.status==='open' && (
            <button className="btn btn-primary btn-sm" onClick={()=>markPaid(selected.id)}>
              ✓ Als bezahlt markieren
            </button>
          )}
          {selected.status!=='cancelled' && selected.status!=='paid' && (
            <button className="btn btn-danger btn-sm" onClick={()=>markCancelled(selected.id)}>
              Stornieren
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={()=>window.print()}>
            🖨 Drucken / PDF
          </button>
        </div>

        {/* German-compliant invoice layout */}
        <div className="preview-page invoice-page" id="invoice-print">
          {/* Logo / Header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32}}>
            <div>
              {s.logo_data && s.logo_data.length>20
                ? <img src={s.logo_data} alt="Logo" style={{maxHeight:70,maxWidth:220,objectFit:'contain'}}/>
                : <div style={{fontFamily:'var(--font-display)',fontSize:22,letterSpacing:'0.2em',textTransform:'uppercase'}}>{s.company_name||'Firma'}</div>
              }
            </div>
            <div style={{textAlign:'right',fontSize:10,lineHeight:1.8,color:'#555'}}>
              <div style={{fontWeight:600,color:'#222',fontSize:12}}>{s.company_name}</div>
              <div>{s.company_street}</div>
              <div>{s.company_city}</div>
              <div>{s.company_phone}</div>
              <div>{s.company_email}</div>
            </div>
          </div>

          {/* Addresses */}
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:28,fontSize:10}}>
            <div style={{lineHeight:1.8}}>
              <div style={{fontSize:8,color:'#999',marginBottom:4}}>{s.company_name} · {s.company_street} · {s.company_city}</div>
              <div style={{fontWeight:600,fontSize:12}}>{customer.company || [customer.salutation,customer.firstName,customer.lastName].filter(Boolean).join(' ')}</div>
              <div>{customer.street}</div>
              <div>{customer.zip} {customer.city}</div>
            </div>
            <div style={{textAlign:'right',lineHeight:1.8}}>
              <table style={{borderCollapse:'collapse',fontSize:10}}>
                <tbody>
                  <tr><td style={{color:'#777',paddingRight:12}}>Rechnungsnummer:</td><td style={{fontFamily:'monospace',fontWeight:600}}>{selected.invoice_number}</td></tr>
                  <tr><td style={{color:'#777',paddingRight:12}}>Rechnungsdatum:</td><td>{new Date(selected.created_at).toLocaleDateString('de-DE')}</td></tr>
                  <tr><td style={{color:'#777',paddingRight:12}}>Leistungsdatum:</td><td>{selected.performance_date ? new Date(selected.performance_date).toLocaleDateString('de-DE') : '—'}</td></tr>
                  <tr><td style={{color:'#777',paddingRight:12}}>Fälligkeitsdatum:</td><td style={{color: selected.status==='overdue'?'#c00':'inherit', fontWeight:600}}>
                    {selected.due_date ? new Date(selected.due_date).toLocaleDateString('de-DE') : '—'}
                  </td></tr>
                  {meta.handler && <tr><td style={{color:'#777',paddingRight:12}}>Bearbeiter:</td><td>{meta.handler}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Title */}
          <div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,marginBottom:20}}>
            Rechnung {selected.invoice_number}
          </div>

          {/* Status badge */}
          <div style={{marginBottom:16}}>
            <span style={{...STATUS[selected.status],fontFamily:'var(--font-mono)',fontSize:10,padding:'3px 10px',borderRadius:3}}>
              {STATUS[selected.status]?.label}
            </span>
          </div>

          {/* Positions table */}
          <table className="preview-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Bezeichnung</th>
                <th className="r">Menge</th>
                <th className="r">Einheit</th>
                <th className="r">Einzelpreis €</th>
                <th className="r">Gesamt €</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                if (row.type==='category') return (
                  <tr key={row.id} className="cat-row">
                    <td colSpan={6}><strong>{row.description}</strong></td>
                  </tr>
                )
                if (row.type!=='item') return null
                posN++
                const total = row.qty && row.price ? Number(row.qty)*Number(row.price) : 0
                return (
                  <tr key={row.id}>
                    <td>{posN}</td>
                    <td>
                      <strong>{row.description}</strong>
                      {row.note && <div style={{fontSize:9,color:'#666',marginTop:2}}>{row.note}</div>}
                    </td>
                    <td className="r">{row.qty}</td>
                    <td className="r" style={{fontSize:9}}>{row.unit||'Std.'}</td>
                    <td className="r">{fmt(row.price)}</td>
                    <td className="r"><strong>{fmt(total)}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totals — German §14 UStG compliant */}
          <div className="preview-totals">
            <table>
              <tbody>
                <tr><td>Nettobetrag</td><td className="r">{fmt(selected.net_total)} €</td></tr>
                <tr><td>zzgl. {selected.vat_rate}% Umsatzsteuer</td><td className="r">{fmt(selected.vat_amount)} €</td></tr>
                <tr className="grand"><td>Rechnungsbetrag (Brutto)</td><td className="r">{fmt(selected.gross_total)} €</td></tr>
              </tbody>
            </table>
          </div>

          {/* Payment info */}
          <div style={{marginTop:24,fontSize:10,lineHeight:1.8,color:'#444'}}>
            {s.payment_terms && <div style={{marginBottom:8}}>{s.payment_terms}</div>}
            <div>Bitte überweisen Sie den Betrag von <strong>{fmt(selected.gross_total)} €</strong> bis zum <strong>{selected.due_date ? new Date(selected.due_date).toLocaleDateString('de-DE') : '—'}</strong> auf folgendes Konto:</div>
          </div>

          {/* Bank details */}
          <div style={{marginTop:12,padding:'12px 16px',background:'#f8f5f0',borderRadius:'var(--r)',fontSize:10,lineHeight:1.8}}>
            <div><strong>{s.bank_name}</strong></div>
            <div>IBAN: <span style={{fontFamily:'monospace'}}>{s.bank_iban}</span></div>
            <div>BIC: <span style={{fontFamily:'monospace'}}>{s.bank_bic}</span></div>
            <div style={{marginTop:4,color:'#666'}}>Verwendungszweck: <strong>{selected.invoice_number}</strong></div>
          </div>

          {/* Legal footer §14 UStG */}
          <div className="preview-footer-grid" style={{marginTop:28}}>
            <div><strong>{s.company_name}</strong><br/>{s.company_street}<br/>{s.company_city}<br/>Geschäftsführer: {s.company_manager}</div>
            <div><strong>{s.bank_name}</strong><br/>IBAN: {s.bank_iban}<br/>BIC: {s.bank_bic}</div>
            <div><strong>{s.company_hrb}</strong><br/>UStID: {s.company_ustid}</div>
            <div><strong>Kontakt</strong><br/>{s.company_email}<br/>{s.company_phone}</div>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ── List ─────────────────────────────────────────────────────
  const totals = invoices.reduce((acc, i) => {
    if (i.status==='open')   acc.open   += Number(i.gross_total||0)
    if (i.status==='paid')   acc.paid   += Number(i.gross_total||0)
    if (i.status==='overdue') acc.overdue += Number(i.gross_total||0)
    return acc
  }, {open:0, paid:0, overdue:0})

  return (
    <div>
      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
        {[
          ['Offen', totals.open, '#e8eef8','#2a4a8a'],
          ['Bezahlt', totals.paid, '#e8f4e8','#2a7a2a'],
          ['Überfällig', totals.overdue, '#f4e8e8','#8a2a2a'],
        ].map(([label,val,bg,color])=>(
          <div key={label} className="section" style={{padding:0}}>
            <div style={{padding:'16px 20px',background:bg,borderRadius:'var(--r)'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>{label}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:20,fontWeight:500,color}}>{fmt(val)} €</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-header"><span className="section-title">Rechnungen</span></div>
        <table className="user-table">
          <thead>
            <tr><th>Rechnungs-Nr.</th><th>Kunde</th><th>Status</th><th>Erstellt</th><th>Fällig</th><th className="text-right">Brutto</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.map(inv=>(
              <tr key={inv.id} style={{cursor:'pointer'}} onClick={()=>setSelected(inv)}>
                <td><strong style={{fontFamily:'var(--font-mono)',fontSize:12}}>{inv.invoice_number}</strong></td>
                <td>{inv.customer_name||'—'}</td>
                <td>
                  <span style={{...STATUS[inv.status],fontFamily:'var(--font-mono)',fontSize:10,padding:'3px 8px',borderRadius:3}}>
                    {STATUS[inv.status]?.label}
                  </span>
                </td>
                <td className="mono-small">{new Date(inv.created_at).toLocaleDateString('de-DE')}</td>
                <td className="mono-small" style={{color:inv.status==='overdue'?'#c00':'inherit'}}>
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-DE') : '—'}
                </td>
                <td className="mono-small" style={{textAlign:'right',fontWeight:600}}>{fmt(inv.gross_total)} €</td>
                <td onClick={e=>e.stopPropagation()} style={{display:'flex',gap:4}}>
                  {inv.status==='open' && (
                    <button className="btn btn-primary btn-sm" onClick={()=>markPaid(inv.id)}>Bezahlt</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(inv)}>Öffnen</button>
                </td>
              </tr>
            ))}
            {invoices.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:28,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Rechnungen</td></tr>}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
