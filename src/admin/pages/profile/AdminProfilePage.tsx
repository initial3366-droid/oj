/**
 * 管理员资料页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Message, Space, Typography } from '@arco-design/web-react';
import { IconSave, IconUser } from '@arco-design/web-react/icon';
import { adminGet, adminPut } from '../../api/adminClient';
import { AdminPageContainer } from '../../layout/AdminPageContainer';

const FormItem = Form.Item;

/**
 * 用户资料接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  role: string;
}

const roleNames: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  TEACHER: '教师',
  STUDENT: '学生',
};

/**
 * 渲染管理员资料页面，并协调其数据加载、状态和交互。
 */
export function AdminProfilePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  /**
   * 读取资料并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function loadProfile() {
    setLoading(true);
    try {
      const result = await adminGet<UserProfile>('/api/admin/v1/me');
      setUser(result);
      form.setFieldsValue({
        displayName: result.displayName,
        email: result.email || '',
      });
    } catch (error) {
      Message.error('加载个人信息失败');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理Save。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function handleSave() {
    try {
      const values = await form.validate();
      setSaving(true);
      await adminPut('/api/admin/v1/me', {
        displayName: values.displayName.trim(),
        email: values.email?.trim() || '',
      });
      Message.success('个人信息已更新');
      loadProfile();
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageContainer title="个人信息" loading={loading}>
      <Card style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#165dff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 28,
            }}
          >
            {user?.displayName?.charAt(0) || <IconUser />}
          </div>
          <div>
            <Typography.Title heading={4} style={{ margin: 0 }}>
              {user?.displayName}
            </Typography.Title>
            <Typography.Text type="secondary">
              {roleNames[user?.role || ''] || user?.role} · @{user?.username}
            </Typography.Text>
          </div>
        </div>

        <Form form={form} layout="vertical" requiredSymbol={false}>
          <FormItem label="用户名">
            <Input value={user?.username} disabled />
          </FormItem>
          <FormItem label="角色">
            <Input value={roleNames[user?.role || ''] || user?.role} disabled />
          </FormItem>
          <FormItem
            label="显示名称"
            field="displayName"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="显示名称" maxLength={50} />
          </FormItem>
          <FormItem label="邮箱" field="email">
            <Input placeholder="邮箱（可选）" maxLength={100} />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" icon={<IconSave />} loading={saving} onClick={handleSave}>
                保存修改
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>
    </AdminPageContainer>
  );
}
