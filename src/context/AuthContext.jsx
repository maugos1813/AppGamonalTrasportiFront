import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_LOGOUT_EVENT, parseApiError } from "../lib/api";
import { loginRequest, meRequest, registerRequest } from "../lib/auth.api";
import { clearToken, getToken, setToken } from "../lib/token";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setInitializing(false);
      return;
    }
    try {
      const me = await meRequest();
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handleForcedLogout = () => setUser(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      const { user: loggedUser, token } = await loginRequest(credentials);
      setToken(token);
      setUser(loggedUser);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: parseApiError(error) };
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const { user: newUser, token } = await registerRequest(payload);
      setToken(token);
      setUser(newUser);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: parseApiError(error) };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      initializing,
      login,
      register,
      logout,
      setUser,
    }),
    [user, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return ctx;
};
