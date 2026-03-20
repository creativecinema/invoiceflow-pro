import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const fmt = (n) => Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function CustomerStats() {
  const { apiFetch } = useAuth()
  const [stats, setStats] = useState([])
  const [sort, setSort]   = useState('revenue_net')

  useEffect(() => {
    apiFetch('/stats/customers').then(r => r?.ok && r.json()).then(d => d && setStats(d))
  }, [])

  const sorted = [...stats].sort((a,b) => Number(b[sort]||0) - Number(a[sort]||0))
  const totalRevenue = stats.reduce((s,c)=>s+Number(c.revenue_net||0),0)
  const totalQuoted  = stats.reduce((s,c)=>s+Number(c.total_quoted||0),0)
  const totalQuotes  = stats.reduce((s,c)=>s+Number(c.quote_count||0),0)

  const SortBtn = ({col,label}) => (
    <span onClick={()=>setSort(col)} style={{cursor:'pointer',color:sort===col?'var(--accent)':'inherit',userSelect:'none'}}>
      {label}{sort===col?' ↓':''}
    </span>
  )

  return (
    <div>
      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
        {[
          ['Gesamtumsatz netto', fmt(totalRevenue)+' €','(bestätigte Angebote)'],
          ['Gesamtvolumen', fmt(totalQuoted)+' €','(alle Angebote)'],
          ['Angebote gesamt', totalQuotes,''],
        ].map(([label,val,sub])=>(
          <div key={label} className="section" style={{padding:0}}>
            <div style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>{label}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:22,color:'var(--ink)',fontWeight:500}}>{val}</div>
              {sub&&<div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',marginTop:4}}>{sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-header"><span className="section-title">Kundenauswertung</span></div>
        <table className="user-table">
          <thead>
            <tr>
              <th>Kunde</th>
              <th className="text-right"><SortBtn col="quote_count" label="Angebote" /></th>
              <th className="text-right"><SortBtn col="accepted_count" label="Bestellt" /></th>
              <th className="text-right"><SortBtn col="rejected_count" label="Abgelehnt" /></th>
              <th className="text-right"><SortBtn col="total_quoted" label="Gesamtvolumen" /></th>
              <th className="text-right"><SortBtn col="revenue_net" label="Umsatz netto" /></th>
              <th className="text-right">Quote-Rate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const rate = c.quote_count > 0 ? Math.round((c.accepted_count/c.quote_count)*100) : 0
              return (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.customer_number&&<span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink3)',marginLeft:8}}>{c.customer_number}</span>}
                  </td>
                  <td className="mono-small" style={{textAlign:'right'}}>{c.quote_count}</td>
                  <td className="mono-small" style={{textAlign:'right',color:'#2a7a2a'}}>{c.accepted_count}</td>
                  <td className="mono-small" style={{textAlign:'right',color:'var(--accent)'}}>{c.rejected_count}</td>
                  <td className="mono-small" style={{textAlign:'right'}}>{fmt(c.total_quoted)} €</td>
                  <td className="mono-small" style={{textAlign:'right',fontWeight:600,color:'var(--ink)'}}>{fmt(c.revenue_net)} €</td>
                  <td style={{textAlign:'right'}}>
                    <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
                      <div style={{width:60,height:6,background:'var(--paper2)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:rate+'%',height:'100%',background:rate>60?'#2a7a2a':rate>30?'var(--accent2)':'var(--accent)',borderRadius:3}}/>
                      </div>
                      <span className="mono-small">{rate}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {sorted.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:24,color:'var(--ink3)',fontFamily:'var(--font-mono)',fontSize:12}}>Keine Daten</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
