/**
 * 管理员登录页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Form, Input, Button } from '@arco-design/web-react';
import { IconLock, IconUser, IconSafe } from '@arco-design/web-react/icon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminPost, clearAdminToken, setAdminToken } from '../../api/adminClient';
import { toast } from '../../utils/toast';
import { adminPath } from '../../../utils/adminPath';
import './AdminLoginPage.css';

const FormItem = Form.Item;

/**
 * 登录Form接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface LoginForm {
  username: string;
  password: string;
  captcha: string;
}

/**
 * 登录响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * 读取Captcha并返回给调用方。包含异步流程并由调用方处理完成或失败状态；失败时向调用方传播异常。
 */
async function fetchCaptcha(): Promise<{ captchaId: string; image: string }> {
  const response = await fetch('/api/v1/captcha/image');
  const body = await response.json();
  if (body.code !== 200) throw new Error(body.message || '验证码加载失败');
  return body.data;
}

/**
 * 渲染管理员登录页面，并协调其数据加载、状态和交互。
 */
export function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginForm>();
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');

  /**
   * 读取Captcha并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function loadCaptcha() {
    try {
      const data = await fetchCaptcha();
      setCaptchaId(data.captchaId);
      setCaptchaImage(data.image);
    } catch {
      toast.error('验证码加载失败，请刷新页面重试');
    }
  }

  useEffect(() => {
    clearAdminToken();
    loadCaptcha();
  }, []);

  /**
   * 处理Submit。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function handleSubmit(values: LoginForm) {
    if (!captchaId) {
      toast.error('验证码未加载，请点击刷新');
      return;
    }
    setLoading(true);
    try {
      const result = await adminPost<LoginResponse>(
        '/api/admin/v1/auth/login',
        {
          username: values.username,
          password: values.password,
          captchaId,
          captcha: values.captcha,
        },
        false // 登录接口不需要 token
      );

      setAdminToken(result.accessToken, result.refreshToken);

      toast.success('登录成功');
      navigate(adminPath('/dashboard'), { replace: true });
    } catch (error) {
      console.error('登录失败:', error);
      toast.error(error instanceof Error ? error.message : '登录失败，请重试');
      // 登录失败刷新验证码
      loadCaptcha();
      form.setFieldValue('captcha', '');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__header">
          <h1 className="admin-login__title">后台管理系统</h1>
          <p className="admin-login__subtitle">请使用管理员账号登录</p>
        </div>

        <Form
          form={form}
          onSubmit={handleSubmit}
          autoComplete="off"
          layout="vertical"
          requiredSymbol={false}
          className="admin-login__form"
        >
          <FormItem
            field="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<IconUser />}
              placeholder="用户名"
              size="large"
            />
          </FormItem>

          <FormItem
            field="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<IconLock />}
              placeholder="密码"
              size="large"
            />
          </FormItem>

          <FormItem
            field="captcha"
            rules={[{ required: true, message: '请输入验证码' }]}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Input
                prefix={<IconSafe />}
                placeholder="验证码"
                size="large"
                maxLength={4}
                style={{ flex: 1 }}
                onChange={(v) => form.setFieldValue('captcha', v)}
              />
              {captchaImage ? (
                <img
                  src={captchaImage}
                  alt="验证码"
                  onClick={loadCaptcha}
                  title="点击刷新验证码"
                  style={{
                    height: 40,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '1px solid #e5e6eb',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Button size="large" onClick={loadCaptcha} style={{ flexShrink: 0 }}>
                  加载验证码
                </Button>
              )}
            </div>
          </FormItem>

          <FormItem>
            <Button
              type="primary"
              htmlType="submit"
              long
              size="large"
              loading={loading}
            >
              登录
            </Button>
          </FormItem>
        </Form>

        <div className="admin-login__footer">
          <a href="/" className="admin-login__link">返回前台</a>
        </div>
      </div>
    </div>
  );
}
