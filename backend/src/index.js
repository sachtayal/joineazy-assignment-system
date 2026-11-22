require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { init } = require('./db');

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is required'); process.exit(1); }
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

const port = process.env.PORT || 5000;
init().then(() => app.listen(port, () => console.log(`API on :${port}`)))
      .catch((e) => { console.error('DB init failed', e); process.exit(1); });
