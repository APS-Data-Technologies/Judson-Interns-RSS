import { useCallback, useEffect, useMemo, useState } from "react";
import AuthContext from "./AuthContext";
import {
  changePasswordRequest,
  currentUserRequest,
  loginRequest,
  logoutRequest,
} from "./authApi";
import { clearAuthToken, getAuthToken, setAuthToken } from "./authStorage";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      if (!getAuthToken()) {
        setIsLoading(false);
        return;
      }

      try {
        setUser(await currentUserRequest());
      } catch {
        clearAuthToken();
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) {
        await logoutRequest();
      }
    } catch {
      // Local authentication state must clear even when the token is already invalid.
    } finally {
      clearAuthToken();
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (passwords) => {
    const data = await changePasswordRequest(passwords);
    setAuthToken(data.token);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), isLoading, login, logout, changePassword }),
    [user, isLoading, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
