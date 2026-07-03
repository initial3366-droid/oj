import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Message, Space, Typography } from '@arco-design/web-react';
import { IconSave, IconUser } from '@arco-design/web-react/icon';
import { teacherGet, teacherPut, type TeacherMe } from '../teacherApi';

const FormItem = Form.Item;

export function TeacherProfilePage() {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [me, setMe] = useState<TeacherMe | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const result = await teacherGet<TeacherMe>('/api/teacher/v1/me');
      setMe(result);
      profileForm.setFieldsValue({ displayName: result.displayName });
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
      else Message.error('加载个人信息失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    try {
      const values = await profileForm.validate();
      setSavingProfile(true);
      await teacherPut('/api/teacher/v1/me/profile', {
        displayName: values.displayName.trim(),
      });
      Message.success('姓名已更新');
      await loadProfile();
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    try {
      const values = await passwordForm.validate();
      if (values.newPassword !== values.confirmPassword) {
        Message.error('两次输入的新密码不一致');
        return;
      }
      setSavingPassword(true);
      await teacherPut('/api/teacher/v1/me/password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      Message.success('密码已修改');
      passwordForm.resetFields();
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className={loading ? 'arco-loading' : undefined}>
      <Card title="个人信息" style={{ marginBottom: 16 }} loading={loading} bordered={false}>
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
            {me?.displayName?.charAt(0) || <IconUser />}
          </div>
          <div>
            <Typography.Title heading={4} style={{ margin: 0 }}>
              {me?.displayName || '-'}
            </Typography.Title>
            <Typography.Text type="secondary">教师 · @{me?.username}</Typography.Text>
          </div>
        </div>

        <Form form={profileForm} layout="vertical">
          <FormItem label="用户名">
            <Input value={me?.username} disabled />
          </FormItem>
          <FormItem
            label="姓名"
            field="displayName"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" maxLength={80} />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" icon={<IconSave />} loading={savingProfile} onClick={handleSaveProfile}>
                保存修改
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card title="修改密码" bordered={false}>
        <Form form={passwordForm} layout="vertical">
          <FormItem
            label="当前密码"
            field="oldPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="当前密码" />
          </FormItem>
          <FormItem
            label="新密码"
            field="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { minLength: 6, message: '密码长度至少 6 位' },
              { maxLength: 20, message: '密码长度不超过 20 位' },
            ]}
          >
            <Input.Password placeholder="6-20 位新密码" />
          </FormItem>
          <FormItem
            label="确认新密码"
            field="confirmPassword"
            rules={[{ required: true, message: '请确认新密码' }]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" icon={<IconSave />} loading={savingPassword} onClick={handleChangePassword}>
                修改密码
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>
    </div>
  );
}