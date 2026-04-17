export type Severity = "critical" | "warning" | "info" | "unknown";
export type AlertStatus = "firing" | "resolved";

export interface Ack {
  id: string;
  alert_fingerprint: string;
  acknowledged_by: string;
  comment: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  alert_fingerprint: string;
  author: string;
  body: string;
  created_at: string;
}

export interface AlertListItem {
  id: string;
  fingerprint: string;
  alertname: string;
  severity: Severity;
  namespace: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  starts_at: string;
  ends_at: string | null;
  status: AlertStatus;
  first_seen_at: string;
  last_seen_at: string;
  generator_url: string | null;
  cluster_source: string;
  ack_count: number;
  comment_count: number;
  last_ack: Ack | null;
}

export interface AlertDetail extends AlertListItem {
  acks: Ack[];
  comments: Comment[];
}

export interface AlertsResponse {
  items: AlertListItem[];
  total: number;
}

export interface AlertFilters {
  status?: AlertStatus;
  severity?: Severity;
  namespace?: string;
  cluster_source?: string;
  acked?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}
