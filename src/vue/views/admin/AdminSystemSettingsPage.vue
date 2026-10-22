<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminDelete, adminGet, adminPost, adminPut } from "../../../admin/api/adminClient";

type Section = "frontend" | "register" | "judge" | "system";
interface CarouselSlide { id: number; title: string; imageUrl: string; displayOrder: number; enabled: boolean }
const props = defineProps<{ section: Section }>();

const titles: Record<Section, string> = { frontend: "前台设置", register: "注册设置", judge: "判题配置", system: "系统设置" };
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const frontend = reactive({ siteTitle: "", siteLogo: "", maintenanceMode: false, footerText: "", icpNumber: "", mpsNumber: "", footerLink1Text: "", footerLink1Url: "", footerLink2Text: "", footerLink2Url: "" });
const register = reactive({ enabled: true, emailVerification: false, emailConfig: { host: "", port: 587, username: "", password: "", useSsl: true, subject: "", content: "" } });
const judge = reactive({ enabled: true, enableSandbox: false, maxConcurrent: 2, threadPoolSize: 2, queueBatchSize: 2, pollIntervalMs: 1000, staleTaskMinutes: 15 });
const oss = reactive({ enabled: false, endpoint: "", bucket: "", region: "", accessKeyId: "", accessKeySecret: "", publicBaseUrl: "", dir: "avatars/", maxSizeMb: 5 });
const password = reactive({ oldPassword: "", newPassword: "", confirmPassword: "" });
const carouselSlides = ref<CarouselSlide[]>([]);
const carouselLoading = ref(false);
const slideDialog = ref(false);
const slideSaving = ref(false);
const editingSlideId = ref<number | null>(null);
const slide = reactive({ title: "", imageUrl: "", displayOrder: 1, enabled: true });

async function loadCarousel() {
  carouselLoading.value = true;
  try { carouselSlides.value = await adminGet<CarouselSlide[]>("/api/admin/v1/home/carousel"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "加载轮播图失败"); }
  finally { carouselLoading.value = false; }
}

