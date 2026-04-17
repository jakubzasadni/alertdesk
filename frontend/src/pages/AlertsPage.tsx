import React, { useEffect, useRef, useState } from "react";
import { Layout, Typography, Space, Tag, Tooltip, Button, Divider, Tabs } from "antd";
import { LogoutOutlined, UserOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { alertsApi, oncallApi } from "@/api/alerts";
import { AlertsTable } from "@/components/AlertsTable";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { useConfigStore } from "@/store/config";
import { getKeycloak } from "@/keycloak";
import { AlertdeskLogo } from "@/assets/AlertdeskLogo";
import { PrometheusLogo } from "@/assets/PrometheusLogo";
import { useFaviconBadge } from "@/hooks/useFaviconBadge";

const { Header, Content } = Layout;
const { Text } = Typography;

export const AlertsPage: React.FC = () => {
  const { displayName, logout, authType } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const { sourcePrimaryLabel, sourceSecondaryLabel, secondarySourceEnabled } = useConfigStore();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const { data: firingData } = useQuery({
    queryKey: ["alerts-count"],
    queryFn: () => alertsApi.list({ status: "firing", limit: 500 }),
    refetchInterval: 30000,
    select: (d) => ({ total: d.total, fingerprints: d.items.map((a) => a.fingerprint) }),
  });
  const firingCount = firingData?.total;
  const firingFingerprints = firingData?.fingerprints;

  const seenRef = useRef<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!firingFingerprints) return;

    const markSeen = () => {
      seenRef.current = new Set(firingFingerprints);
      setUnreadCount(0);
    };

    if (document.visibilityState === "visible") {
      markSeen();
    } else {
      const unseen = firingFingerprints.filter((fp) => !seenRef.current.has(fp)).length;
      setUnreadCount(unseen);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") markSeen();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [firingFingerprints]);

  const { data: oncall } = useQuery({
    queryKey: ["oncall"],
    queryFn: () => oncallApi.get(),
    refetchInterval: 5 * 60 * 1000,
    select: (d) => d.on_call,
  });

  useFaviconBadge(unreadCount);

  const tabItems = [
    { key: "primary", label: sourcePrimaryLabel, children: <AlertsTable clusterSource="primary" /> },
    ...(secondarySourceEnabled
      ? [{ key: "secondary", label: sourceSecondaryLabel, children: <AlertsTable clusterSource="secondary" /> }]
      : []),
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "#111",
          height: 56,
          borderBottom: "1px solid #333",
        }}
      >
        <Space size={16} align="center">
          <div style={{ color: "#fff", lineHeight: 0 }}>
            <AlertdeskLogo size={22} />
          </div>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>alertdesk</Text>
          <Divider type="vertical" style={{ borderColor: "#444", height: 24, margin: 0 }} />
          <div style={{ color: "#fff", lineHeight: 0, opacity: 0.85 }}>
            <PrometheusLogo size={26} />
          </div>
          {firingCount !== undefined && firingCount > 0 && (
            <Tag
              style={{
                background: "transparent",
                color: "#bbb",
                border: "1px solid #555",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 1,
              }}
            >
              {firingCount} FIRING
            </Tag>
          )}
          {oncall && (
            <Tooltip title="On-call engineer">
              <Text style={{ color: "#52c41a", fontSize: 12, fontWeight: 600, cursor: "default" }}>On-call: {oncall}</Text>
            </Tooltip>
          )}
        </Space>

        <Space>
          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              style={{ color: "#999" }}
              onClick={toggleTheme}
            />
          </Tooltip>
          <UserOutlined style={{ color: "#999" }} />
          <Text style={{ color: "#999", fontSize: 13 }}>{displayName}</Text>
          <Tooltip title="Logout">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              style={{ color: "#999" }}
              onClick={handleLogout}
            />
          </Tooltip>
        </Space>
      </Header>

      <Content style={{ padding: "20px 24px", overflowY: "auto", height: "calc(100vh - 56px)" }}>
        <Tabs
          defaultActiveKey="primary"
          size="small"
          style={{ marginBottom: 0 }}
          items={tabItems}
        />
      </Content>
    </Layout>
  );
};
