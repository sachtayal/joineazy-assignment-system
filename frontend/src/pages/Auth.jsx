import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { ErrorMsg } from '../components.jsx';

export default function Auth() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
    adminCode: ''
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (loading) return;

    setErr('');
    setLoading(true);

    try {
      const d = await api(
        mode === 'login' ? '/auth/login' : '/auth/register',
        { method: 'POST', body: f }
      );
      login(d.token, d.user);
    } catch (x) {
      setErr(x.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setErr('');
    setMode((prev) => prev === 'login' ? 'register' : 'login');
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between bg-ink p-8 text-white sm:p-10">
        <p className="text-lg font-extrabold">Joineazy</p>

        <div className="my-12">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">
            Every group. Every assignment. One honest status.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Form your group, upload to OneDrive, confirm once.
            Professors see who has handed in and who hasn't.
          </p>
        </div>

        <p className="text-sm text-white/50">
          Demo: prof@joineazy.test / Admin@123
          <span className="mx-2">Â·</span>
          aarav@student.test / Student@123
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-8">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-4"
          aria-busy={loading}
        >
          <div>
            <h2 className="text-2xl font-extrabold">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {mode === 'login'
                ? 'Log in to continue to your dashboard.'
                : 'Fill in your details to get started.'}
            </p>
          </div>

          {mode === 'register' && (
            <>
              <label className="block text-sm font-bold">
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  className="input mt-1"
                  value={f.name}
                  onChange={set('name')}
                  required
                />
              </label>

              <label className="block text-sm font-bold">
                I am a
                <select
                  name="role"
                  className="input mt-1"
                  value={f.role}
                  onChange={set('role')}
                >
                  <option value="STUDENT">Student</option>
                  <option value="ADMIN">Professor</option>
                </select>
              </label>

              {f.role === 'ADMIN' && (
                <label className="block text-sm font-bold">
                  Professor access code
                  <input
                    name="adminCode"
                    type="password"
                    autoComplete="off"
                    className="input mt-1"
                    value={f.adminCode}
                    onChange={set('adminCode')}
                    required
                  />
                </label>
              )}
            </>
          )}

          <label className="block text-sm font-bold">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="input mt-1"
              value={f.email}
              onChange={set('email')}
              required
            />
          </label>

          <label className="block text-sm font-bold">
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              className="input mt-1"
              value={f.password}
              onChange={set('password')}
              required
            />
          </label>

          <ErrorMsg msg={err} />

          <button
            type="submit"
            className="btn w-full"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login' ? 'Log in' : 'Create account'}
          </button>

          <button
            type="button"
            className="w-full text-sm font-bold text-teal underline"
            onClick={toggleMode}
            disabled={loading}
          >
            {mode === 'login'
              ? 'New here? Create an account'
              : 'Have an account? Log in'}
          </button>
        </form>
      </section>
    </main>
  );
}
