import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    if (token) {
      const timeout = setTimeout(() => { if (!cancelled) setLoading(false); }, 15000);
      auth.me()
        .then(u => { clearTimeout(timeout); if (!cancelled) { if (u) setUser(u); else setLoading(false); } })
        .catch(() => { clearTimeout(timeout); if (!cancelled) { localStorage.removeItem('token'); setLoading(false); } })
        .finally(() => { clearTimeout(timeout); if (!cancelled) setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  const login = async (username, password) => {
    const data = await auth.login(username, password);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
