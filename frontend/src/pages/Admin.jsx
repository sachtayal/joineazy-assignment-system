import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Badge, ErrorMsg, Progress, fmt } from '../components.jsx';

const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const blank = { title: '', description: '', due_date: '', onedrive_link: '', assign_to_all: true, group_ids: [] };

export default function Admin() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(null); // null | blank | existing (with id)
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, a, g] = await Promise.all([api('/admin/analytics'), api('/admin/assignments'), api('/admin/groups')]);
    setStats(s); setAssignments(a.assignments); setGroups(g.groups);
  }, []);
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);

  
  async function save(e) {
    e.preventDefault();
    if (saving) return;

    setErr('');
    setSaving(true);

    try {
      const body = {
        ...form,
        due_date: new Date(form.due_date).toISOString()
      };

      await api(
        form.id ? `/admin/assignments/${form.id}` : '/admin/assignments',
        {
          method: form.id ? 'PUT' : 'POST',
          body
        }
      );

      setForm(null);
      await load();
    } catch (x) {
      setErr(x.message || 'Unable to save assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function openStatus(id) {
    setErr('');
    try { setStatus(await api(`/admin/assignments/${id}/status`)); } catch (x) { setErr(x.message); }
  }
  const toggleGroup = (id) => setForm({ ...form, group_ids: form.group_ids.includes(id) ? form.group_ids.filter((x) => x !== id) : [...form.group_ids, id] });

  const tabs = [['overview', 'Overview'], ['assignments', 'Assignments']];
  const sumConf = stats?.perAssignment.reduce((s, a) => s + a.confirmed_groups, 0) ?? 0;
  const sumTot = stats?.perAssignment.reduce((s, a) => s + a.total_groups, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Professor dashboard <span className="text-base font-medium text-ink/60">{user.name}</span></h1>
        <button className="btn-ghost" onClick={logout}>Log out</button>
      </header>
      <nav className="mb-6 flex gap-2" aria-label="Sections">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setStatus(null); }} className={`rounded-md px-4 py-2 text-sm font-bold ${tab === k ? 'bg-ink text-white' : 'bg-white ring-1 ring-ink/15'}`}>{l}</button>
        ))}
      </nav>
      <ErrorMsg msg={err} />

      {tab === 'overview' && stats && (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[['Assignments', stats.totals.assignments], ['Groups', stats.totals.groups], ['Students', stats.totals.students], ['Not in a group', stats.totals.ungrouped]].map(([l, v]) => (
              <div key={l} className="panel"><p className="text-3xl font-extrabold">{v}</p><p className="text-sm text-ink/70">{l}</p></div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="panel">
              <h2 className="mb-3 font-extrabold">Confirmations per assignment</h2>
              {stats.perAssignment.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.perAssignment}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="title" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} />
                    <Tooltip /><Legend />
                    <Bar dataKey="confirmed_groups" name="Groups confirmed" fill="#0E7C7B" />
                    <Bar dataKey="total_groups" name="Groups assigned" fill="#E8A317" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-ink/70">Post an assignment to see completion here.</p>}
            </div>
            <div className="panel">
              <h2 className="mb-3 font-extrabold">Overall completion</h2>
              {sumTot ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={[{ name: 'Confirmed', v: sumConf }, { name: 'Pending', v: sumTot - sumConf }]} dataKey="v" nameKey="name" innerRadius={55} outerRadius={90}>
                      <Cell fill="#0E7C7B" /><Cell fill="#E8A317" />
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-ink/70">No group assignments yet.</p>}
            </div>
          </div>
          <div className="panel">
            <h2 className="mb-3 font-extrabold">Group performance</h2>
            {!stats.perGroup.length && <p className="text-ink/70">No groups yet. Students create them from their dashboard.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {stats.perGroup.map((g) => <Progress key={g.id} label={g.name} done={g.confirmed} total={g.total} />)}
            </div>
          </div>
        </div>
      )}

      {tab === 'assignments' && !status && (
        <div className="mt-4 space-y-4">
          {!form && <button className="btn" onClick={() => setForm(blank)}>New assignment</button>}
          {form && (
            <form onSubmit={save} className="panel grid gap-4 md:grid-cols-2">
              <h2 className="font-extrabold md:col-span-2">{form.id ? 'Edit assignment' : 'New assignment'}</h2>
              <label className="text-sm font-bold md:col-span-2">Title<input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
              <label className="text-sm font-bold md:col-span-2">Description<textarea className="input mt-1" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label className="text-sm font-bold">Due date<input type="datetime-local" className="input mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required /></label>
              <label className="text-sm font-bold">OneDrive link<input type="url" className="input mt-1" value={form.onedrive_link} onChange={(e) => setForm({ ...form, onedrive_link: e.target.value })} required /></label>
              <fieldset className="md:col-span-2">
                <legend className="text-sm font-bold">Assign to</legend>
                <label className="mr-6 text-sm"><input type="radio" checked={form.assign_to_all} onChange={() => setForm({ ...form, assign_to_all: true })} /> All groups</label>
                <label className="text-sm"><input type="radio" checked={!form.assign_to_all} onChange={() => setForm({ ...form, assign_to_all: false })} /> Specific groups</label>
                {!form.assign_to_all && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {!groups.length && <span className="text-sm text-ink/70">No groups exist yet.</span>}
                    {groups.map((g) => (
                      <label key={g.id} className="rounded-md bg-fog px-3 py-1 text-sm"><input type="checkbox" checked={form.group_ids.includes(g.id)} onChange={() => toggleGroup(g.id)} /> {g.name}</label>
                    ))}
                  </div>
                )}
              </fieldset>
              <div className="flex gap-3 md:col-span-2">
                
<button className="btn" type="submit" disabled={saving}>
  {saving
    ? 'Saving...'
    : form.id
      ? 'Save changes'
      : 'Create assignment'}
</button>

                <button type="button" className="btn-ghost" onClick={() => { setForm(null); setErr(''); }}>Cancel</button>
              </div>
            </form>
          )}
          {!assignments.length && !form && <p className="panel text-ink/70">No assignments yet. Create the first one to share a OneDrive link with students.</p>}
          {assignments.map((a) => (
            <article key={a.id} className="panel flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold">{a.title}</h3>
                <p className="text-sm text-ink/70">Due {fmt(a.due_date)} · {a.assign_to_all ? 'All groups' : `${a.group_ids.length} group(s)`}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => openStatus(a.id)}>View status</button>
                <button className="btn-ghost" onClick={() => { setForm({ ...a, due_date: toLocalInput(a.due_date) }); window.scrollTo(0, 0); }}>Edit</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'assignments' && status && (
        <div className="mt-4 space-y-4">
          <button className="btn-ghost" onClick={() => setStatus(null)}>Back to assignments</button>
          <div className="panel">
            <h2 className="text-xl font-extrabold">{status.assignment.title}</h2>
            <p className="mb-4 text-sm text-ink/70">Due {fmt(status.assignment.due_date)}</p>
            <Progress label="Groups confirmed" done={status.groups.filter((g) => g.confirmed).length} total={status.groups.length} />
          </div>
          {!status.groups.length && <p className="panel text-ink/70">No groups are assigned to this yet.</p>}
          {status.groups.map((g) => (
            <div key={g.id} className="panel">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold">{g.name}</h3>
                <Badge ok={g.confirmed}>{g.confirmed ? 'Confirmed' : 'Pending'}</Badge>
              </div>
              {g.confirmed && <p className="text-sm text-ink/70">By {g.confirmed_by} on {fmt(g.confirmed_at)}</p>}
              <ul className="mt-3 grid gap-1 text-sm md:grid-cols-2">
                {g.members.map((m) => <li key={m.id}>{m.name} <span className="text-ink/60">{m.email}</span> <Badge ok={g.confirmed}>{g.confirmed ? 'Submitted' : 'Pending'}</Badge></li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
