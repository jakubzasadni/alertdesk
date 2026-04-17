import axios from "axios";
import { useAuthStore } from "@/store/auth";
import { getKeycloak } from "@/keycloak";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const { authType, token } = useAuthStore.getState();
  if (authType === "keycloak") {
    const kc = getKeycloak();
    if (kc?.authenticated) {
      try {
        await kc.updateToken(30);
        config.headers.Authorization = `Bearer ${kc.token}`;
      } catch {
        kc.login();
      }
    }
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const { authType } = useAuthStore.getState();
      if (authType === "keycloak") {
        getKeycloak()?.login();
      } else {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
