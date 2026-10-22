<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { bindEmail, fetchMe } from "../../data/apiClient";
import { readAuthToken } from "../../api/tokenStorage";
import { useOjDataStore } from "../stores/ojData";

interface CaptchaResponse {
  code: number;
  message?: string;
  data?: { captchaId: string; image: string };
}

interface EmailCodeResponse {
  code: number;
  message?: string;
  data?: { remainingSeconds?: number };
}

const route = useRoute();
const ojData = useOjDataStore();
const token = computed(() => readAuthToken("frontend"));
const exemptRoute = computed(() => route.path === "/login" || route.path === "/register");
const hasBoundEmail = ref<boolean | null>(null);
const checkedKey = ref<string | null>(null);
const email = ref("");
const captchaId = ref("");
const captchaImage = ref("");
const captchaInput = ref("");
const emailCode = ref("");
const countdown = ref(0);
const sending = ref(false);
const binding = ref(false);
const currentKey = computed(() => `${route.path}::${token.value ?? ""}`);
const checking = computed(() => Boolean(token.value && !exemptRoute.value && checkedKey.value !== currentKey.value));

async function fetchCaptcha() {
  try {
    const response = await fetch("/api/v1/captcha/image");
    const result = await response.json() as CaptchaResponse;
    if (result.code === 200 && result.data) {
      captchaId.value = result.data.captchaId;
      captchaImage.value = result.data.image;
      captchaInput.value = "";
    } else {
      ElMessage.error(result.message || "验证码加载失败");
    }
  } catch {
    ElMessage.error("验证码加载失败");
  }
}

async function checkEmailBinding() {
  const key = currentKey.value;
  if (exemptRoute.value || !token.value) {
    hasBoundEmail.value = true;
    checkedKey.value = key;
    return;
  }
  hasBoundEmail.value = null;
  try {
    const user = await fetchMe(token.value);
    if (currentKey.value === key) hasBoundEmail.value = Boolean(user.email?.trim());
  } catch {
    if (currentKey.value === key) hasBoundEmail.value = true;
  } finally {
    if (currentKey.value === key) checkedKey.value = key;
  }
}

async function sendVerificationCode() {
  const normalizedEmail = email.value.trim();
  if (!normalizedEmail) return ElMessage.error("请输入要绑定的邮箱");
  if (!captchaId.value || !captchaInput.value.trim()) return ElMessage.error("请先输入图形验证码");
  sending.value = true;
  try {
    const response = await fetch("/api/v1/captcha/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, captchaId: captchaId.value, captcha: captchaInput.value.trim() }),
    });
    const result = await response.json() as EmailCodeResponse;
    if (result.code === 200) {
      ElMessage.success("验证码已发送，请查收邮件");
      countdown.value = result.data?.remainingSeconds || 60;
    } else {
      ElMessage.error(result.message || "验证码发送失败");
    }
    await fetchCaptcha();
  } catch {
    ElMessage.error("验证码发送失败，请稍后重试");
    await fetchCaptcha();
  } finally {
    sending.value = false;
  }
}

async function submitEmailBinding() {
  if (!token.value) return;
  if (!email.value.trim() || !emailCode.value.trim()) return ElMessage.error("请输入邮箱和邮箱验证码");
  binding.value = true;
  try {
    await bindEmail({ email: email.value.trim(), emailVerificationCode: emailCode.value.trim() }, token.value);
    const user = await fetchMe(token.value);
    hasBoundEmail.value = Boolean(user.email?.trim());
    await ojData.hydrate();
    ElMessage.success("邮箱绑定成功");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "邮箱绑定失败");
  } finally {
    binding.value = false;
  }
}

watch(currentKey, () => { void checkEmailBinding(); }, { immediate: true });
watch(hasBoundEmail, (bound) => { if (bound === false) void fetchCaptcha(); });
watch(countdown, (value) => {
  if (value <= 0) return;
  window.setTimeout(() => { if (countdown.value === value) countdown.value -= 1; }, 1000);
});
onMounted(() => { void ojData.hydrate(); });
</script>

<template>
  <div v-if="checking" class="email-binding-loading" aria-live="polite">正在检查账号状态…</div>
  <slot v-else-if="hasBoundEmail !== false || exemptRoute || !token" />
  <div v-else class="email-binding-page">
    <el-dialog :model-value="true" title="绑定邮箱后继续使用" width="480px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <el-text type="info">当前账号尚未绑定邮箱。请完成邮箱验证后继续使用 QOJ。</el-text>
      <div class="email-binding-form">
        <el-input v-model="email" type="email" placeholder="请输入邮箱地址" />
        <div class="email-binding-row">
          <el-input v-model="captchaInput" placeholder="图形验证码" />
          <button v-if="captchaImage" class="captcha-image" type="button" aria-label="刷新图形验证码" @click="fetchCaptcha"><img :src="captchaImage" alt="图形验证码" /></button>
          <el-button v-else @click="fetchCaptcha">获取验证码</el-button>
        </div>
        <div class="email-binding-row">
          <el-input v-model="emailCode" placeholder="邮箱验证码" />
          <el-button :loading="sending" :disabled="countdown > 0" @click="sendVerificationCode">{{ countdown > 0 ? `${countdown} 秒后重试` : "发送验证码" }}</el-button>
        </div>
        <el-button type="primary" :loading="binding" @click="submitEmailBinding">验证并绑定邮箱</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.email-binding-loading, .email-binding-page { min-height: 100vh; display: grid; place-items: center; background: var(--page-bg); }
.email-binding-form { display: grid; gap: 14px; margin-top: 18px; }
.email-binding-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
.captcha-image { border: 0; padding: 0; background: transparent; cursor: pointer; }
.captcha-image img { display: block; width: 120px; height: 40px; object-fit: contain; }
</style>
