
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Badge, ErrorMsg, Progress, fmt } from '../components.jsx';

export default function Student() {
  const { user, logout } = useAuth();
  const [group, setGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [err, setErr] = useState('');
  const [gname, setGname] = useState('');
  const [ident, setIdent] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    const [g, a] = await Promise.all([
      api('/groups/mine'),
      api('/assignments')
    ]);

    setGroup(g.group);
    setItems(a.assignments);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const run = (fn) => async (e) => {
    e?.preventDefault();

    if (loadingAction) return;

    setErr('');
    setLoadingAction(true);

    try {
      await fn();
      await load();
    } catch (x) {
      setErr(x.message || 'Something went wrong. Please try again.');
    } finally {
      setLoadingAction(false);
    }
  };

  const createGroup = run(async () => {
    await api('/groups', {
      method: 'POST',
      body: { name: gname }
    });
    setGname('');
  });

  const addMember = run(async () => {
    await api(`/groups/${group.id}/members`, {
      method: 'POST',
      body: { identifier: ident }
    });
    setIdent('');
  });

  const removeMember = (id) =>
    run(() => api(`/groups/${group.id}/members/${id}`, {
      method: 'DELETE'
    }))();

  const confirm = run(async () => {
    await api(`/assignments/${modal.assignment.id}/confirm`, {
      method: 'POST',
      body: { confirm: true }
    });
    setModal(null);
  });

  const done = items.filter((i) => i.confirmed).length;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">
          Hi {user.name.split(' ')[0]}
        </h1>
        <button className="btn-ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <ErrorMsg msg={err} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="panel h-fit space-y-4">
          {!loaded ? (
            <p>Loading...</p>
          ) : !group ? (
            <form onSubmit={createGroup} className="space-y-3">
              <h2 className="font-extrabold">Start your group</h2>
              <p className="text-sm text-ink/70">
                You need a group before you can confirm submissions.
              </p>

              <input
                className="input"
                placeholder="Group name"
                value={gname}
                onChange={(e) => setGname(e.target.value)}
                required
              />

              <button
                className="btn w-full"
                type="submit"
                disabled={loadingAction}
              >
                {loadingAction ? 'Creating...' : 'Create group'}
              </button>
            </form>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-extrabold">{group.name}</h2>
                <p className="mb-3 text-sm text-ink/70">
                  {group.members.length} member
                  {group.members.length > 1 ? 's' : ''}
                </p>

                <Progress
                  label="Group progress"
                  done={group.progress.confirmed}
                  total={group.progress.total}
                />
              </div>

              <ul className="divide-y divide-ink/10 text-sm">
                {group.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span>
                      <b>{m.name}</b>
                      <br />
                      <span className="text-ink/60">
                        {m.email} · ID {m.id}
                      </span>
                    </span>

                    {(group.created_by === user.id || m.id === user.id) && (
                      <button
                        className="text-xs font-bold text-brick underline"
                        disabled={loadingAction}
                        onClick={() => removeMember(m.id)}
                      >
                        {loadingAction
                          ? 'Please wait...'
                          : m.id === user.id ? 'Leave' : 'Remove'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <form onSubmit={addMember} className="space-y-2">
                <label className="text-sm font-bold" htmlFor="ident">
                  Add a member
                </label>

                <input
                  id="ident"
                  className="input"
                  placeholder="Student email or ID"
                  value={ident}
                  onChange={(e) => setIdent(e.target.value)}
                  required
                />

                <button
                  className="btn w-full"
                  type="submit"
                  disabled={loadingAction}
                >
                  {loadingAction ? 'Adding...' : 'Add to group'}
                </button>
              </form>
            </>
          )}
        </aside>

        <main className="space-y-4">
          <h2 className="text-xl font-extrabold">
            Assignments{' '}
            <span className="text-base font-medium text-ink/60">
              ({done} of {items.length} confirmed)
            </span>
          </h2>

          {loaded && !items.length && (
            <p className="panel text-ink/70">
              No assignments yet. They'll show up here when your professor posts one.
            </p>
          )}

          {items.map((a) => (
            <article key={a.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-lg font-extrabold">{a.title}</h3>
                <Badge ok={a.confirmed}>
                  {a.confirmed ? 'Submitted' : 'Pending'}
                </Badge>
              </div>

              <p className="mt-1 text-sm text-ink/80">
                {a.description}
              </p>

              <p className="mt-2 text-sm font-medium">
                Due {fmt(a.due_date)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  className="btn-ghost"
                  href={a.onedrive_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open OneDrive link
                </a>

                {a.confirmed ? (
                  <span className="text-sm font-bold text-teal">
                    Confirmed by {a.confirmed_by} on {fmt(a.confirmed_at)}
                  </span>
                ) : (
                  <button
                    className="btn"
                    disabled={!group || loadingAction}
                    title={group ? '' : 'Create a group first'}
                    onClick={() => setModal({ assignment: a, step: 1 })}
                  >
                    Confirm submission
                  </button>
                )}
              </div>
            </article>
          ))}
        </main>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-ink/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="panel w-full max-w-md space-y-4">
            {modal.step === 1 ? (
              <>
                <h3 className="text-lg font-extrabold">
                  Did your group upload "{modal.assignment.title}"?
                </h3>

                <p className="text-sm text-ink/70">
                  Make sure the files are in the OneDrive folder before you continue.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn"
                    disabled={loadingAction}
                    onClick={() => setModal({ ...modal, step: 2 })}
                  >
                    Yes, I have submitted
                  </button>

                  <button
                    className="btn-ghost"
                    disabled={loadingAction}
                    onClick={() => setModal(null)}
                  >
                    Not yet
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-extrabold">
                  Confirm for {group.name}?
                </h3>

                <p className="text-sm text-ink/70">
                  This tells your professor the whole group has submitted.
                  You can't undo it.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn"
                    disabled={loadingAction}
                    onClick={confirm}
                  >
                    {loadingAction ? 'Confirming...' : 'Confirm submission'}
                  </button>

                  <button
                    className="btn-ghost"
                    disabled={loadingAction}
                    onClick={() => setModal({ ...modal, step: 1 })}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
