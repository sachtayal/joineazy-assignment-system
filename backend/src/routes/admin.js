const router = require('express').Router();
const { pool } = require('../db');
const { auth, role, ah } = require('../middleware/auth');
router.use(auth, role('ADMIN'));

function validate(b) {
  if (!b.title?.trim()) return 'Title is required';
  if (!b.due_date || isNaN(new Date(b.due_date))) return 'A valid due date is required';
  if (!/^https?:\/\//i.test(b.onedrive_link || '')) return 'OneDrive link must start with http(s)://';
  if (b.assign_to_all === false && !(b.group_ids || []).length) return 'Pick at least one group';
  return null;
}

async function save(id, b, userId) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const vals = [b.title.trim(), b.description || '', b.due_date, b.onedrive_link, b.assign_to_all !== false];
    let aid = id;
    if (id) {
      const r = await c.query(
        'UPDATE assignments SET title=$1,description=$2,due_date=$3,onedrive_link=$4,assign_to_all=$5 WHERE id=$6 RETURNING id',
        [...vals, id]);
      if (!r.rows[0]) { await c.query('ROLLBACK'); return null; }
    } else {
      aid = (await c.query(
        'INSERT INTO assignments (title,description,due_date,onedrive_link,assign_to_all,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [...vals, userId])).rows[0].id;
    }
    await c.query('DELETE FROM assignment_groups WHERE assignment_id=$1', [aid]);
    if (b.assign_to_all === false)
      for (const g of b.group_ids) await c.query('INSERT INTO assignment_groups VALUES ($1,$2) ON CONFLICT DO NOTHING', [aid, g]);
    await c.query('COMMIT');
    return aid;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

const one = (id) => pool.query(
  `SELECT a.*, COALESCE((SELECT array_agg(group_id) FROM assignment_groups WHERE assignment_id=a.id),'{}') AS group_ids
   FROM assignments a WHERE a.id=$1`, [id]);

router.get('/assignments', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, COALESCE((SELECT array_agg(group_id) FROM assignment_groups WHERE assignment_id=a.id),'{}') AS group_ids
     FROM assignments a ORDER BY a.due_date`);
  res.json({ assignments: rows });
}));

router.post('/assignments', ah(async (req, res) => {
  const err = validate(req.body); if (err) return res.status(400).json({ error: err });
  const id = await save(null, req.body, req.user.id);
  res.status(201).json({ assignment: (await one(id)).rows[0] });
}));

router.put('/assignments/:id', ah(async (req, res) => {
  const err = validate(req.body); if (err) return res.status(400).json({ error: err });
  const id = await save(+req.params.id, req.body, req.user.id);
  if (!id) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ assignment: (await one(id)).rows[0] });
}));

router.get('/groups', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT id,name FROM groups ORDER BY name');
  res.json({ groups: rows });
}));

router.get('/assignments/:id/status', ah(async (req, res) => {
  const a = (await one(req.params.id)).rows[0];
  if (!a) return res.status(404).json({ error: 'Assignment not found' });
  const { rows } = await pool.query(
    `SELECT g.id, g.name, s.confirmed_at, cu.name AS confirmed_by, (s.id IS NOT NULL) AS confirmed,
       COALESCE((SELECT json_agg(json_build_object('id',m.id,'name',m.name,'email',m.email) ORDER BY m.name)
         FROM group_members gm JOIN users m ON m.id=gm.user_id WHERE gm.group_id=g.id),'[]') AS members
     FROM groups g
     LEFT JOIN submissions s ON s.group_id=g.id AND s.assignment_id=$1
     LEFT JOIN users cu ON cu.id=s.confirmed_by
     WHERE $2::boolean OR g.id IN (SELECT group_id FROM assignment_groups WHERE assignment_id=$1)
     ORDER BY g.name`, [a.id, a.assign_to_all]);
  res.json({ assignment: a, groups: rows });
}));

router.get('/analytics', ah(async (req, res) => {
  const per = await pool.query(
    `SELECT a.id,a.title,a.due_date,
       (CASE WHEN a.assign_to_all THEN (SELECT count(*) FROM groups)
             ELSE (SELECT count(*) FROM assignment_groups ag WHERE ag.assignment_id=a.id) END)::int AS total_groups,
       (SELECT count(*) FROM submissions s WHERE s.assignment_id=a.id)::int AS confirmed_groups
     FROM assignments a ORDER BY a.due_date`);
  const groups = await pool.query(
    `SELECT g.id,g.name,
       (SELECT count(*) FROM assignments a WHERE a.assign_to_all OR EXISTS
         (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id=a.id AND ag.group_id=g.id))::int AS total,
       (SELECT count(*) FROM submissions s WHERE s.group_id=g.id)::int AS confirmed
     FROM groups g ORDER BY g.name`);
  const t = await pool.query(
    `SELECT (SELECT count(*) FROM users WHERE role='STUDENT')::int AS students,
            (SELECT count(*) FROM groups)::int AS groups,
            (SELECT count(*) FROM assignments)::int AS assignments,
            (SELECT count(*) FROM users u WHERE role='STUDENT' AND NOT EXISTS
              (SELECT 1 FROM group_members gm WHERE gm.user_id=u.id))::int AS ungrouped`);
  res.json({ totals: t.rows[0], perAssignment: per.rows, perGroup: groups.rows });
}));

module.exports = router;
