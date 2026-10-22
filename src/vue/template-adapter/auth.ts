import { adminPost, setAdminToken } from '../../admin/api/adminClient';
import { teacherLogin } from '../../teacher/teacherApi';
import { adminPath } from '../../utils/adminPath';
import type { LoginRequest, CaptchaInfo, QrCodeGenerateResult, QrCodeStatusResult } from '../../../vendor/vue3-element-admin/src/api/auth/types';
export type { LoginRequest, CaptchaInfo, QrCodeGenerateResult, QrCodeStatusResult };
export async function login(data: LoginRequest) {
  if (location.pathname.startsWith('/teacher/')) {
    await teacherLogin(data.username, data.password, data.captchaId || "", data.captchaCode || "");
    return;
  }
  const tokens = await adminPost<{ accessToken: string; refreshToken: string }>('/api/admin/v1/auth/login', { username: data.username, password: data.password, captchaId: data.captchaId, captcha: data.captchaCode, rememberMe: data.rememberMe }, false);
  setAdminToken(tokens.accessToken, tokens.refreshToken, data.rememberMe);
}
export function loginHome() { return location.pathname.startsWith('/teacher/') ? '/teacher/dashboard' : adminPath('/dashboard'); }
export default {
  async getCaptcha(): Promise<CaptchaInfo> {
    const response = await fetch('/api/v1/captcha/image');
    const result = await response.json();
    if (!response.ok || result.code !== 200) throw new Error(result.message || '验证码加载失败');
    return { captchaId: result.data.captchaId, captchaBase64: result.data.image };
  },
  async qrGenerate(): Promise<QrCodeGenerateResult> { throw new Error('QOJ 尚未提供扫码登录接口，请使用账号密码登录'); },
  async qrStatus(_ticket: string): Promise<QrCodeStatusResult> { throw new Error('QOJ 尚未提供扫码登录接口'); },
};
