import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api, setToken, refreshSession } from "../services/api";
import { useQueryClient } from "@tanstack/react-query";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const acceptSession = useCallback(
    (data) => {
      setToken(data.access);
      setUser(data.user);
      queryClient.clear();
      return data.user;
    },
    [queryClient],
  );
  async function refreshProfile() {
    const { data } = await api.get("/users/profile/");
    setUser(data);
    return data;
  }
  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const data = await refreshSession();
        if (active) setUser(data.user);
      } catch {
        if (active) setToken(null);
      }
      if (active) setLoading(false);
    };
    restore();
    const expire = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener("auth-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("auth-expired", expire);
    };
  }, [queryClient]);
  async function login(email, password) {
    const { data } = await api.post("/auth/login/", { email, password });
    return acceptSession(data);
  }
  async function signup(values) {
    const { data } = await api.post("/auth/register/", values);
    return acceptSession(data);
  }
  async function logout() {
    try {
      await api.post("/auth/logout/");
    } finally {
      setToken(null);
      setUser(null);
      queryClient.clear();
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshProfile,
        acceptSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
