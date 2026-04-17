import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  displayName: string | null;
  authType: "local" | "keycloak";
  login: (token: string, displayName: string, authType?: "local" | "keycloak") => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      displayName: null,
      authType: "local",
      login: (token, displayName, authType = "local") => set({ token, displayName, authType }),
      logout: () => set({ token: null, displayName: null, authType: "local" }),
    }),
    { name: "alertdesk-auth" }
  )
);
