<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { clearFrontendTokens } from "../../../api/authSession";
import { bindEmail, fetchMe, loginWithoutPersist, register, resetPassword, saveFrontendAuthTokens, type AuthTokenResponse } from "../../../data/apiClient";
import { useOjDataStore } from "../../stores/ojData";
import { safeSameOriginPath } from "../../../utils/safeRedirect";
import "../../../pages/AuthPage.css";

const props = defineProps<{ mode: "login" | "register" }>();
const route = useRoute();
const router = useRouter();
const ojData = useOjDataStore();
const isRegister = computed(() => props.mode === "register");
const title = computed(() => isRegister.value ? "注册账号" : "登录账号");
const redirectPath = computed(() => safeSameOriginPath(typeof route.query.redirect === "string" ? route.query.redirect : null, "/user-center"));
const redirectQuery = computed(() => redirectPath.value === "/user-center" ? "" : `?redirect=${encodeURIComponent(redirectPath.value)}`);
const message = ref("");
const submitting = ref(false);
const rememberMe = ref(false);
const pendingRememberMe = ref(false);
const captchaImage = ref("");
const captchaId = ref("");
const emailCountdown = ref(0);
const bindModalVisible = ref(false);
const bindLoading = ref(false);
const bindMessage = ref("");
const bindEmailCountdown = ref(0);
const bindCaptchaImage = ref("");
const bindCaptchaId = ref("");
const pendingToken = ref("");
const pendingAuth = ref<AuthTokenResponse | null>(null);
const resetModalVisible = ref(false);
const resetLoading = ref(false);
const resetMessage = ref("");
const resetEmailCountdown = ref(0);
const resetCaptchaImage = ref("");
const resetCaptchaId = ref("");
const form = reactive({ username: "", studentNo: "", email: "", password: "", confirmPassword: "", captcha: "", emailVerificationCode: "" });
const bindForm = reactive({ email: "", captcha: "", emailVerificationCode: "" });
const resetForm = reactive({ email: "", captcha: "", emailVerificationCode: "", newPassword: "", confirmPassword: "" });

function countdown(source: Ref<number>) {
  watch(source, (seconds, _previous, onCleanup) => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => { if (source.value === seconds) source.value -= 1; }, 1000);
    onCleanup(() => window.clearTimeout(timer));
  });
}
countdown(emailCountdown);
countdown(bindEmailCountdown);
countdown(resetEmailCountdown);

async function getCaptcha() {
  const response = await fetch("/api/v1/captcha/image");
  const result = await response.json();
  if (!response.ok || result.code !== 200 || !result.data?.captchaId) throw new Error(result.message || "验证码加载失败");
  return { id: result.data.captchaId as string, image: result.data.image as string };
}
async function fetchCaptcha() {
  try { const captcha = await getCaptcha(); captchaImage.value = captcha.image; captchaId.value = captcha.id; form.captcha = ""; }
  catch { message.value = "验证码加载失败"; }
}
async function fetchBindCaptcha() {
  try { const captcha = await getCaptcha(); bindCaptchaImage.value = captcha.image; bindCaptchaId.value = captcha.id; bindForm.captcha = ""; }
  catch { bindMessage.value = "验证码加载失败"; }
}
async function fetchResetCaptcha() {
  try { const captcha = await getCaptcha(); resetCaptchaImage.value = captcha.image; resetCaptchaId.value = captcha.id; resetForm.captcha = ""; }
  catch { resetMessage.value = "验证码加载失败"; }
}
async function checkEmailRemaining() {
  if (!form.email) return;
  try {
    const response = await fetch(`/api/v1/captcha/email/remaining?email=${encodeURIComponent(form.email)}`);
    const result = await response.json();
    if (result.code === 200 && result.data.remainingSeconds > 0) emailCountdown.value = result.data.remainingSeconds;
  } catch { /* The next send attempt will show the server response. */ }
}
const consumedCaptchaIds = new Set<string>();
async function sendCode(email: string, captcha: string, id: string, onMessage: (value: string) => void, setCountdown: (seconds: number) => void, refresh: () => Promise<void>) {
  if (!email.trim()) return onMessage("请先输入邮箱");
  if (!captcha.trim() || !id) return onMessage("请先输入图形验证码");
  if (consumedCaptchaIds.has(id)) {
    await refresh();
    return onMessage("请填写新的图形验证码后重新发送");
  }
  try {
    const response = await fetch("/api/v1/captcha/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), captchaId: id, captcha: captcha.trim() }),
    });
    const result = await response.json();
    if (result.code === 200) {
      onMessage("验证码已发送到您的邮箱");
      setCountdown(result.data.remainingSeconds || 60);
      consumedCaptchaIds.add(id);
      return;
    } else onMessage(result.message || "发送失败");
    await refresh();
  } catch {
    onMessage("发送失败，请稍后重试");
    await refresh();
  }
}
async function sendRegisterCode() {
  message.value = "";
  await sendCode(form.email, form.captcha, captchaId.value, (value) => { message.value = value; }, (value) => { emailCountdown.value = value; }, fetchCaptcha);
}
async function sendBindCode() {
  bindMessage.value = "";
  await sendCode(bindForm.email, bindForm.captcha, bindCaptchaId.value, (value) => { bindMessage.value = value; }, (value) => { bindEmailCountdown.value = value; }, fetchBindCaptcha);
}
async function sendResetCode() {
  resetMessage.value = "";
  await sendCode(resetForm.email, resetForm.captcha, resetCaptchaId.value, (value) => { resetMessage.value = value; }, (value) => { resetEmailCountdown.value = value; }, fetchResetCaptcha);
}

