const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'invoiceflow-change-in-production'

const sign = (payload) => jwt.sign(payload, SECRET, { expiresIn: '8h' })

const verify = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Nicht eingeloggt' })
  try {
    req.user = jwt.verify(header.slice(7), SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' })
  }
}

const requireManagement = (req, res, next) => {
  if (req.user?.role !== 'geschaeftsfuehrung')
    return res.status(403).json({ error: 'Keine Berechtigung' })
  next()
}

module.exports = { sign, verify, requireManagement }
