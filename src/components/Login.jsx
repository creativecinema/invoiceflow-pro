import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try { await login(email, password) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">CRE<span>A</span>TIVE<br/>CINE<span>M</span>A</div>
        <div className="login-sub">Angebotsverwaltung — Bitte einloggen</div>
        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="name@creativecinema.net" autoFocus required />
          </div>
          <div className="field">
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Wird eingeloggt…' : 'Einloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
