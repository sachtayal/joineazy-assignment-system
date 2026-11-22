import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Auth from './pages/Auth.jsx';
import Student from './pages/Student.jsx';
import Admin from './pages/Admin.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api('/auth/me').then((d) => setUser(d.user)).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);

  const login = (token, u) => { localStorage.setItem('token', token); setUser(u); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  if (!ready) return <p className="p-8">Loading…</p>;

  const home = user ? (user.role === 'ADMIN' ? '/admin' : '/student') : '/login';
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={home} /> : <Auth />} />
        <Route path="/student" element={user?.role === 'STUDENT' ? <Student /> : <Navigate to={home} />} />
        <Route path="/admin" element={user?.role === 'ADMIN' ? <Admin /> : <Navigate to={home} />} />
        <Route path="*" element={<Navigate to={home} />} />
      </Routes>
    </AuthCtx.Provider>
  );
}
