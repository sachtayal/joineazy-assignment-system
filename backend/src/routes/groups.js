const router = require('express').Router();
const { pool } = require('../db');
const { auth, role, ah } = require('../middleware/auth');
router.use(auth, role('STUDENT'));

async function loadGroup(userId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.created_by FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user_id=$1`, [userId]);
  if (!rows[0]) return null;
  const g = rows[0];
  const m = await pool.query(
    `SELECT u.id,u.name,u.email FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 ORDER BY gm.joined_at`, [g.id]);
  const p = await pool.query(
    `SELECT
      (SELECT count(*) FROM assignments a WHERE a.assign_to_all OR EXISTS
        (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id=a.id AND ag.group_id=$1))::int AS total,
      (SELECT count(*) FROM submissions s WHERE s.group_id=$1)::int AS confirmed`, [g.id]);
  return { ...g, members: m.rows, progress: p.rows[0] };
}

router.get('/mine', ah(async (req, res) => res.json({ group: await loadGroup(req.user.id) })));

router.post('/', ah(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  if (await loadGroup(req.user.id)) return res.status(409).json({ error: 'You are already in a group' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const g = await c.query('INSERT INTO groups (name,created_by) VALUES ($1,$2) RETURNING id', [name, req.user.id]);
    await c.query('INSERT INTO group_members (group_id,user_id) VALUES ($1,$2)', [g.rows[0].id, req.user.id]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  res.status(201).json({ group: await loadGroup(req.user.id) });
}));

router.post('/:id/members', ah(async (req, res) => {
  const mine = await loadGroup(req.user.id);
  if (!mine || mine.id !== +req.params.id) return res.status(403).json({ error: 'You are not a member of this group' });
  const idf = String(req.body.identifier || '').trim();
  if (!idf) return res.status(400).json({ error: 'Enter a student email or ID' });
  const { rows } = await pool.query(
    /^\d+$/.test(idf) ? 'SELECT * FROM users WHERE id=$1' : 'SELECT * FROM users WHERE email=lower($1)', [idf]);
  const u = rows[0];
  if (!u || u.role !== 'STUDENT') return res.status(404).json({ error: 'No student found with that email or ID' });
  try {
    await pool.query('INSERT INTO group_members (group_id,user_id) VALUES ($1,$2)', [mine.id, u.id]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `${u.name} is already in a group` });
    throw e;
  }
  res.status(201).json({ group: await loadGroup(req.user.id) });
}));

router.delete('/:id/members/:userId', ah(async (req, res) => {
  const mine = await loadGroup(req.user.id);
  if (!mine || mine.id !== +req.params.id) return res.status(403).json({ error: 'You are not a member of this group' });
  const target = +req.params.userId;
  if (target !== req.user.id && mine.created_by !== req.user.id)
    return res.status(403).json({ error: 'Only the group creator can remove other members' });
  await pool.query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2', [mine.id, target]);
  const left = await pool.query('SELECT 1 FROM group_members WHERE group_id=$1', [mine.id]);
  if (!left.rows.length) await pool.query('DELETE FROM groups WHERE id=$1', [mine.id]);
  res.json({ group: await loadGroup(req.user.id) });
}));

module.exports = router;
