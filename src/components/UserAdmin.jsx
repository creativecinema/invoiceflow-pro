import { useState, useEffect } from 'react'
import { useAuth, ROLE_LABELS } from '../contexts/AuthContext'

const ROLE_COLORS = {
  mitarbeiter:        { bg: '#e8f0e8', color: '#2a6a2a' },
  producer:           { bg: '#e8ecf4', color: '#2a3a7a' },
  geschaeftsfuehrung: { bg: '#f4e8e4', color: '#7a2a1a' },
}
const EMPTY = { name: '', email: '', password: '', role: 'mitarbeiter' }

export default function UserAdmin() {
  const { apiFetch, user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [form, setForm]   = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = async () => {
    const r = await apiFetch('/users')
    if (r?.ok) setUsers(await r.json())
  }
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  const save = async () => {
    setError('')
    const isNew = !form.id
    const r = await apiFetch(isNew ? '/users' : `/users/${form.id}`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(form),
    })
    const data = await r.json()
    if (!r.ok) { setError(data.error); return }
    setForm(null); load()
    showToast(isNew ? '✓ Nutzer angelegt' : '✓ Gespeichert')
  }

  const deactivate = async (u) => {
    if (!confirm(`${u.name} deaktivieren?`)) return
    await apiFetch(`/users/${u.id}`, { method: 'DELETE' })
    load(); showToast('✓ Deaktiviert')
  }

  const reactivate = async (u) => {
    await apiFetch(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ active: true }) })
    load(); showToast('✓ Reaktiviert')
  }

  return (
    <div>
      <div className="section">
        <div className="section-header">
          <span className="section-title">Nutzerverwaltung</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({...EMPTY}); setError('') }}>
            + Neuer Nutzer
          </button>
        </div>
        <table className="user-table">
          <thead>
            <tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Erstellt</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.active ? 'row-inactive' : ''}>
                <td>
                  <strong>{u.name}</strong>
                  {u.id === me.id && <span className="badge-you">ich</span>}
                </td>
                <td className="mono-small">{u.email}</td>
                <td>
                  <span className="role-badge" style={ROLE_COLORS[u.role]}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td>
                  <span className={`status-pill ${u.active ? 'status-active' : 'status-inactive'}`}>
                    {u.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="mono-small">{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                <td className="user-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setForm({...u, password:''}); setError('') }}>
                    Bearbeiten
                  </button>
                  {u.id !== me.id && (
                    u.active
                      ? <button className="btn btn-danger btn-sm" onClick={() => deactivate(u)}>Deaktivieren</button>
                      : <button className="btn btn-ghost btn-sm" onClick={() => reactivate(u)}>Reaktivieren</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setForm(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="section-title">{form.id ? 'Nutzer bearbeiten' : 'Neuer Nutzer'}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setForm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="field"><label>Name</label>
                  <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Vorname Nachname" /></div>
                <div className="field"><label>E-Mail</label>
                  <input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field">
                  <label>{form.id ? 'Neues Passwort (leer = unverändert)' : 'Passwort'}</label>
                  <input type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder={form.id ? 'Leer lassen…' : 'Passwort'} /></div>
                <div className="field"><label>Rolle</label>
                  <select value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                    <option value="mitarbeiter">Mitarbeiter</option>
                    <option value="producer">Producer</option>
                    <option value="geschaeftsfuehrung">Geschäftsführung</option>
                  </select></div>
              </div>
              {error && <div className="login-error" style={{marginTop:12}}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={save}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