async function load() {
  loading.value = true; error.value = "";
  try {
    if (props.section === "frontend") {
      Object.assign(frontend, await adminGet<Record<string, unknown>>("/api/admin/v1/settings/frontend"));
      await loadCarousel();
    } else if (props.section === "judge") {
      Object.assign(judge, await adminGet<Record<string, unknown>>("/api/admin/v1/settings/judge"));
    } else if (props.section === "system") {
      Object.assign(oss, await adminGet<Record<string, unknown>>("/api/admin/v1/settings/system/oss"), { accessKeySecret: "" });
    } else {
      const settings = await adminGet<{ enabled?: boolean; emailVerification?: boolean; emailConfig?: Partial<typeof register.emailConfig> }>("/api/admin/v1/settings/register");
      Object.assign(register, { enabled: settings.enabled ?? true, emailVerification: settings.emailVerification ?? false });
      Object.assign(register.emailConfig, settings.emailConfig ?? {}, { password: "" });
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "加载设置失败"; }
  finally { loading.value = false; }
}

async function saveFrontend() {
  saving.value = true;
  try {
    await adminPut("/api/admin/v1/settings/frontend", { ...frontend });
    ElMessage.success("前端设置保存成功");
    await load();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存失败"); }
  finally { saving.value = false; }
}

async function saveRegister() {
  const email = register.emailConfig;
  const shouldSaveEmail = register.emailVerification || Boolean(email.host.trim() || email.username.trim() || email.password || email.subject.trim() || email.content.trim());
  if (shouldSaveEmail && (!email.host.trim() || !email.username.trim() || email.port < 1 || email.port > 65535)) { ElMessage.warning("请填写 SMTP 服务器、1-65535 之间的端口和发件邮箱"); return; }
  saving.value = true;
  try {
    if (shouldSaveEmail) await adminPut("/api/admin/v1/settings/register/email-config", { ...email, host: email.host.trim(), username: email.username.trim(), password: email.password || "", subject: email.subject.trim() || undefined, content: email.content.trim() || undefined });
    await adminPut("/api/admin/v1/settings/register/enabled", { enabled: register.enabled });
    await adminPut("/api/admin/v1/settings/register/email-verification", { enabled: register.emailVerification });
    ElMessage.success("注册设置保存成功");
    await load();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存失败"); }
  finally { saving.value = false; }
}

async function saveJudge() {
  saving.value = true;
  try { await adminPut("/api/admin/v1/settings/judge", { ...judge, maxConcurrent: Math.min(judge.maxConcurrent, judge.threadPoolSize) }); ElMessage.success("判题配置保存成功"); await load(); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存失败"); }
  finally { saving.value = false; }
}

async function saveOss() {
  saving.value = true;
  try {
    await adminPut("/api/admin/v1/settings/system/oss", { ...oss, endpoint: oss.endpoint.trim(), bucket: oss.bucket.trim(), region: oss.region.trim(), accessKeyId: oss.accessKeyId.trim(), accessKeySecret: oss.accessKeySecret.trim(), publicBaseUrl: oss.publicBaseUrl.trim(), dir: oss.dir.trim() || "avatars/" });
    ElMessage.success("腾讯云 COS 配置保存成功"); await load();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "保存失败"); }
  finally { saving.value = false; }
}

async function savePassword() {
  if (!password.oldPassword || !password.newPassword || !password.confirmPassword) { ElMessage.warning("请完整填写密码信息"); return; }
  if (password.newPassword.length < 6) { ElMessage.warning("新密码长度至少 6 位"); return; }
  if (password.newPassword !== password.confirmPassword) { ElMessage.error("两次密码输入不一致"); return; }
  saving.value = true;
  try { await adminPut("/api/admin/v1/settings/admin/password", { oldPassword: password.oldPassword, newPassword: password.newPassword }); Object.assign(password, { oldPassword: "", newPassword: "", confirmPassword: "" }); ElMessage.success("密码修改成功"); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "密码修改失败"); }
  finally { saving.value = false; }
}

function openSlide(item?: CarouselSlide) {
  editingSlideId.value = item?.id ?? null;
  Object.assign(slide, item ? { title: item.title, imageUrl: item.imageUrl, displayOrder: item.displayOrder, enabled: item.enabled } : { title: "", imageUrl: "", displayOrder: carouselSlides.value.length + 1, enabled: true });
  slideDialog.value = true;
}

async function saveSlide() {
  if (!slide.title.trim() || !slide.imageUrl.trim()) { ElMessage.warning("请填写标题和图片地址"); return; }
  slideSaving.value = true;
  try {
    const payload = { ...slide, title: slide.title.trim(), imageUrl: slide.imageUrl.trim() };
    if (editingSlideId.value) await adminPut(`/api/admin/v1/home/carousel/${editingSlideId.value}`, payload);
    else await adminPost("/api/admin/v1/home/carousel", payload);
    slideDialog.value = false; ElMessage.success(editingSlideId.value ? "轮播图更新成功" : "轮播图创建成功"); await loadCarousel();
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "轮播图保存失败"); }
  finally { slideSaving.value = false; }
}

async function deleteSlide(item: CarouselSlide) {
  try { await ElMessageBox.confirm(`删除“${item.title}”后首页将不再展示。`, "删除轮播图", { type: "warning" }); await adminDelete(`/api/admin/v1/home/carousel/${item.id}`); ElMessage.success("轮播图已删除"); await loadCarousel(); }
  catch (cause) { if (cause !== "cancel" && cause !== "close") ElMessage.error(cause instanceof Error ? cause.message : "删除失败"); }
}

onMounted(load);
</script>

<template>
  <section class="settings-page page-container">
    
    <el-alert v-if="error" type="error" :title="`配置加载失败：${error}`" show-icon :closable="false" />
    <template v-if="section === 'frontend'">
      <el-card v-loading="loading" shadow="never">
        <template #header><div class="card-heading"><strong>前端配置</strong><el-button type="primary" :loading="saving" :disabled="Boolean(error)" @click="saveFrontend">保存</el-button></div></template>
        <el-form label-position="top" class="settings-form">
          <el-form-item label="站点标题" required><el-input v-model="frontend.siteTitle" /></el-form-item>
          <el-form-item label="站点图标" help="留空时显示默认图标"><el-input v-model="frontend.siteLogo" placeholder="/banners/logo.svg 或 https://example.com/logo.png" /></el-form-item>
          <el-form-item label="维护模式"><el-switch v-model="frontend.maintenanceMode" active-text="开启后普通用户无法访问系统" /></el-form-item>
          <el-form-item label="底部文案"><el-input v-model="frontend.footerText" /></el-form-item>
          <el-form-item label="备案号"><el-input v-model="frontend.icpNumber" placeholder="粤ICP备xxxxxxxx号" /></el-form-item>
          <el-form-item label="公安备案号"><el-input v-model="frontend.mpsNumber" placeholder="京公网安备 110105020xxxxx号" /></el-form-item>
          <el-divider content-position="left">底部链接</el-divider>
          <div class="two-column"><el-form-item label="链接一文字"><el-input v-model="frontend.footerLink1Text" /></el-form-item><el-form-item label="链接一地址"><el-input v-model="frontend.footerLink1Url" /></el-form-item><el-form-item label="链接二文字"><el-input v-model="frontend.footerLink2Text" /></el-form-item><el-form-item label="链接二地址"><el-input v-model="frontend.footerLink2Url" /></el-form-item></div>
        </el-form>
      </el-card>
      <el-card shadow="never">
        <template #header><div class="card-heading"><strong>轮播图管理</strong><div><el-button type="primary" @click="openSlide()">新增轮播图</el-button></div></div></template>
        <el-table v-loading="carouselLoading" :data="carouselSlides" row-key="id" stripe>
          <el-table-column prop="displayOrder" label="排序" width="80" />
          <el-table-column label="预览" width="150"><template #default="{ row }"><img class="slide-preview" :src="row.imageUrl" :alt="row.title"></template></el-table-column>
          <el-table-column prop="title" label="标题" min-width="160" />
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "隐藏" }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openSlide(row)">编辑</el-button><el-button link type="danger" @click="deleteSlide(row)">删除</el-button></template></el-table-column>
        </el-table>
      </el-card>
    </template>
    <el-card v-else-if="section === 'register'" v-loading="loading" shadow="never">
      <template #header><div class="card-heading"><strong>注册配置</strong><el-button type="primary" :loading="saving" :disabled="Boolean(error)" @click="saveRegister">保存设置</el-button></div></template>
      <el-form label-position="top" class="settings-form">
        <el-form-item label="开放注册"><el-switch v-model="register.enabled" active-text="关闭后新用户无法注册" /></el-form-item>
        <el-form-item label="邮箱验证"><el-switch v-model="register.emailVerification" active-text="注册时要求邮箱验证码" /></el-form-item>
        <el-divider content-position="left">邮件服务配置</el-divider>
        <div class="two-column"><el-form-item label="SMTP 服务器"><el-input v-model="register.emailConfig.host" placeholder="smtp.example.com" /></el-form-item><el-form-item label="SMTP 端口"><el-input-number v-model="register.emailConfig.port" :min="1" :max="65535" /></el-form-item><el-form-item label="发件邮箱"><el-input v-model="register.emailConfig.username" placeholder="noreply@example.com" /></el-form-item><el-form-item label="邮箱密码"><el-input v-model="register.emailConfig.password" type="password" show-password placeholder="留空则不修改密码" /></el-form-item></div>
        <el-form-item label="启用 SSL/TLS"><el-switch v-model="register.emailConfig.useSsl" /></el-form-item>
        <el-alert type="info" :closable="false" title="模板变量：{{code}} 为六位验证码，{{username}} 为用户名，{{email}} 为邮箱地址。" />
        <el-form-item label="邮件标题"><el-input v-model="register.emailConfig.subject" placeholder="QOJ 注册验证码" /></el-form-item>
        <el-form-item label="邮件内容"><el-input v-model="register.emailConfig.content" type="textarea" :rows="6" placeholder="您好，\n\n您的验证码是: {{code}}\n\nQOJ Online Judge System" /></el-form-item>
      </el-form>
      <el-divider />
      <h3>安全设置</h3>
      <el-form label-position="top" class="settings-form">
        <el-form-item label="当前密码" required><el-input v-model="password.oldPassword" type="password" show-password autocomplete="current-password" /></el-form-item>
        <el-form-item label="新密码" required><el-input v-model="password.newPassword" type="password" show-password autocomplete="new-password" /></el-form-item>
        <el-form-item label="确认密码" required><el-input v-model="password.confirmPassword" type="password" show-password autocomplete="new-password" /></el-form-item>
        <el-button type="primary" :loading="saving" @click="savePassword">修改管理员密码</el-button>
      </el-form>
    </el-card>
    <el-card v-else-if="section === 'judge'" v-loading="loading" shadow="never">
      <template #header><div class="card-heading"><strong>判题配置</strong><el-button type="primary" :loading="saving" :disabled="Boolean(error)" @click="saveJudge">保存</el-button></div></template>
      <el-form label-position="top" class="settings-form">
        <el-form-item label="判题开关"><el-switch v-model="judge.enabled" active-text="关闭后暂停新的提交判题" /></el-form-item>
        <el-form-item label="评测服务"><el-input model-value="go-judge" disabled /></el-form-item>
        <el-form-item label="沙箱调试"><el-switch v-model="judge.enableSandbox" /></el-form-item>
        <el-form-item label="线程池大小"><el-input-number v-model="judge.threadPoolSize" :min="1" :max="64" /></el-form-item>
        <el-form-item label="最大并发数"><el-input-number v-model="judge.maxConcurrent" :min="1" :max="judge.threadPoolSize" /><small>取值范围 1 至 {{ judge.threadPoolSize }}</small></el-form-item>
        <el-form-item label="队列批量数"><el-input-number v-model="judge.queueBatchSize" :min="1" :max="100" /></el-form-item>
        <el-form-item label="队列轮询间隔"><el-input-number v-model="judge.pollIntervalMs" :min="200" :max="60000" :step="100" /><small>毫秒</small></el-form-item>
        <el-form-item label="失联任务重领时间"><el-input-number v-model="judge.staleTaskMinutes" :min="2" :max="1440" /><small>分钟</small></el-form-item>
        <el-alert type="info" :closable="false" title="go-judge 地址和鉴权令牌从后端部署环境读取。线程池大小在后端重启后重新初始化。" />
      </el-form>
    </el-card>
    <el-card v-else v-loading="loading" shadow="never">
      <template #header><div class="card-heading"><strong>腾讯云 COS 配置</strong><el-button type="primary" :loading="saving" :disabled="Boolean(error)" @click="saveOss">保存</el-button></div></template>
      <el-form label-position="top" class="settings-form">
        <el-form-item label="启用 COS"><el-switch v-model="oss.enabled" /></el-form-item>
        <el-form-item label="Endpoint"><el-input v-model="oss.endpoint" placeholder="https://cos.ap-beijing.myqcloud.com" /><small>留空时根据 Region 自动连接腾讯云 COS</small></el-form-item>
        <div class="two-column"><el-form-item label="Bucket"><el-input v-model="oss.bucket" placeholder="qoj-1250000000" /></el-form-item><el-form-item label="Region"><el-input v-model="oss.region" placeholder="ap-beijing" /></el-form-item><el-form-item label="SecretId"><el-input v-model="oss.accessKeyId" placeholder="AKID..." /></el-form-item><el-form-item label="SecretKey"><el-input v-model="oss.accessKeySecret" type="password" show-password placeholder="留空则不修改" /></el-form-item><el-form-item label="公开地址"><el-input v-model="oss.publicBaseUrl" placeholder="https://bucket.cos.region.myqcloud.com" /></el-form-item><el-form-item label="头像目录"><el-input v-model="oss.dir" placeholder="avatars/" /></el-form-item><el-form-item label="头像大小"><el-input-number v-model="oss.maxSizeMb" :min="1" :max="20" /></el-form-item></div>
      </el-form>
    </el-card>
    <el-dialog class="qoj-management-dialog" v-model="slideDialog" :title="editingSlideId ? '编辑轮播图' : '新增轮播图'" width="min(560px,94vw)" destroy-on-close>
      <el-form label-position="top"><el-form-item label="标题" required><el-input v-model="slide.title" maxlength="120" /></el-form-item><el-form-item label="图片地址" required><el-input v-model="slide.imageUrl" placeholder="https://example.com/banner.png" /></el-form-item><el-form-item label="排序"><el-input-number v-model="slide.displayOrder" :min="0" /></el-form-item><el-form-item label="启用"><el-switch v-model="slide.enabled" /></el-form-item></el-form>
      <template #footer><el-button @click="slideDialog = false">取消</el-button><el-button type="primary" :loading="slideSaving" @click="saveSlide">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.settings-page{display:flex;flex-direction:column;gap:16px;max-width:1100px;margin:0 auto}.page-heading,.card-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.settings-form{max-width:900px}.settings-form :deep(.el-input-number){width:100%}.settings-form small{display:block;margin-top:5px;color:var(--el-text-color-secondary);font-size:12px}.two-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.slide-preview{width:120px;height:56px;object-fit:cover;border:1px solid var(--el-border-color);border-radius:4px}.card-heading>div{display:flex;gap:8px}@media(max-width:700px){.page-heading{align-items:flex-start;flex-direction:column}.two-column{grid-template-columns:1fr}}
</style>
