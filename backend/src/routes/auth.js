const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { auth, ah } = require('../middleware/auth');

const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/register', ah(async (req, res) => {
  const { name, email, password, role, adminCode } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  let r = 'STUDENT';
  if (role === 'ADMIN') {
    if (!process.env.ADMIN_SIGNUP_CODE || adminCode !== process.env.ADMIN_SIGNUP_CODE)
      return res.status(403).json({ error: 'Invalid professor access code' });
    r = 'ADMIN';
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,lower($2),$3,$4) RETURNING *',
      [name.trim(), email.trim(), hash, r]);
    res.status(201).json({ token: sign(rows[0]), user: pub(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
}));

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=lower($1)', [email || '']);
  if (!rows[0] || !(await bcrypt.compare(password || '', rows[0].password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(rows[0]), user: pub(rows[0]) });
}));

router.get('/me', auth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'User no longer exists' });
  res.json({ user: pub(rows[0]) });
}));

module.exports = router;
