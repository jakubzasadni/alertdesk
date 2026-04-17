import React, { useState } from "react";
import {
  Table, Tag, Button, Space, Tooltip, Badge, Typography,
  Input, Select, Switch, Popover,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined, CommentOutlined, ReloadOutlined,
  SearchOutlined, FilterOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import { alertsApi, oncallApi } from "@/api/alerts";
import { SeverityBadge, getSeverityConfig } from "./SeverityBadge";
import { AlertDetailDrawer } from "./AlertDetailDrawer";
import { AckModal } from "./AckModal";
import { useThemeStore } from "@/store/theme";
import type { AlertListItem, AlertFilters, AlertStatus, Severity } from "@/types";

dayjs.extend(relativeTime);
dayjs.extend(duration);

const { Text } = Typography;
const { Option } = Select;

function formatDuration(start: string, end?: string | null): string {
  const s = dayjs(start);
  const e = end ? dayjs(end) : dayjs();
  const diff = e.diff(s, "second");
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const AlertsTable: React.FC<{ clusterSource?: string }> = ({ clusterSource }) => {
  const { isDark } = useThemeStore();
  const [filters, setFilters] = useState<AlertFilters>({
    status: "firing",
    limit: 100,
    ...(clusterSource ? { cluster_source: clusterSource } : {}),
  });
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<AlertListItem | null>(null);
  const [ackTarget, setAckTarget] = useState<AlertListItem | null>(null);

  const { data: oncall } = useQuery({
    queryKey: ["oncall"],
    queryFn: () => oncallApi.get(),
    refetchInterval: 5 * 60 * 1000,
    select: (d) => d.on_call ?? undefined,
  });

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => alertsApi.list(filters),
    refetchInterval: 30000,
  });

  const columns: ColumnsType<AlertListItem> = [
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      width: 100,
      render: (v: string) => <SeverityBadge severity={v} />,
      sorter: (a, b) => {
        const order = { critical: 0, warning: 1, info: 2, unknown: 3 };
        return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
      },
      defaultSortOrder: "ascend",
    },
    {
      title: "Started",
      dataIndex: "starts_at",
      key: "starts_at",
      width: 150,
      render: (v: string) => (
        <Tooltip title={dayjs(v).format("YYYY-MM-DD HH:mm:ss")}>
          <Text style={{ whiteSpace: "nowrap" }}>{dayjs(v).fromNow()}</Text>
        </Tooltip>
      ),
      sorter: (a, b) => dayjs(a.starts_at).unix() - dayjs(b.starts_at).unix(),
    },
    {
      title: "In Panel",
      dataIndex: "first_seen_at",
      key: "first_seen_at",
      width: 150,
      render: (v: string) => (
        <Tooltip title={dayjs(v).format("YYYY-MM-DD HH:mm:ss")}>
          <Text style={{ whiteSpace: "nowrap" }}>{dayjs(v).fromNow()}</Text>
        </Tooltip>
      ),
      sorter: (a, b) => dayjs(a.first_seen_at).unix() - dayjs(b.first_seen_at).unix(),
    },
    {
      title: "Duration",
      key: "duration",
      width: 90,
      render: (_, r) => (
        <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
          {formatDuration(r.starts_at, r.ends_at)}
        </Text>
      ),
    },
    {
      title: "Alert",
      dataIndex: "alertname",
      key: "alertname",
      render: (v: string, r) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 600, textAlign: "left" }}
          onClick={() => { setSelectedFingerprint(r.fingerprint); setSelectedItem(r); }}
        >
          {v}
        </Button>
      ),
    },
    {
      title: "Namespace",
      dataIndex: "namespace",
      key: "namespace",
      width: 160,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Cluster",
      key: "cluster",
      width: 140,
      render: (_: unknown, r: AlertListItem) => {
        const c = r.labels?.cluster;
        return c ? <Tag color="blue">{c}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: "Summary",
      key: "summary",
      ellipsis: true,
      render: (_, r) => (
        <Text type="secondary" ellipsis>
          {r.annotations.summary ?? r.annotations.description ?? "—"}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (v: string) => (
        <Tag color={v === "firing" ? "red" : "green"}>{v.toUpperCase()}</Tag>
      ),
    },
    {
      title: "Ack",
      key: "ack",
      width: 150,
      render: (_, r) =>
        r.ack_count > 0 ? (
          <Tooltip title={`Last: ${r.last_ack?.acknowledged_by} – ${r.last_ack?.comment ?? "no comment"}`}>
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ cursor: "pointer" }}
              onClick={() => { setSelectedFingerprint(r.fingerprint); setSelectedItem(r); }}
            >
              {r.last_ack?.acknowledged_by}
            </Tag>
          </Tooltip>
        ) : (
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            disabled={r.status === "resolved"}
            onClick={(e) => { e.stopPropagation(); setAckTarget(r); }}
          >
            Ack
          </Button>
        ),
    },
    {
      title: "Msg",
      key: "comments",
      width: 60,
      render: (_, r) => (
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined />}
          onClick={() => { setSelectedFingerprint(r.fingerprint); setSelectedItem(r); }}
        >
          {r.comment_count > 0 && r.comment_count}
        </Button>
      ),
    },
  ];

  const totalFiring = data?.items.filter((a) => a.status === "firing").length ?? 0;

  return (
    <div>
      {/* Filters bar */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search alert name…"
          allowClear
          style={{ width: 220 }}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
        />

        <Select
          placeholder="Status"
          allowClear
          style={{ width: 120 }}
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v as AlertStatus }))}
        >
          <Option value="firing">Firing</Option>
          <Option value="resolved">Resolved</Option>
        </Select>

        <Select
          placeholder="Severity"
          allowClear
          style={{ width: 130 }}
          onChange={(v) => setFilters((f) => ({ ...f, severity: v as Severity }))}
        >
          <Option value="critical">Critical</Option>
          <Option value="warning">Warning</Option>
          <Option value="info">Info</Option>
        </Select>

        <Input
          placeholder="Namespace…"
          allowClear
          style={{ width: 160 }}
          onChange={(e) => setFilters((f) => ({ ...f, namespace: e.target.value || undefined }))}
        />

        <Tooltip title="Show only unacknowledged">
          <Space>
            <Switch
              size="small"
              onChange={(v) => setFilters((f) => ({ ...f, acked: v ? false : undefined }))}
            />
            <Text>Unacked only</Text>
          </Space>
        </Tooltip>

        <Button
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Refresh
        </Button>

        <Text type="secondary" style={{ fontSize: 12 }}>
          Last sync: {dataUpdatedAt ? dayjs(dataUpdatedAt).format("HH:mm:ss") : "—"}
          {" · "}
          <Text strong type={totalFiring > 0 ? "danger" : "success"}>
            {totalFiring} firing
          </Text>
        </Text>
      </Space>

      <Table
        rowKey="fingerprint"
        dataSource={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        size="small"
        pagination={{
          pageSize: 50,
          showTotal: (t) => `${t} alerts`,
          showSizeChanger: true,
          pageSizeOptions: [25, 50, 100, 200],
        }}
        onRow={(r) => ({
          onClick: () => { setSelectedFingerprint(r.fingerprint); setSelectedItem(r); },
          style: {
            backgroundColor: r.status === "resolved"
              ? (isDark ? "#1a2e1a" : "#f6ffed")
              : getSeverityConfig(r.severity, isDark).bg,
            cursor: "pointer",
          },
        })}
        scroll={{ x: "max-content" }}
      />

      <AlertDetailDrawer
        fingerprint={selectedFingerprint}
        alertItem={selectedItem}
        onClose={() => { setSelectedFingerprint(null); setSelectedItem(null); }}
      />

      <AckModal alert={ackTarget} onCallPerson={oncall} onClose={() => setAckTarget(null)} />
    </div>
  );
};
