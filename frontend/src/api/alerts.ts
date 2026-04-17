import api from "./client";
import type { AlertsResponse, AlertDetail, AlertFilters, Ack, Comment } from "@/types";

export const alertsApi = {
  list: async (filters: AlertFilters = {}): Promise<AlertsResponse> => {
    const params: Record<string, string | number | boolean> = {};
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (filters.namespace) params.namespace = filters.namespace;
    if (filters.cluster_source) params.cluster_source = filters.cluster_source;
    if (filters.acked !== undefined) params.acked = filters.acked;
    if (filters.search) params.search = filters.search;
    if (filters.skip !== undefined) params.skip = filters.skip;
    if (filters.limit !== undefined) params.limit = filters.limit;
    const { data } = await api.get<AlertsResponse>("/alerts", { params });
    return data;
  },

  get: async (fingerprint: string): Promise<AlertDetail> => {
    const { data } = await api.get<AlertDetail>(`/alerts/${fingerprint}`);
    return data;
  },

  acknowledge: async (fingerprint: string, comment?: string, acknowledgedBy?: string): Promise<Ack> => {
    const { data } = await api.post<Ack>(`/acks/${fingerprint}`, { comment: comment ?? null, acknowledged_by: acknowledgedBy ?? null });
    return data;
  },

  addComment: async (fingerprint: string, body: string): Promise<Comment> => {
    const { data } = await api.post<Comment>(`/comments/${fingerprint}`, { body });
    return data;
  },

  editComment: async (commentId: string, body: string): Promise<Comment> => {
    const { data } = await api.patch<Comment>(`/comments/id/${commentId}`, { body });
    return data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await api.delete(`/comments/id/${commentId}`);
  },

  deleteAcks: async (fingerprint: string): Promise<void> => {
    await api.delete(`/acks/${fingerprint}`);
  },
};

export const authApi = {
  login: async (username: string, password: string) => {
    const { data } = await api.post<{ access_token: string; display_name: string }>("/auth/login", {
      username,
      password,
    });
    return data;
  },
};

export const oncallApi = {
  get: async (): Promise<{ on_call: string | null }> => {
    const { data } = await api.get<{ on_call: string | null }>("/oncall");
    return data;
  },
};
