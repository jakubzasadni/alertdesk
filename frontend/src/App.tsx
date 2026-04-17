import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, theme, Spin } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { LoginPage } from "./pages/LoginPage";
import { AlertsPage } from "./pages/AlertsPage";
import { useAuthStore } from "./store/auth";
import { useThemeStore } from "./store/theme";
import { useConfigStore } from "./store/config";
import { initKeycloak } from "./keycloak";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10000 },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, authType } = useAuthStore();
  if (authType === "keycloak" || token) return <>{children}</>;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const [keycloakReady, setKeycloakReady] = useState(false);
  const { login: storeLogin, logout: storeLogout, authType } = useAuthStore();
  const { isDark } = useThemeStore();
  const { setConfig } = useConfigStore();

  useEffect(() => {
    axios
      .get<{
        keycloak_url: string;
        keycloak_realm: string;
        keycloak_client_id: string;
        source_primary_label: string;
        source_secondary_label: string;
        secondary_source_enabled: boolean;
      }>("/api/auth/config")
      .then(async ({ data }) => {
        setConfig({
          sourcePrimaryLabel: data.source_primary_label,
          sourceSecondaryLabel: data.source_secondary_label,
          secondarySourceEnabled: data.secondary_source_enabled,
        });

        if (!data.keycloak_url) {
          setKeycloakReady(true);
          return;
        }
        const kc = initKeycloak(data.keycloak_url, data.keycloak_realm, data.keycloak_client_id);
        try {
          const initOptions = authType === "keycloak"
            ? { onLoad: "check-sso" as const, silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html", checkLoginIframe: false, pkceMethod: "S256" as const }
            : { checkLoginIframe: false, pkceMethod: "S256" as const };
          const authenticated = await kc.init(initOptions);
          if (authenticated && kc.token) {
            const displayName = kc.tokenParsed?.name || kc.tokenParsed?.preferred_username || "User";
            storeLogin(kc.token, displayName as string, "keycloak");
          } else if (authType === "keycloak") {
            storeLogout();
          }
        } catch {
          if (authType === "keycloak") storeLogout();
        }
        setKeycloakReady(true);
      })
      .catch(() => setKeycloakReady(true));
  }, []);

  if (!keycloakReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: isDark
            ? {
                colorPrimary: "#aaa",
                colorBgBase: "#1e1e1e",
                colorBgLayout: "#1e1e1e",
                colorBgContainer: "#2e2e2e",
                colorBgElevated: "#333",
                borderRadius: 6,
              }
            : { colorPrimary: "#1677ff", borderRadius: 6 },
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AlertsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