async function submitResetPassword() {
  resetMessage.value = "";
  if (!resetForm.email || !resetForm.emailVerificationCode) return resetMessage.value = "请输入邮箱和邮箱验证码";
  if (resetForm.newPassword.length < 6 || resetForm.newPassword.length > 20) return resetMessage.value = "新密码长度必须在6-20之间";
  if (resetForm.newPassword !== resetForm.confirmPassword) return resetMessage.value = "两次密码不一致";
  resetLoading.value = true;
  try {
    await resetPassword({ email: resetForm.email, emailVerificationCode: resetForm.emailVerificationCode, newPassword: resetForm.newPassword });
    resetMessage.value = "密码重置成功，请使用新密码登录";
    window.setTimeout(() => {
      resetModalVisible.value = false;
      Object.assign(resetForm, { email: "", captcha: "", emailVerificationCode: "", newPassword: "", confirmPassword: "" });
      resetMessage.value = "";
    }, 3000);
  } catch (error) {
    resetMessage.value = error instanceof Error ? error.message : "重置失败";
    await fetchResetCaptcha();
  } finally { resetLoading.value = false; }
}

async function submitBindEmail() {
  bindMessage.value = "";
  if (!pendingToken.value) return;
  if (!bindForm.email || !bindForm.emailVerificationCode) return bindMessage.value = "请输入邮箱和邮箱验证码";
  bindLoading.value = true;
  try {
    await bindEmail({ email: bindForm.email, emailVerificationCode: bindForm.emailVerificationCode }, pendingToken.value);
    if (pendingAuth.value) saveFrontendAuthTokens(pendingAuth.value, pendingRememberMe.value);
    ElMessage.success("邮箱绑定成功");
    bindModalVisible.value = false;
    window.location.assign(redirectPath.value);
  } catch (error) {
    bindMessage.value = error instanceof Error ? error.message : "绑定失败";
    await fetchBindCaptcha();
  } finally { bindLoading.value = false; }
}

