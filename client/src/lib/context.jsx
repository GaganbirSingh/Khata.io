import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
const MetaContext = createContext(null);
const ToastContext = createContext(null);

export function AppProviders({ children }) {
  const [user, setUserState] = useState(undefined); // undefined = still checking
  // True after the person logs out or deletes their account, so the app sends
  // them to the home page instead of the "please log in" page.
  const [signedOut, setSignedOut] = useState(false);
  const setUser = useCallback((u) => {
    if (u) setSignedOut(false);
    setUserState(u);
  }, []);
  const endSession = useCallback(() => {
    setSignedOut(true);
    setUserState(null);
  }, []);
  const [meta, setMeta] = useState(null);
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api('/auth/me', { quiet401: true });
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser();
    api('/meta')
      .then(setMeta)
      .catch(() => setMeta({ ai: { enabled: false, tier: 'free' }, payments: { mode: 'demo' }, retentionDays: 30, demoHours: 24, legal: {} }));
    setUnauthorizedHandler(() => setUser(null));
  }, [refreshUser, setUser]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message, type = 'info') => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((t) => [...t.slice(-2), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 8000 : 5000);
    },
    [dismiss]
  );

  const auth = useMemo(() => ({ user, setUser, refreshUser, signedOut, endSession }), [user, setUser, refreshUser, signedOut, endSession]);

  return (
    <AuthContext.Provider value={auth}>
      <MetaContext.Provider value={meta}>
        <ToastContext.Provider value={toast}>
          {children}
          <div className="toasts" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
                <span>{t.message}</span>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss message">
                  ×
                </button>
              </div>
            ))}
          </div>
        </ToastContext.Provider>
      </MetaContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useMeta = () => useContext(MetaContext);
export const useToast = () => useContext(ToastContext);
