import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); else localStorage.removeItem('token') })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Login fehlgeschlagen')
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => { localStorage.removeItem('token'); setUser(null) }

  const apiFetch = async (path, opts = {}) => {
    const token = localStorage.getItem('token')
    const r = await fetch(`/api${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...opts.headers,
      },
    })
    if (r.status === 401) { logout(); return null }
    return r
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, apiFetch,
      isManagement:      user?.role === 'geschaeftsfuehrung',
      isProducerOrAbove: ['producer','geschaeftsfuehrung'].includes(user?.role),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export const ROLE_LABELS = {
  mitarbeiter:        'Mitarbeiter',
  producer:           'Producer',
  geschaeftsfuehrung: 'Geschäftsführung',
}
