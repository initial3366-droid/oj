import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Select, Space, Switch, Typography } from '@arco-design/web-react';
import { IconRefresh, IconSave } from '@arco-design/web-react/icon';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import { adminGet, adminPut } from '../../api/adminClient';
import { toast } from '../../utils/toast';

type AgentSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  model: string;
  reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high';
};

const defaults: AgentSettings = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  model: '',
  reasoningEffort: 'medium',
};

export function AdminAiSettingsPage() {
  const [form] = Form.useForm<AgentSettings>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminGet<AgentSettings>('/api/admin/v1/settings/system/agent');
      form.setFieldsValue({ ...defaults, ...data, apiKey: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 配置加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (values: AgentSettings) => {
    setSaving(true);
    try {
      await adminPut('/api/admin/v1/settings/system/agent', {
        enabled: values.enabled,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey?.trim() || '',
        model: values.model.trim(),
        reasoningEffort: values.reasoningEffort,
      });
      toast.success('AI 配置已保存');
      form.setFieldValue('apiKey', '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageContainer
      title="AI 控制台 · 配置"
      loading={loading}
      extra={<Space><Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button><Button type="primary" icon={<IconSave />} onClick={() => form.submit()} loading={saving}>保存</Button></Space>}
    >
      <Card bordered={false} style={{ maxWidth: 860 }}>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          配置将用于后台聊天和独立 Java 出题 Agent。模型需支持 OpenAI 兼容 Chat Completions、JSON Schema 输出，以及 Responses API 的联网搜索；服务地址填写包含版本路径的 Base URL，例如 https://api.openai.com/v1。
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onSubmit={save} requiredSymbol={false} initialValues={defaults}>
          <Form.Item label="启用 Agent" field="enabled" triggerPropName="checked"><Switch /></Form.Item>
          <Form.Item label="Base URL" field="baseUrl" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item label="API Key" field="apiKey" extra="留空表示保留已保存的密钥">
            <Input.Password placeholder="请输入 API Key" />
          </Form.Item>
          <Form.Item label="模型" field="model" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="gpt-5" />
          </Form.Item>
          <Form.Item label="推理强度" field="reasoningEffort" extra="对应 Responses API 的 reasoning.effort">
            <Select options={[{ value: 'none', label: 'none' }, { value: 'minimal', label: 'minimal' }, { value: 'low', label: 'low' }, { value: 'medium', label: 'medium' }, { value: 'high', label: 'high' }]} />
          </Form.Item>
        </Form>
      </Card>
    </AdminPageContainer>
  );
}
