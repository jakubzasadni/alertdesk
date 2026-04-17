import React from "react";
import { Tag } from "antd";
import type { Severity } from "@/types";
import { useThemeStore } from "@/store/theme";

const DARK: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: "#ff4d4f", bg: "#3a1a1a", label: "CRITICAL" },
  warning:  { color: "#fa8c16", bg: "#3a2a12", label: "WARNING"  },
  info:     { color: "#4096ff", bg: "#1a2a3a", label: "INFO"     },
  unknown:  { color: "#8c8c8c", bg: "#2a2a2a", label: "UNKNOWN"  },
};

const LIGHT: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: "#cf1322", bg: "#fff1f0", label: "CRITICAL" },
  warning:  { color: "#d46b08", bg: "#fff7e6", label: "WARNING"  },
  info:     { color: "#0958d9", bg: "#e6f4ff", label: "INFO"     },
  unknown:  { color: "#595959", bg: "#fafafa", label: "UNKNOWN"  },
};

export function getSeverityConfig(severity: string, isDark = true) {
  const cfg = isDark ? DARK : LIGHT;
  return cfg[(severity as Severity)] ?? cfg.unknown;
}

interface Props {
  severity: string;
}

export const SeverityBadge: React.FC<Props> = ({ severity }) => {
  const { isDark } = useThemeStore();
  const cfg = getSeverityConfig(severity, isDark);
  return (
    <Tag
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.color,
        color: cfg.color,
        fontWeight: 700,
        minWidth: 72,
        textAlign: "center",
      }}
    >
      {cfg.label}
    </Tag>
  );
};