async function submit() {
  message.value = "";
  if (isRegister.value) {
    if (form.username.length < 3 || form.username.length > 15) return message.value = "用户名长度必须在3-15之间";
    if (form.studentNo.length !== 10) return message.value = "学号必须为10位";
    if (form.password.length < 6 || form.password.length > 20) return message.value = "密码长度必须在6-20之间";
    if (form.password !== form.confirmPassword) return message.value = "两次密码不一致";
    if (!form.emailVerificationCode) return message.value = "请输入邮箱验证码";
  }
  submitting.value = true;
  try {
    if (isRegister.value) {
      const auth = await register({ username: form.username, studentNo: form.studentNo, email: form.email, password: form.password, emailVerificationCode: form.emailVerificationCode });
      saveFrontendAuthTokens(auth, false);
    } else {
      const auth = await loginWithoutPersist(form.username, form.password, rememberMe.value, captchaId.value, form.captcha);
      if (auth.portal === "TEACHER") {
        ElMessage.info("已切换到教师端登录");
        await router.replace(`/teacher/login?username=${encodeURIComponent(form.username.trim())}`);
        return;
      }
      const me = await fetchMe(auth.accessToken);
      if (!me.email) {
        clearFrontendTokens();
        pendingToken.value = auth.accessToken;
        pendingAuth.value = auth;
        pendingRememberMe.value = rememberMe.value;
        Object.assign(bindForm, { email: "", captcha: "", emailVerificationCode: "" });
        bindMessage.value = "";
        bindModalVisible.value = true;
        await fetchBindCaptcha();
        return;
      }
      saveFrontendAuthTokens(auth, rememberMe.value);
    }
    ElMessage({ type: "success", message: isRegister.value ? "注册成功" : "登录成功", duration: 2000 });
    window.setTimeout(() => window.location.assign(redirectPath.value), 1200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "操作失败";
    if (!isRegister.value && errorMessage.includes("教师账号请使用教师端登录")) {
      ElMessage.info("已切换到教师端登录");
      await router.replace(`/teacher/login?username=${encodeURIComponent(form.username.trim())}`);
      return;
    }
    if (errorMessage.includes("后台账号")) clearFrontendTokens();
    message.value = errorMessage;
    await fetchCaptcha();
  } finally { submitting.value = false; }
}

function toggleMode() {
  const target = isRegister.value ? "/login" : "/register";
  window.location.assign(`${target}${redirectQuery.value}`);
}
function openResetModal() {
  Object.assign(resetForm, { email: "", captcha: "", emailVerificationCode: "", newPassword: "", confirmPassword: "" });
  resetMessage.value = "";
  resetModalVisible.value = true;
  void fetchResetCaptcha();
}

watch(() => ojData.activeUser, (user) => {
  if (!user) return;
  ElMessage.info("您已登录");
  void router.replace(redirectPath.value);
});
onMounted(() => { void fetchCaptcha(); if (isRegister.value) void checkEmailRemaining(); });
</script>

<template>
  <div class="auth-page page-container" :class="isRegister ? 'auth-page--register' : 'auth-page--login'">
    <el-card class="auth-card" shadow="never">
      <header class="auth-header"><div class="auth-header-title">{{ title }}</div></header>
      <div class="auth-body">
        <form class="auth-form" @submit.prevent="submit">
          <div class="auth-field"><label class="auth-label">用户名</label><el-input v-model="form.username" :placeholder="isRegister ? '请输入用户名（3-15个字符）' : '请输入用户名'" autocomplete="username" /></div>
          <div v-if="isRegister" class="auth-register-section">
            <div class="auth-field"><label class="auth-label">学号</label><el-input v-model="form.studentNo" placeholder="请输入10位学号" maxlength="10" /></div>
            <div class="auth-field"><label class="auth-label">邮箱</label><el-input v-model="form.email" placeholder="请输入邮箱" type="email" autocomplete="email" @blur="checkEmailRemaining" /></div>
          </div>
          <div class="auth-field"><label class="auth-label">密码</label><el-input v-model="form.password" :placeholder="isRegister ? '请输入密码（6-20个字符）' : '请输入密码'" type="password" show-password autocomplete="current-password" /></div>
          <div v-if="!isRegister" class="auth-grid-captcha">
            <div class="auth-field"><label class="auth-label">验证码</label><el-input v-model="form.captcha" placeholder="请输入验证码" autocomplete="off" /></div>
            <button v-if="captchaImage" class="captcha-button" type="button" aria-label="刷新验证码" @click="fetchCaptcha"><img :src="captchaImage" alt="验证码" class="auth-captcha-img" /></button>
          </div>
          <div v-if="isRegister" class="auth-register-section">
            <div class="auth-field"><label class="auth-label">确认密码</label><el-input v-model="form.confirmPassword" placeholder="请确认密码" type="password" show-password autocomplete="new-password" /></div>
            <div class="auth-grid-captcha">
              <div class="auth-field"><label class="auth-label">验证码</label><el-input v-model="form.captcha" placeholder="请输入验证码" /></div>
              <button v-if="captchaImage" class="captcha-button" type="button" aria-label="刷新验证码" @click="fetchCaptcha"><img :src="captchaImage" alt="验证码" class="auth-captcha-img" /></button>
            </div>
            <div class="auth-grid-email-code">
              <div class="auth-field"><label class="auth-label">邮箱验证码</label><el-input v-model="form.emailVerificationCode" placeholder="请输入邮箱验证码" /></div>
              <el-button class="auth-btn-send-code" :disabled="emailCountdown > 0" @click="sendRegisterCode">{{ emailCountdown > 0 ? `${emailCountdown}秒后重试` : "发送验证码" }}</el-button>
            </div>
          </div>
          <el-alert v-if="message" class="auth-message" :title="message" :type="message.includes('已发送') ? 'success' : 'error'" show-icon :closable="false" />
          <el-checkbox v-if="!isRegister" v-model="rememberMe">记住密码</el-checkbox>
          <el-button type="primary" native-type="submit" class="auth-btn-primary" :loading="submitting">{{ title }}</el-button>
          <div v-if="!isRegister" class="auth-recovery-action"><el-button text class="auth-forgot-password" @click="openResetModal">找回密码</el-button></div>
          <el-button class="auth-btn-toggle" @click="toggleMode">{{ isRegister ? "已有账号，去登录" : "没有账号，去注册" }}</el-button>
        </form>
      </div>
    </el-card>

    <el-dialog append-to-body v-model="bindModalVisible" title="绑定邮箱" width="480px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <el-text type="info">当前账号还没有绑定邮箱，请绑定邮箱后继续使用。</el-text>
      <div class="auth-modal-form">
        <el-input v-model="bindForm.email" placeholder="请输入邮箱" type="email" />
        <div class="auth-bind-modal-grid-captcha"><el-input v-model="bindForm.captcha" placeholder="请输入图形验证码" /><button v-if="bindCaptchaImage" class="captcha-button" type="button" aria-label="刷新图形验证码" @click="fetchBindCaptcha"><img :src="bindCaptchaImage" alt="验证码" class="auth-bind-modal-captcha-img" /></button></div>
        <div class="auth-bind-modal-grid-code"><el-input v-model="bindForm.emailVerificationCode" placeholder="请输入邮箱验证码" /><el-button type="primary" :disabled="bindEmailCountdown > 0" @click="sendBindCode">{{ bindEmailCountdown > 0 ? `${bindEmailCountdown}秒后重试` : "发送验证码" }}</el-button></div>
        <el-text v-if="bindMessage" :type="bindMessage.includes('已发送') ? 'success' : 'danger'">{{ bindMessage }}</el-text>
      </div>
      <template #footer><el-button type="primary" :loading="bindLoading" @click="submitBindEmail">绑定</el-button></template>
    </el-dialog>

    <el-dialog append-to-body v-model="resetModalVisible" class="auth-reset-modal" title="找回密码" width="520px">
      <el-text type="info">请输入注册时使用的邮箱，通过邮箱验证码验证身份后重置密码。</el-text>
      <div class="auth-modal-form">
        <el-input v-model="resetForm.email" placeholder="请输入注册邮箱" type="email" />
        <div class="auth-bind-modal-grid-captcha"><el-input v-model="resetForm.captcha" placeholder="请输入图形验证码" /><button v-if="resetCaptchaImage" class="captcha-button" type="button" aria-label="刷新图形验证码" @click="fetchResetCaptcha"><img :src="resetCaptchaImage" alt="验证码" class="auth-bind-modal-captcha-img" /></button></div>
        <div class="auth-bind-modal-grid-code"><el-input v-model="resetForm.emailVerificationCode" placeholder="请输入邮箱验证码" /><el-button class="auth-modal-send-code" type="primary" :disabled="resetEmailCountdown > 0" @click="sendResetCode">{{ resetEmailCountdown > 0 ? `${resetEmailCountdown}秒后重试` : "发送验证码" }}</el-button></div>
        <el-input v-model="resetForm.newPassword" placeholder="请输入新密码（6-20个字符）" type="password" show-password />
        <el-input v-model="resetForm.confirmPassword" placeholder="请确认新密码" type="password" show-password />
        <el-text v-if="resetMessage" :type="resetMessage.includes('已发送') || resetMessage.includes('成功') ? 'success' : 'danger'">{{ resetMessage }}</el-text>
      </div>
      <template #footer><el-button @click="resetModalVisible = false">取消</el-button><el-button type="primary" :loading="resetLoading" @click="submitResetPassword">重置密码</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.auth-card { width: 100%; max-width: 440px; min-height: min(360px, calc(100vh - 170px)); border: 1px solid var(--qoj-color-border,var(--el-border-color)); border-radius: 12px; box-shadow: 0 2px 12px rgba(31,35,41,.05); }
.auth-card :deep(.el-card__body) { display: flex; flex-direction: column; padding: 0; }
.auth-captcha-img, .auth-bind-modal-captcha-img { display: block; width: 120px; height: 44px; cursor: pointer; border: 1px solid var(--qoj-color-border,#dcdfe6); border-radius: 999px; object-fit: cover; }
.auth-bind-modal-captcha-img { width: 132px; object-fit: fill; }
.captcha-button { border: 0; padding: 0; background: transparent; cursor: pointer; }
.auth-modal-form { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
.auth-modal-form :deep(.el-input) { min-width: 0; }
.auth-bind-modal-grid-captcha, .auth-bind-modal-grid-code { display: grid; align-items: stretch; gap: 12px; grid-template-columns: minmax(0, 1fr) 132px; }
.auth-modal-send-code { width: 132px; }
.auth-message { margin: 0; font-size: 13px; }
.auth-btn-primary, .auth-btn-toggle { width: 100%; }
.auth-btn-send-code { min-width: 116px; height: 44px; }
.auth-btn-toggle { margin-left: 0; }
.auth-page--register .auth-card { min-height: min(548px, calc(100vh - 170px)); }
@media (max-width: 640px) { .auth-page { min-height: auto; padding: 12px; } .auth-card { min-height: 0; border-radius: 10px; } .auth-bind-modal-grid-captcha, .auth-bind-modal-grid-code { grid-template-columns: minmax(0,1fr) 108px; gap: 8px; } .auth-bind-modal-captcha-img, .auth-modal-send-code { width: 108px; } }
</style>
