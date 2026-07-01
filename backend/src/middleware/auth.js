const jwt = require('jsonwebtoken');
const { queryOne } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
  queryOne('SELECT token_version FROM users WHERE id = $1 AND is_active = 1', [req.user.id])
    .then((user) => {
      if (!user || (user.token_version || 0) !== (req.user.token_version || 0)) {
        return res.status(403).json({ error: 'Session expired. Please login again.' });
      }
      next();
    })
    .catch(() => {
      return res.status(500).json({ error: 'Server error.' });
    });
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(403).json({ error: 'Insufficient permissions.' });
    if (req.user.role === 'super_admin') return next();
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
    next();
  };
}

module.exports = { authenticate, authorize };
