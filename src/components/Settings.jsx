import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { id: 'look',    label: 'Look & Feel' },
  { id: 'bank',    label: 'Bankdaten' },
  { id: 'payment', label: 'Zahlungsbedingungen' },
  { id: 'methods', label: 'Zahlungsarten' },
  { id: 'company', label: 'Unternehmen' },
]

export default function Settings({ onClose }) {
  const { apiFetch } = useAuth()
  const [settings, setSettings] = useState({})
  const [tab, setTab]           = useState('look')
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast]       = useState('')
  const fileRef = useRef()

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const loadSettings = async () => {
    const r = await apiFetch('/settings')
    if (r?.ok) {
      const d = await r.json()
      setSettings(d)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const setKey = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  // Save all settings EXCEPT logo_data (logo has its own endpoint)
  const save = async () => {
    setSaving(true)
    const { logo_data, ...rest } = settings
    const r = await apiFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(rest),
    })
    setSaving(false)
    if (r?.ok) showToast('✓ Einstellungen gespeichert')
    else showToast('Fehler beim Speichern')
  }

  const uploadLogo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2_000_000) { showToast('Bild zu groß (max 2 MB)'); return }

    setUploading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const data = ev.target.result
      try {
        const r = await apiFetch('/settings/logo', {
          method: 'POST',
          body: JSON.stringify({ data }),
        })
        if (r?.ok) {
          // Update local state so "Speichern" won't overwrite the logo
          setSettings(s => ({ ...s, logo_data: data }))
          showToast('✓ Logo gespeichert')
        } else {
          const err = await r.json().catch(() => ({}))
          showToast('Fehler: ' + (err.error || r.status))
        }
      } catch(e) {
        showToast('Upload-Fehler: ' + e.message)
      } finally {
        setUploading(false)
      }
    }
    reader.onerror = () => { showToast('Datei konnte nicht gelesen werden'); setUploading(false) }
    reader.readAsDataURL(file)
    // Reset file input so same file can be re-selected
    e.target.value = ''
  }

  const deleteLogo = async () => {
    const r = await apiFetch('/settings/logo', { method: 'DELETE' })
    if (r?.ok) {
      setSettings(s => ({ ...s, logo_data: '' }))
      showToast('✓ Logo entfernt')
    }
  }

  const logoPreview = settings.logo_data && settings.logo_data.length > 20 ? settings.logo_data : null

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal">
        <div className="modal-header">
          <span className="section-title">Einstellungen</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', padding:'0 24px', overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'10px 16px', background:'transparent', border:'none', cursor:'pointer',
              fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.05em', whiteSpace:'nowrap',
              color: tab===t.id ? 'var(--accent)' : 'var(--ink3)',
              borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight:'60vh', overflowY:'auto' }}>

          {/* ── Look & Feel ── */}
          {tab === 'look' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
                  Firmen-Logo für Angebote
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  {/* Preview box */}
                  <div style={{
                    width:200, height:90, border:'2px dashed var(--border)', borderRadius:'var(--r)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--paper)', overflow:'hidden', flexShrink:0,
                  }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo"
                          style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                      : <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink3)', textAlign:'center', padding:8 }}>
                          Noch kein Logo<br/>hochgeladen
                        </span>
                    }
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileRef.current.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Wird hochgeladen…' : logoPreview ? 'Logo ersetzen' : 'Logo hochladen'}
                    </button>
                    {logoPreview && (
                      <button className="btn btn-danger btn-sm" onClick={deleteLogo}>
                        Logo entfernen
                      </button>
                    )}
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink3)', lineHeight:1.5 }}>
                      PNG, JPG oder SVG<br/>
                      Max. 2 MB · Empfohlen:<br/>
                      400 × 120 px
                    </span>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/gif"
                  style={{ display:'none' }} onChange={uploadLogo} />
              </div>

              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Angebot — Texte</div>
                <div className="field"><label>Anschreiben / Grußformel</label>
                  <textarea rows={4} value={settings.quote_greeting||''} onChange={e=>setKey('quote_greeting',e.target.value)} /></div>
                <div className="field"><label>Disclaimer / Hinweistext</label>
                  <textarea rows={3} value={settings.quote_disclaimer||''} onChange={e=>setKey('quote_disclaimer',e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* ── Bankdaten ── */}
          {tab === 'bank' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Hauptkonto</div>
                <div className="grid-2">
                  <div className="field"><label>Bank</label>
                    <input value={settings.bank_name||''} onChange={e=>setKey('bank_name',e.target.value)} /></div>
                  <div className="field"><label>IBAN</label>
                    <input value={settings.bank_iban||''} onChange={e=>setKey('bank_iban',e.target.value)} /></div>
                  <div className="field"><label>BIC</label>
                    <input value={settings.bank_bic||''} onChange={e=>setKey('bank_bic',e.target.value)} /></div>
                </div>
              </div>
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Zweites Konto (optional)</div>
                <div className="grid-2">
                  <div className="field"><label>Bank</label>
                    <input value={settings.bank_name_2||''} onChange={e=>setKey('bank_name_2',e.target.value)} /></div>
                  <div className="field"><label>IBAN</label>
                    <input value={settings.bank_iban_2||''} onChange={e=>setKey('bank_iban_2',e.target.value)} /></div>
                  <div className="field"><label>BIC</label>
                    <input value={settings.bank_bic_2||''} onChange={e=>setKey('bank_bic_2',e.target.value)} /></div>
                </div>
              </div>
            </div>
          )}

          {/* ── Zahlungsbedingungen ── */}
          {tab === 'payment' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#fef8e8', border:'1px solid #e8d878', borderRadius:'var(--r)', padding:'10px 14px', fontFamily:'var(--font-mono)', fontSize:11, color:'#7a6a1a' }}>
                Standard für alle Angebote. Kundenindividuelle Einstellungen haben Vorrang.
              </div>
              <div className="field"><label>Zahlungsbedingungen</label>
                <textarea rows={4} value={settings.payment_terms||''} onChange={e=>setKey('payment_terms',e.target.value)}
                  placeholder="z.B. Zahlbar sofort nach Rechnungseingang ohne Abzug." /></div>
              <div className="grid-2">
                <div className="field"><label>Anzahlung (%)</label>
                  <input type="number" value={settings.deposit_percent||'20'} onChange={e=>setKey('deposit_percent',e.target.value)} /></div>
                <div className="field"><label>Zahlungsfrist (Tage)</label>
                  <input type="number" value={settings.deposit_days||'7'} onChange={e=>setKey('deposit_days',e.target.value)} /></div>
                <div className="field"><label>MwSt. (%)</label>
                  <input type="number" value={settings.vat_rate||'19'} onChange={e=>setKey('vat_rate',e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* ── Zahlungsarten ── */}
          {tab === 'methods' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#fef8e8', border:'1px solid #e8d878', borderRadius:'var(--r)', padding:'10px 14px', fontFamily:'var(--font-mono)', fontSize:11, color:'#7a6a1a' }}>
                Standard-Zahlungsarten. Kundenindividuelle Einstellungen haben Vorrang.
              </div>
              <div className="field"><label>Akzeptierte Zahlungsarten</label>
                <textarea rows={4} value={settings.payment_methods||''} onChange={e=>setKey('payment_methods',e.target.value)}
                  placeholder="z.B. Banküberweisung, SEPA-Lastschrift, Vorkasse" /></div>
            </div>
          )}

          {/* ── Unternehmen ── */}
          {tab === 'company' && (
            <div className="grid-2">
              <div className="field" style={{ gridColumn:'1/-1' }}><label>Firmenname</label>
                <input value={settings.company_name||''} onChange={e=>setKey('company_name',e.target.value)} /></div>
              <div className="field"><label>Straße</label>
                <input value={settings.company_street||''} onChange={e=>setKey('company_street',e.target.value)} /></div>
              <div className="field"><label>PLZ / Ort</label>
                <input value={settings.company_city||''} onChange={e=>setKey('company_city',e.target.value)} /></div>
              <div className="field"><label>Telefon</label>
                <input value={settings.company_phone||''} onChange={e=>setKey('company_phone',e.target.value)} /></div>
              <div className="field"><label>E-Mail</label>
                <input value={settings.company_email||''} onChange={e=>setKey('company_email',e.target.value)} /></div>
              <div className="field"><label>Geschäftsführer</label>
                <input value={settings.company_manager||''} onChange={e=>setKey('company_manager',e.target.value)} /></div>
              <div className="field"><label>UStID</label>
                <input value={settings.company_ustid||''} onChange={e=>setKey('company_ustid',e.target.value)} /></div>
              <div className="field"><label>Handelsregister</label>
                <input value={settings.company_hrb||''} onChange={e=>setKey('company_hrb',e.target.value)} /></div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
