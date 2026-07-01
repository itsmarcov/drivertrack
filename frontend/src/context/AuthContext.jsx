import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => { if (!cancelled) setLoading(false); }, 15000);
    auth.me()
      .then(u => { clearTimeout(timeout); if (!cancelled && u) setUser(u); })
      .finally(() => { clearTimeout(timeout); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = async (username, password, recaptcha_token) => {
    const data = await auth.login(username, password, recaptcha_token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    auth.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
