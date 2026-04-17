import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Divider } from "antd";
import { LockOutlined, UserOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/alerts";
import { useAuthStore } from "@/store/auth";
import { getKeycloak } from "@/keycloak";
import { AlertdeskLogo } from "@/assets/AlertdeskLogo";
import { PrometheusLogo } from "@/assets/PrometheusLogo";

const { Text } = Typography;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(values.username, values.password);
      login(data.access_token, data.display_name, "local");
      navigate("/");
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  const onSSOLogin = () => {
    const kc = getKeycloak();
    if (kc) kc.login({ redirectUri: window.location.origin + "/" });
  };

  const kcAvailable = !!getKeycloak();

  return (
    <div
      style={{
        height: "100vh",
        background: "#555",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Card
        style={{
          width: 360,
          borderRadius: 8,
          background: "#1a1a1a",
          border: "1px solid #333",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ color: "#fff", lineHeight: 0 }}>
              <AlertdeskLogo size={28} />
            </div>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>alertdesk</Text>
            <div style={{ width: 1, height: 28, background: "#444" }} />
            <div style={{ color: "#fff", lineHeight: 0 }}>
              <PrometheusLogo size={30} />
            </div>
          </div>
          <Text style={{ color: "#888", fontSize: 12 }}>AlertManager · Acknowledge · Track</Text>
        </div>

        {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}

        {kcAvailable && (
          <>
            <Button
              block
              size="large"
              icon={<SafetyCertificateOutlined />}
              onClick={onSSOLogin}
              style={{
                marginBottom: 16,
                background: "#fff",
                color: "#111",
                border: "none",
                fontWeight: 600,
              }}
            >
              Login with Keycloak SSO
            </Button>
            <Divider plain style={{ borderColor: "#333", color: "#666", fontSize: 12 }}>or local admin</Divider>
          </>
        )}

        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="username" rules={[{ required: true }]}>
            <Input
              prefix={<UserOutlined style={{ color: "#666" }} />}
              placeholder="Username"
              size="large"
              style={{ background: "#2a2a2a", border: "1px solid #444", color: "#fff" }}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: "#666" }} />}
              placeholder="Password"
              size="large"
              style={{ background: "#2a2a2a", border: "1px solid #444", color: "#fff" }}
            />
          </Form.Item>
          <Button
            htmlType="submit"
            block
            size="large"
            loading={loading}
            style={{
              background: kcAvailable ? "transparent" : "#fff",
              color: kcAvailable ? "#666" : "#111",
              border: "1px solid #444",
            }}
          >
            Sign In
          </Button>
        </Form>
      </Card>
    </div>
  );
};
