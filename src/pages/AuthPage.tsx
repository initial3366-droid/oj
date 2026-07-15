/**
 * 认证页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Button, Card, Typography, Input, Toast, Modal } from '@douyinfe/semi-ui';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { bindEmail, fetchMe, loginWithoutPersist, register, resetPassword, saveFrontendAuthTokens } from '../data/apiClient';
import { useOjData } from '../data/OjDataProvider';
import type { AuthTokenResponse } from '../data/apiClient';
import { safeSameOriginPath } from '../utils/safeRedirect';
import './AuthPage.css';

/**
 * 渲染认证页面，并协调其数据加载、状态和交互。
 */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useOjData();
  const [message, setMessage] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindMessage, setBindMessage] = useState('');
  const [bindEmailCountdown, setBindEmailCountdown] = useState(0);
  const [bindCaptchaImage, setBindCaptchaImage] = useState('');
  const [bindCaptchaId, setBindCaptchaId] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [pendingAuth, setPendingAuth] = useState<AuthTokenResponse | null>(null);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetEmailCountdown, setResetEmailCountdown] = useState(0);
  const [resetCaptchaImage, setResetCaptchaImage] = useState('');
  const [resetCaptchaId, setResetCaptchaId] = useState('');
  const [resetForm, setResetForm] = useState({
    email: '',
    captcha: '',
    emailVerificationCode: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [form, setForm] = useState({
    username: '',
    studentNo: '',
    email: '',
    password: '',
    confirmPassword: '',
    captcha: '',
    emailVerificationCode: '',
  });
  const [bindForm, setBindForm] = useState({
    email: '',
    captcha: '',
    emailVerificationCode: '',
  });
  const isRegister = mode === 'register';

  /**
   * 封装标题相关逻辑。对原始数据进行派生或聚合。
   */
  const title = useMemo(() => (isRegister ? '注册账号' : '登录账号'), [isRegister]);
  /**
   * 封装redirectPath相关逻辑。对原始数据进行派生或聚合。
   */
  const redirectPath = useMemo(
    () => safeSameOriginPath(searchParams.get('redirect'), '/user-center'),
    [searchParams],
  );
  const redirectQuery = redirectPath === '/user-center' ? '' : `?redirect=${encodeURIComponent(redirectPath)}`;

  // 如果已登录，重定向到用户中心
  useEffect(() => {
    if (state.activeUser !== null) {
      Toast.info('您已登录');
      navigate(redirectPath);
    }
  }, [state.activeUser, navigate, redirectPath]);

  useEffect(() => {
    if (isRegister) {
      fetchCaptcha();
      // 检查邮箱验证码的剩余时间
      if (form.email) {
        checkEmailRemaining();
      }
    }
  }, [isRegister]);

  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  useEffect(() => {
    if (bindEmailCountdown > 0) {
      const timer = setTimeout(() => setBindEmailCountdown(bindEmailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [bindEmailCountdown]);

  useEffect(() => {
    if (resetEmailCountdown > 0) {
      const timer = setTimeout(() => setResetEmailCountdown(resetEmailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetEmailCountdown]);

  /**
   * 校验EmailRemaining。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const checkEmailRemaining = async () => {
    if (!form.email) return;
    try {
      const response = await fetch(`/api/v1/captcha/email/remaining?email=${encodeURIComponent(form.email)}`);
      const result = await response.json();
      if (result.code === 200 && result.data.remainingSeconds > 0) {
        setEmailCountdown(result.data.remainingSeconds);
      }
    } catch (error) {
      // 忽略错误
    }
  };

  /**
   * 读取Captcha并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const fetchCaptcha = async () => {
    try {
      const response = await fetch('/api/v1/captcha/image');
      const result = await response.json();
      if (result.code === 200) {
        setCaptchaImage(result.data.image);
        setCaptchaId(result.data.captchaId);
      }
    } catch (error) {
      setMessage('验证码加载失败');
    }
  };

  /**
   * 读取BindCaptcha并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const fetchBindCaptcha = async () => {
    try {
      const response = await fetch('/api/v1/captcha/image');
      const result = await response.json();
      if (result.code === 200) {
        setBindCaptchaImage(result.data.image);
        setBindCaptchaId(result.data.captchaId);
      }
    } catch {
      setBindMessage('验证码加载失败');
    }
  };

  /**
   * 发送BindEmail编码。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const sendBindEmailCode = async () => {
    setBindMessage('');
    if (!bindForm.email) {
      setBindMessage('请先输入邮箱');
      return;
    }
    if (!bindForm.captcha || !bindCaptchaId) {
      setBindMessage('请先输入图形验证码');
      return;
    }
    try {
      const response = await fetch('/api/v1/captcha/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: bindForm.email,
          captchaId: bindCaptchaId,
          captcha: bindForm.captcha,
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setBindMessage('验证码已发送到您的邮箱');
        setBindEmailCountdown(result.data.remainingSeconds || 60);
        fetchBindCaptcha();
      } else {
        setBindMessage(result.message || '发送失败');
        fetchBindCaptcha();
      }
    } catch {
      setBindMessage('发送失败，请稍后重试');
      fetchBindCaptcha();
    }
  };

  /**
   * 读取ResetCaptcha并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const fetchResetCaptcha = async () => {
    try {
      const response = await fetch('/api/v1/captcha/image');
      const result = await response.json();
      if (result.code === 200) {
        setResetCaptchaImage(result.data.image);
        setResetCaptchaId(result.data.captchaId);
      }
    } catch {
      setResetMessage('验证码加载失败');
    }
  };

  /**
   * 发送ResetEmail编码。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const sendResetEmailCode = async () => {
    setResetMessage('');
    if (!resetForm.email) {
      setResetMessage('请先输入邮箱');
      return;
    }
    if (!resetForm.captcha || !resetCaptchaId) {
      setResetMessage('请先输入图形验证码');
      return;
    }
    try {
      const response = await fetch('/api/v1/captcha/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetForm.email,
          captchaId: resetCaptchaId,
          captcha: resetForm.captcha,
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setResetMessage('验证码已发送到您的邮箱');
        setResetEmailCountdown(result.data.remainingSeconds || 60);
        fetchResetCaptcha();
      } else {
        setResetMessage(result.message || '发送失败');
        fetchResetCaptcha();
      }
    } catch {
      setResetMessage('发送失败，请稍后重试');
      fetchResetCaptcha();
    }
  };

  /**
   * 创建或提交ResetPassword。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const submitResetPassword = async () => {
    setResetMessage('');
    if (!resetForm.email || !resetForm.emailVerificationCode) {
      setResetMessage('请输入邮箱和邮箱验证码');
      return;
    }
    if (resetForm.newPassword.length < 6 || resetForm.newPassword.length > 20) {
      setResetMessage('新密码长度必须在6-20之间');
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setResetMessage('两次密码不一致');
      return;
    }
    try {
      setResetLoading(true);
      await resetPassword({
        email: resetForm.email,
        emailVerificationCode: resetForm.emailVerificationCode,
        newPassword: resetForm.newPassword,
      });
      setResetMessage('密码重置成功，请使用新密码登录');
      setResetLoading(false);
      setTimeout(() => {
        setResetModalVisible(false);
        setResetForm({ email: '', captcha: '', emailVerificationCode: '', newPassword: '', confirmPassword: '' });
        setResetMessage('');
      }, 3000);
    } catch (error) {
      setResetMessage(error instanceof Error ? error.message : '重置失败');
      setResetLoading(false);
      fetchResetCaptcha();
    }
  };

  /**
   * 创建或提交BindEmail。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  const submitBindEmail = async () => {
    setBindMessage('');
    if (!pendingToken) return;
    if (!bindForm.email || !bindForm.emailVerificationCode) {
      setBindMessage('请输入邮箱和邮箱验证码');
      return;
    }
    try {
      setBindLoading(true);
      await bindEmail({
        email: bindForm.email,
        emailVerificationCode: bindForm.emailVerificationCode,
      }, pendingToken);
      if (pendingAuth) {
        saveFrontendAuthTokens(pendingAuth);
      }
      Toast.success('邮箱绑定成功');
      setBindModalVisible(false);
      window.location.href = redirectPath;
    } catch (error) {
      setBindMessage(error instanceof Error ? error.message : '绑定失败');
      fetchBindCaptcha();
    } finally {
      setBindLoading(false);
    }
  };

  /**
   * 发送Email编码。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const sendEmailCode = async () => {
    if (!form.email) {
      setMessage('请先输入邮箱');
      return;
    }
    if (!form.captcha || !captchaId) {
      setMessage('请先输入图形验证码');
      return;
    }
    try {
      const response = await fetch('/api/v1/captcha/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          captchaId: captchaId,
          captcha: form.captcha
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setMessage('验证码已发送到您的邮箱');
        setEmailCountdown(result.data.remainingSeconds || 60);
        // 刷新图形验证码
        fetchCaptcha();
      } else {
        setMessage(result.message || '发送失败');
        // 发送失败也刷新图形验证码
        fetchCaptcha();
      }
    } catch (error) {
      setMessage('发送失败，请稍后重试');
      fetchCaptcha();
    }
  };

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数；会读写浏览器本地会话信息。
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (isRegister) {
        // 前端验证
        if (form.username.length < 3 || form.username.length > 15) {
          setMessage('用户名长度必须在3-15之间');
          return;
        }
        if (form.password.length < 6 || form.password.length > 20) {
          setMessage('密码长度必须在6-20之间');
          return;
        }
        if (form.password !== form.confirmPassword) {
          setMessage('两次密码不一致');
          return;
        }
        if (!form.emailVerificationCode) {
          setMessage('请输入邮箱验证码');
          return;
        }
        const auth = await register({
          username: form.username,
          studentNo: form.studentNo,
          email: form.email,
          password: form.password,
          emailVerificationCode: form.emailVerificationCode,
        });
        window.localStorage.setItem('qoj.accessToken', auth.accessToken);
        window.localStorage.setItem('qoj.refreshToken', auth.refreshToken);
        Toast.success('注册成功');
      } else {
        const auth = await loginWithoutPersist(form.username, form.password);
        const me = await fetchMe(auth.accessToken);
        if (!me.email) {
          window.localStorage.removeItem('qoj.accessToken');
          window.localStorage.removeItem('qoj.refreshToken');
          setPendingToken(auth.accessToken);
          setPendingAuth(auth);
          setBindForm({ email: '', captcha: '', emailVerificationCode: '' });
          setBindMessage('');
          setBindModalVisible(true);
          fetchBindCaptcha();
          return;
        }
        saveFrontendAuthTokens(auth);
        Toast.success('登录成功');
      }
      // 刷新页面以重新加载用户状态
      window.location.href = redirectPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      if (errorMessage.includes('后台账号')) {
        window.localStorage.removeItem('qoj.accessToken');
        window.localStorage.removeItem('qoj.refreshToken');
      }
      setMessage(errorMessage);
      if (isRegister) {
        fetchCaptcha();
      }
    }
  };

  return (
    <div className={`auth-page ${isRegister ? 'auth-page--register' : 'auth-page--login'}`}>
      <div className="auth-card">
        {/* Gradient header */}
        <div className="auth-header">
          <div className="auth-header-title">{title}</div>
        </div>

        {/* Form body */}
        <div className="auth-body">
          <form onSubmit={submit} className="auth-form">
            {/* Username */}
            <div className="auth-field">
              <label className="auth-label">
                用户名 <span className="auth-required">*</span>
              </label>
              <Input
                placeholder={isRegister ? "请输入用户名（3-15个字符）" : "请输入用户名"}
                value={form.username}
                onChange={(username) => setForm({ ...form, username })}
              />
            </div>

            {/* Register-only: student number + email */}
            {isRegister && (
              <div className="auth-register-section">
                <div className="auth-field">
                  <label className="auth-label">学号</label>
                  <Input
                    placeholder="请输入学号"
                    value={form.studentNo}
                    onChange={(studentNo) => setForm({ ...form, studentNo })}
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label">邮箱</label>
                  <Input
                    placeholder="请输入邮箱"
                    value={form.email}
                    onChange={(email) => setForm({ ...form, email })}
                    onBlur={checkEmailRemaining}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label">
                密码 <span className="auth-required">*</span>
              </label>
              <Input
                type="password"
                mode="password"
                placeholder={isRegister ? "请输入密码（6-20个字符）" : "请输入密码"}
                value={form.password}
                onChange={(password) => setForm({ ...form, password })}
              />
            </div>

            {/* Register-only: confirm password + captcha + email code */}
            {isRegister && (
              <div className="auth-register-section">
                <div className="auth-field">
                  <label className="auth-label">确认密码</label>
                  <Input
                    type="password"
                    mode="password"
                    placeholder="请确认密码"
                    value={form.confirmPassword}
                    onChange={(confirmPassword) => setForm({ ...form, confirmPassword })}
                  />
                </div>

                <div className="auth-grid-captcha">
                  <div className="auth-field">
                    <label className="auth-label">验证码</label>
                    <Input
                      placeholder="请输入验证码"
                      value={form.captcha}
                      onChange={(value) => setForm({ ...form, captcha: value })}
                    />
                  </div>
                  {captchaImage && (
                    <img
                      src={captchaImage}
                      alt="验证码"
                      className="auth-captcha-img"
                      onClick={fetchCaptcha}
                    />
                  )}
                </div>

                <div className="auth-grid-email-code">
                  <div className="auth-field">
                    <label className="auth-label">
                      邮箱验证码 <span className="auth-required">*</span>
                    </label>
                    <Input
                      placeholder="请输入邮箱验证码"
                      value={form.emailVerificationCode}
                      onChange={(value) => setForm({ ...form, emailVerificationCode: value })}
                    />
                  </div>
                  <Button
                    type="primary"
                    className="auth-btn-send-code"
                    onClick={sendEmailCode}
                    disabled={emailCountdown > 0}
                  >
                    {emailCountdown > 0 ? `${emailCountdown}秒后重试` : '发送验证码'}
                  </Button>
                </div>
              </div>
            )}

            {/* Error / success message */}
            {message && (
              <div className={`auth-message ${message.includes('已发送') ? 'auth-message--success' : 'auth-message--error'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {message.includes('已发送') ? (
                    <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
                  ) : (
                    <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                  )}
                </svg>
                {message}
              </div>
            )}

            {/* Submit button */}
            <Button
              type="primary"
              htmlType="submit"
              block
              className="auth-btn-primary"
            >
              {title}
            </Button>

            {/* Forgot password link (login mode only) */}
            {!isRegister && (
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <Button
                  type="tertiary"
                  theme="borderless"
                  size="small"
                  style={{ color: '#86909c', fontSize: 13 }}
                  onClick={() => {
                    setResetForm({ email: '', captcha: '', emailVerificationCode: '', newPassword: '', confirmPassword: '' });
                    setResetMessage('');
                    setResetModalVisible(true);
                    fetchResetCaptcha();
                  }}
                >
                  找回密码
                </Button>
              </div>
            )}

            {/* Toggle between login / register */}
            <Button
              type="primary"
              block
              className="auth-btn-toggle"
              onClick={() => {
                window.location.href = `${isRegister ? '/login' : '/register'}${redirectQuery}`;
              }}
            >
              {isRegister ? '已有账号，去登录' : '没有账号，去注册'}
            </Button>
          </form>
        </div>
      </div>

      {/* Bind email modal */}
      <Modal
        title="绑定邮箱"
        visible={bindModalVisible}
        closable={false}
        maskClosable={false}
        okText="绑定"
        confirmLoading={bindLoading}
        onOk={submitBindEmail}
        cancelButtonProps={{ style: { display: 'none' } }}
        className="auth-bind-modal"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          当前账号还没有绑定邮箱，请绑定邮箱后继续使用。
        </Typography.Paragraph>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            placeholder="请输入邮箱"
            value={bindForm.email}
            onChange={(email) => setBindForm({ ...bindForm, email })}
          />
          <div className="auth-bind-modal-grid-captcha">
            <Input
              placeholder="请输入图形验证码"
              value={bindForm.captcha}
              onChange={(captcha) => setBindForm({ ...bindForm, captcha })}
            />
            {bindCaptchaImage && (
              <img
                src={bindCaptchaImage}
                alt="验证码"
                className="auth-bind-modal-captcha-img"
                onClick={fetchBindCaptcha}
              />
            )}
          </div>
          <div className="auth-bind-modal-grid-code">
            <Input
              placeholder="请输入邮箱验证码"
              value={bindForm.emailVerificationCode}
              onChange={(emailVerificationCode) => setBindForm({ ...bindForm, emailVerificationCode })}
            />
            <Button type="primary" onClick={sendBindEmailCode} disabled={bindEmailCountdown > 0}>
              {bindEmailCountdown > 0 ? `${bindEmailCountdown}秒后重试` : '发送验证码'}
            </Button>
          </div>
          {bindMessage && (
            <Typography.Text type={bindMessage.includes('已发送') ? 'success' : 'danger'} style={{ fontSize: 14 }}>
              {bindMessage}
            </Typography.Text>
          )}
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        title="找回密码"
        visible={resetModalVisible}
        width={520}
        onCancel={() => setResetModalVisible(false)}
        okText="重置密码"
        confirmLoading={resetLoading}
        onOk={submitResetPassword}
        cancelButtonProps={{ style: { display: 'none' } }}
        className="auth-bind-modal auth-reset-modal"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          请输入注册时使用的邮箱，通过邮箱验证码验证身份后重置密码。
        </Typography.Paragraph>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            placeholder="请输入注册邮箱"
            value={resetForm.email}
            onChange={(email) => setResetForm({ ...resetForm, email })}
          />
          <div className="auth-bind-modal-grid-captcha">
            <Input
              placeholder="请输入图形验证码"
              value={resetForm.captcha}
              onChange={(captcha) => setResetForm({ ...resetForm, captcha })}
            />
            {resetCaptchaImage && (
              <img
                src={resetCaptchaImage}
                alt="验证码"
                className="auth-bind-modal-captcha-img"
                onClick={fetchResetCaptcha}
              />
            )}
          </div>
          <div className="auth-bind-modal-grid-code">
            <Input
              placeholder="请输入邮箱验证码"
              value={resetForm.emailVerificationCode}
              onChange={(emailVerificationCode) => setResetForm({ ...resetForm, emailVerificationCode })}
            />
            <Button
              type="primary"
              className="auth-modal-send-code"
              onClick={sendResetEmailCode}
              disabled={resetEmailCountdown > 0}
            >
              {resetEmailCountdown > 0 ? `${resetEmailCountdown}秒后重试` : '发送验证码'}
            </Button>
          </div>
          <Input
            type="password"
            mode="password"
            placeholder="请输入新密码（6-20个字符）"
            value={resetForm.newPassword}
            onChange={(newPassword) => setResetForm({ ...resetForm, newPassword })}
          />
          <Input
            type="password"
            mode="password"
            placeholder="请确认新密码"
            value={resetForm.confirmPassword}
            onChange={(confirmPassword) => setResetForm({ ...resetForm, confirmPassword })}
          />
          {resetMessage && (
            <Typography.Text type={resetMessage.includes('已发送') || resetMessage.includes('成功') ? 'success' : 'danger'} style={{ fontSize: 14 }}>
              {resetMessage}
            </Typography.Text>
          )}
        </div>
      </Modal>
    </div>
  );
}
