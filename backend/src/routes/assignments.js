const router = require('express').Router();
const { pool } = require('../db');
const { auth, role, ah } = require('../middleware/auth');
router.use(auth, role('STUDENT'));

const groupOf = async (uid) =>
  (await pool.query('SELECT group_id FROM group_members WHERE user_id=$1', [uid])).rows[0]?.group_id ?? null;

router.get('/', ah(async (req, res) => {
  const gid = await groupOf(req.user.id);
  const { rows } = await pool.query(
    `SELECT a.id,a.title,a.description,a.due_date,a.onedrive_link,
       s.confirmed_at, cu.name AS confirmed_by, (s.id IS NOT NULL) AS confirmed
     FROM assignments a
     LEFT JOIN submissions s ON s.assignment_id=a.id AND s.group_id=$1::int
     LEFT JOIN users cu ON cu.id=s.confirmed_by
     WHERE a.assign_to_all OR EXISTS
       (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id=a.id AND ag.group_id=$1::int)
     ORDER BY a.due_date`, [gid]);
  res.json({ assignments: rows, hasGroup: gid !== null });
}));

router.post('/:id/confirm', ah(async (req, res) => {
  if (req.body.confirm !== true) return res.status(400).json({ error: 'Confirmation step missing' });
  const gid = await groupOf(req.user.id);
  if (!gid) return res.status(403).json({ error: 'Join or create a group before confirming' });
  const ok = await pool.query(
    `SELECT 1 FROM assignments a WHERE a.id=$1 AND (a.assign_to_all OR EXISTS
      (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id=a.id AND ag.group_id=$2))`, [req.params.id, gid]);
  if (!ok.rows.length) return res.status(404).json({ error: 'Assignment not assigned to your group' });
  try {
    await pool.query('INSERT INTO submissions (assignment_id,group_id,confirmed_by) VALUES ($1,$2,$3)',
      [req.params.id, gid, req.user.id]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Your group already confirmed this assignment' });
    throw e;
  }
  res.status(201).json({ ok: true });
}));

module.exports = router;
