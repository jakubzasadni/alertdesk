import React, { useState } from "react";
import {
  Drawer, Descriptions, Tag, Typography, Space, Divider, List, Avatar,
  Input, Button, Spin, Popconfirm,
} from "antd";

function renderWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  );
}
import {
  CheckCircleOutlined, CommentOutlined, UserOutlined, ClockCircleOutlined,
  EditOutlined, DeleteOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { alertsApi } from "@/api/alerts";
import { SeverityBadge } from "./SeverityBadge";
import { AckModal } from "./AckModal";
import type { AlertListItem, Comment } from "@/types";

dayjs.extend(relativeTime);
dayjs.extend(utc);

const { Text, Title } = Typography;
const { TextArea } = Input;

interface Props {
  fingerprint: string | null;
  alertItem: AlertListItem | null;
  onClose: () => void;
}

export const AlertDetailDrawer: React.FC<Props> = ({ fingerprint, alertItem, onClose }) => {
  const [commentBody, setCommentBody] = useState("");
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editBody, setEditBody] = useState("");
  const [ackTarget, setAckTarget] = useState<AlertListItem | null>(null);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["alert", fingerprint] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
  };

  const { data: alert, isLoading } = useQuery({
    queryKey: ["alert", fingerprint],
    queryFn: () => alertsApi.get(fingerprint!),
    enabled: !!fingerprint,
    refetchInterval: 15000,
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => alertsApi.addComment(fingerprint!, body),
    onSuccess: () => { invalidate(); setCommentBody(""); },
  });

  const editCommentMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => alertsApi.editComment(id, body),
    onSuccess: () => { invalidate(); setEditingComment(null); setEditBody(""); },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => alertsApi.deleteComment(id),
    onSuccess: invalidate,
  });

  const deleteAcksMutation = useMutation({
    mutationFn: () => alertsApi.deleteAcks(fingerprint!),
    onSuccess: () => { invalidate(); if (alertItem) setAckTarget(alertItem); },
  });

  const formatDuration = (start: string, end?: string | null) => {
    const s = dayjs(start);
    const e = end ? dayjs(end) : dayjs();
    const diff = e.diff(s, "second");
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const sec = diff % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  return (
    <>
      <Drawer
        open={!!fingerprint}
        onClose={onClose}
        width={640}
        title={
          alertItem && (
            <Space>
              <SeverityBadge severity={alertItem.severity} />
              <span>{alertItem.alertname}</span>
            </Space>
          )
        }
        destroyOnClose
      >
        {isLoading && <Spin />}
        {alert && (
          <>
            {/* Status bar */}
            <Space style={{ marginBottom: 16 }}>
              <Tag color={alert.status === "firing" ? "red" : "green"}>
                {alert.status.toUpperCase()}
              </Tag>
              {alert.acks.length > 0 ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  ACK'd by {alert.acks[alert.acks.length - 1].acknowledged_by}
                </Tag>
              ) : (
                <Tag color="default">Not acknowledged</Tag>
              )}
              {alertItem && (
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={alert.status === "resolved"}
                  onClick={() => setAckTarget(alertItem)}
                >
                  Acknowledge
                </Button>
              )}
            </Space>

            {/* Timing */}
            <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Started">
                {dayjs.utc(alert.starts_at).local().format("YYYY-MM-DD HH:mm:ss")}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {formatDuration(alert.starts_at, alert.ends_at)}
              </Descriptions.Item>
              {alert.ends_at && (
                <Descriptions.Item label="Resolved">
                  {dayjs.utc(alert.ends_at).local().format("YYYY-MM-DD HH:mm:ss")}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Namespace">
                {alert.namespace ?? "—"}
              </Descriptions.Item>
            </Descriptions>

            {/* Annotations */}
            {Object.keys(alert.annotations).length > 0 && (
              <>
                <Title level={5} style={{ marginTop: 0 }}>Annotations</Title>
                <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
                  {Object.entries(alert.annotations).map(([k, v]) => (
                    <Descriptions.Item key={k} label={k}>
                      {String(v)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            {/* Labels */}
            <Title level={5}>Labels</Title>
            <Space wrap style={{ marginBottom: 16 }}>
              {Object.entries(alert.labels).map(([k, v]) => (
                <Tag key={k}>
                  <Text type="secondary">{k}=</Text>
                  <Text>{String(v)}</Text>
                </Tag>
              ))}
            </Space>

            {alert.generator_url && (
              <div style={{ marginBottom: 16 }}>
                <a href={alert.generator_url} target="_blank" rel="noopener noreferrer">
                  View in Prometheus →
                </a>
              </div>
            )}

            <Divider />

            {/* Acknowledgements */}
            <Title level={5}>
              <CheckCircleOutlined style={{ marginRight: 8, color: "#52c41a" }} />
              Acknowledgements ({alert.acks.length})
            </Title>
            {alert.acks.length === 0 ? (
              <Text type="secondary">No acknowledgements yet.</Text>
            ) : (
              <List
                size="small"
                dataSource={alert.acks}
                renderItem={(ack) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="reack"
                        title="Usuń ACK i dodaj nowy?"
                        onConfirm={() => deleteAcksMutation.mutate()}
                        okText="Tak"
                        cancelText="Nie"
                      >
                        <Button size="small" icon={<EditOutlined />} type="text">Re-ACK</Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} size="small" />}
                      title={
                        <Space>
                          <Text strong>{ack.acknowledged_by}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {dayjs.utc(ack.created_at).local().format("YYYY-MM-DD HH:mm")}
                          </Text>
                        </Space>
                      }
                      description={ack.comment ? <span>{renderWithLinks(ack.comment)}</span> : <Text type="secondary" italic>No comment</Text>}
                    />
                  </List.Item>
                )}
              />
            )}

            <Divider />

            {/* Comments */}
            <Title level={5}>
              <CommentOutlined style={{ marginRight: 8 }} />
              Comments ({alert.comments.length})
            </Title>
            {alert.comments.length === 0 ? (
              <Text type="secondary">No comments yet.</Text>
            ) : (
              <List
                size="small"
                dataSource={alert.comments}
                style={{ marginBottom: 16 }}
                renderItem={(c) => (
                  <List.Item
                    actions={[
                      <Button
                        key="edit"
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => { setEditingComment(c); setEditBody(c.body); }}
                      />,
                      <Popconfirm
                        key="del"
                        title="Usunąć komentarz?"
                        onConfirm={() => deleteCommentMutation.mutate(c.id)}
                        okText="Tak"
                        cancelText="Nie"
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} size="small" />}
                      title={
                        <Space>
                          <Text strong>{c.author}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs.utc(c.created_at).local().format("YYYY-MM-DD HH:mm")}
                          </Text>
                        </Space>
                      }
                      description={
                        editingComment?.id === c.id ? (
                          <Space.Compact style={{ width: "100%" }}>
                            <Input.TextArea
                              rows={2}
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              autoFocus
                            />
                            <Space style={{ marginTop: 4 }}>
                              <Button
                                size="small"
                                type="primary"
                                loading={editCommentMutation.isPending}
                                disabled={!editBody.trim()}
                                onClick={() => editCommentMutation.mutate({ id: c.id, body: editBody.trim() })}
                              >Zapisz</Button>
                              <Button size="small" onClick={() => setEditingComment(null)}>Anuluj</Button>
                            </Space>
                          </Space.Compact>
                        ) : (
                          <span>{renderWithLinks(c.body)}</span>
                        )
                      }
                    />
                  </List.Item>
                )}
              />
            )}

            {/* Add comment */}
            <Space.Compact style={{ width: "100%" }}>
              <TextArea
                rows={2}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                style={{ flexGrow: 1 }}
              />
            </Space.Compact>
            <Button
              type="primary"
              style={{ marginTop: 8 }}
              loading={commentMutation.isPending}
              disabled={!commentBody.trim()}
              onClick={() => commentMutation.mutate(commentBody.trim())}
            >
              Send
            </Button>
          </>
        )}
      </Drawer>

      <AckModal alert={ackTarget} onClose={() => setAckTarget(null)} />
    </>
  );
};
