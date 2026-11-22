const jwt = require('jsonwebtoken');
exports.auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
};
exports.role = (r) => (req, res, next) =>
  req.user.role === r ? next() : res.status(403).json({ error: 'Forbidden for your role' });
exports.ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);
