const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });

async function init() {
  for (let i = 0; i < 20; i++) {           // wait for Postgres in Docker
    try { await pool.query('SELECT 1'); break; }
    catch (e) { if (i === 19) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await seed();
}

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'prof@joineazy.test';
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
  await pool.query(
    `INSERT INTO users (name,email,password_hash,role) VALUES ('Prof. Demo',$1,$2,'ADMIN') ON CONFLICT (email) DO NOTHING`,
    [email, hash]);
  if (process.env.SEED_DEMO === 'false') return;
  const sh = await bcrypt.hash('Student@123', 10);
  for (const n of ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Sara']) {
    await pool.query(
      `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'STUDENT') ON CONFLICT (email) DO NOTHING`,
      [n, `${n.toLowerCase()}@student.test`, sh]);
  }
}

module.exports = { pool, init };
