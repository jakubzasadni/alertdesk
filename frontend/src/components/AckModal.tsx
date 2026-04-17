import React, { useState } from "react";
import { Modal, Form, Input, Button, Typography, Select } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsApi } from "@/api/alerts";
import { useAuthStore } from "@/store/auth";
import type { AlertListItem } from "@/types";

const TEAM = [
  "Jakub Zasadni",
  "Maciej Tulecki",
  "Radosław Brania",
  "Kamil Jagielski",
  "Dawid Honkisz",
  "Arkadiusz Ryba",
  "Konrad Matyas",
];

const { Text } = Typography;

interface Props {
  alert: AlertListItem | null;
  onCallPerson?: string;
  onClose: () => void;
}

export const AckModal: React.FC<Props> = ({ alert, onCallPerson, onClose }) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { displayName } = useAuthStore();

  // Priority: on-call person from calendar → logged-in user → first in team
  const defaultPerson = (onCallPerson && TEAM.includes(onCallPerson) ? onCallPerson : null)
    ?? (TEAM.includes(displayName || "") ? displayName : TEAM[0]);

  const mutation = useMutation({
    mutationFn: ({ fingerprint, comment, acknowledgedBy }: { fingerprint: string; comment?: string; acknowledgedBy: string }) =>
      alertsApi.acknowledge(fingerprint, comment, acknowledgedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", alert?.fingerprint] });
      form.resetFields();
      onClose();
    },
  });

  const onFinish = (values: { comment?: string; acknowledgedBy: string }) => {
    if (!alert) return;
    mutation.mutate({ fingerprint: alert.fingerprint, comment: values.comment, acknowledgedBy: values.acknowledgedBy });
  };

  return (
    <Modal
      open={!!alert}
      title={
        <span>
          <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
          Acknowledge Alert
        </span>
      }
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {alert && (
        <>
          <Text type="secondary">Alert: </Text>
          <Text strong>{alert.alertname}</Text>
          {alert.namespace && (
            <>
              <br />
              <Text type="secondary">Namespace: </Text>
              <Text>{alert.namespace}</Text>
            </>
          )}
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            style={{ marginTop: 16 }}
            initialValues={{ acknowledgedBy: defaultPerson }}
          >
            <Form.Item name="acknowledgedBy" label="Assign to" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label"
                options={TEAM.map((name) => ({ value: name, label: name }))}
              />
            </Form.Item>
            <Form.Item name="comment" label="Comment (optional)">
              <Input.TextArea rows={3} placeholder="Describe what you did or plan to do…" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
              <Button onClick={onClose} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={mutation.isPending}
                icon={<CheckCircleOutlined />}
              >
                Acknowledge
              </Button>
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};
