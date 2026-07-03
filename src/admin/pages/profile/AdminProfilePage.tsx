import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Message, Space, Typography } from '@arco-design/web-react';
import { IconSave, IconUser } from '@arco-design/web-react/icon';
import { adminGet, adminPut } from '../../api/adminClient';
import { AdminPageContainer } from '../../layout/AdminPageContainer';

const FormItem = Form.Item;

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
  GUEST: '访客',
};

export function AdminProfilePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

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

        <Form form={form} layout="vertical">
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
