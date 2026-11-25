import axios from "axios";
import { errorMessage } from "../utils/nutrition";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 90000,
  withCredentials: true,
});
let accessToken = null;
let refreshing = null;
export function setToken(access) {
  accessToken = access || null;
}
export const getToken = () => accessToken;
// Only the access token is exposed to JavaScript. Refresh credentials are HttpOnly.
export async function refreshSession() {
  const { data: csrf } = await axios.get(`${api.defaults.baseURL}/auth/csrf/`, {
    withCredentials: true,
  });
  const { data } = await axios.post(
    `${api.defaults.baseURL}/auth/refresh/`,
    {},
    { withCredentials: true, headers: { "X-CSRFToken": csrf.csrfToken } },
  );
  setToken(data.access);
  return data;
}
api.interceptors.request.use(async (config) => {
  if (
    config.url?.startsWith("/auth/") &&
    !["get", "head", "options"].includes((config.method || "get").toLowerCase())
  ) {
    const { data } = await axios.get(`${api.defaults.baseURL}/auth/csrf/`, {
      withCredentials: true,
    });
    config.headers["X-CSRFToken"] = data.csrfToken;
  }
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      !config?._retry &&
      !config?.url?.startsWith("/auth/")
    ) {
      config._retry = true;
      try {
        refreshing ||= refreshSession().finally(() => {
          refreshing = null;
        });
        const session = await refreshing;
        config.headers.Authorization = `Bearer ${session.access}`;
        return api(config);
      } catch {
        setToken(null);
        window.dispatchEvent(new Event("auth-expired"));
      }
    }
    error.friendlyMessage = errorMessage(error);
    return Promise.reject(error);
  },
);
export async function exportReport(format, date) {
  const { data } = await api.get("/reports/export/", {
    params: { format, date },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nutrivision-${date}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
