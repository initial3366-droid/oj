<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { createAnnouncement, deleteAnnouncement, fetchAnnouncementList, fetchPinnedAnnouncement, updateAnnouncement, type Announcement } from "../../../admin/api/announcement";
import { announcementPlainText } from "../../../utils/announcementHtml";
import AnnouncementContent from "../../components/AnnouncementContent.vue";
import { formatDisplayDateTime } from "../../../lib/format";

const rows = ref<Announcement[]>([]);
const pinned = ref<Announcement | null>(null);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const pinnedLoading = ref(false);
const saving = ref(false);
const listError = ref("");
const pinnedError = ref("");
const dialogOpen = ref(false);
const editing = ref<Announcement | null>(null);
const editorKind = ref<"ordinary" | "pinned">("ordinary");
const activeTab = ref("edit");
const form = reactive({ title: "", content: "", isVisible: true });
const dialogTitle = computed(() => editorKind.value === "pinned" ? (editing.value ? "编辑置顶公告" : "设置置顶公告") : (editing.value ? "编辑普通公告" : "新增普通公告"));

async function loadList(targetPage = page.value) {
  loading.value = true; listError.value = "";
  try { const result = await fetchAnnouncementList(targetPage, pageSize.value); rows.value = result.list; total.value = result.total; page.value = targetPage; }
  catch (error) { listError.value = error instanceof Error ? error.message : "加载公告列表失败"; }
  finally { loading.value = false; }
}

async function loadPinned() {
  pinnedLoading.value = true; pinnedError.value = "";
  try { pinned.value = await fetchPinnedAnnouncement(); }
  catch (error) { pinnedError.value = error instanceof Error ? error.message : "加载置顶公告失败"; }
  finally { pinnedLoading.value = false; }
}

async function refresh() { await Promise.all([loadList(), loadPinned()]); }

function openCreate() {
  editing.value = null; editorKind.value = "ordinary"; activeTab.value = "edit";
  Object.assign(form, { title: "", content: "", isVisible: true }); dialogOpen.value = true;
}

function openPinnedEditor() {
  editing.value = pinned.value; editorKind.value = "pinned"; activeTab.value = "edit";
  Object.assign(form, { title: pinned.value?.title ?? "", content: pinned.value?.content ?? "", isVisible: pinned.value?.isVisible ?? true });
  dialogOpen.value = true;
}

function openEdit(row: Announcement) {
  editing.value = row; editorKind.value = "ordinary"; activeTab.value = "edit";
  Object.assign(form, { title: row.title, content: row.content, isVisible: row.isVisible }); dialogOpen.value = true;
}

async function save() {
  const title = form.title.trim(); const content = form.content.trim();
  if (!title || title.length > 200) { ElMessage.warning("公告标题不能为空且不能超过 200 个字符"); return; }
  if (!content || content.length > 5000) { ElMessage.warning("公告内容不能为空且不能超过 5000 个字符"); return; }
  saving.value = true;
  const payload = { title, content, isVisible: form.isVisible, isPinned: editorKind.value === "pinned" };
  try {
    if (editing.value) await updateAnnouncement(editing.value.id, payload);
    else await createAnnouncement(payload);
    ElMessage.success(editing.value ? "公告已更新" : "公告已创建");
    dialogOpen.value = false;
    await Promise.all([loadList(editing.value ? page.value : 1), loadPinned()]);
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "保存公告失败"); }
  finally { saving.value = false; }
}

async function unpin() {
  if (!pinned.value) return;
  try { await ElMessageBox.confirm("取消置顶后，这条公告会回到普通公告列表。", "取消置顶", { type: "warning" }); await updateAnnouncement(pinned.value.id, { isPinned: false }); ElMessage.success("已取消置顶"); await Promise.all([loadPinned(), loadList(1)]); }
  catch (error) { if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "取消置顶失败"); }
}

async function remove(row: Announcement) {
  try { await ElMessageBox.confirm("删除后将无法恢复，确定删除这条公告吗？", "删除公告", { type: "warning", confirmButtonText: "删除", confirmButtonClass: "el-button--danger" }); await deleteAnnouncement(row.id); ElMessage.success("公告已删除"); const nextPage = rows.value.length === 1 && page.value > 1 ? page.value - 1 : page.value; await Promise.all([loadList(nextPage), loadPinned()]); }
  catch (error) { if (error !== "cancel" && error !== "close") ElMessage.error(error instanceof Error ? error.message : "删除公告失败"); }
}

onMounted(refresh);
</script>

<template>
  <section class="announcement-page page-container">
    
    <el-alert v-if="listError || pinnedError" type="error" :title="`公告加载失败：${[listError && `普通公告：${listError}`, pinnedError && `置顶公告：${pinnedError}`].filter(Boolean).join('；')}`" show-icon :closable="false"><template #default><el-button link type="primary" @click="refresh">重试加载</el-button></template></el-alert>
    <el-card shadow="never" v-loading="pinnedLoading">
      <template #header><div class="card-heading"><strong>置顶公告</strong><div><el-button v-if="pinned" link @click="unpin">取消置顶</el-button><el-button type="primary" @click="openPinnedEditor">{{ pinned ? "编辑置顶公告" : "设置置顶公告" }}</el-button></div></div></template>
      <div v-if="pinned" class="pinned-preview"><AnnouncementContent :content="pinned.title" class-name="pinned-title" /><small>添加者：{{ pinned.authorName || "-" }} · 更新时间：{{ formatDisplayDateTime(pinned.updatedAt || pinned.createdAt) }}</small><div class="pinned-content"><el-tag :type="pinned.isVisible ? 'success' : 'info'">{{ pinned.isVisible ? "前台显示" : "前台隐藏" }}</el-tag><span>{{ announcementPlainText(pinned.content) }}</span></div></div>
      <el-empty v-else description="当前未设置置顶公告" />
    </el-card>
    <el-card shadow="never">
      <template #header><div class="management-card-heading"><div class="management-card-title">普通公告</div><div class="management-card-actions"><header class="page-heading"><div class="actions"><el-button type="primary" @click="openCreate">新增公告</el-button></div></header></div></div></template>
      <el-table v-loading="loading" :data="rows" row-key="id" stripe>
        <el-table-column label="标题" min-width="180" show-overflow-tooltip><template #default="{ row }"><AnnouncementContent :content="row.title" /></template></el-table-column>
        <el-table-column label="内容" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ announcementPlainText(row.content) }}</template></el-table-column>
        <el-table-column prop="authorName" label="添加者" min-width="110" />
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.isVisible ? 'success' : 'info'">{{ row.isVisible ? "显示" : "隐藏" }}</el-tag></template></el-table-column>
        <el-table-column label="更新时间" min-width="180"><template #default="{ row }">{{ formatDisplayDateTime(row.updatedAt || row.createdAt) }}</template></el-table-column>
        <el-table-column label="操作" width="140" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="暂无普通公告" /></template>
      </el-table>
      <div class="pagination"><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" :page-sizes="[10,20,50]" @pagination="loadList(page)" /></div>
    </el-card>
    
<el-dialog class="qoj-management-dialog" v-model="dialogOpen" :title="dialogTitle" width="min(900px,96vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="公告标题" required><el-input v-model="form.title" maxlength="200" show-word-limit placeholder="支持安全 HTML，例如：&lt;strong style=&quot;color:#165dff&quot;&gt;公告标题&lt;/strong&gt;" /></el-form-item>
        <el-tabs v-model="activeTab" type="border-card">
          <el-tab-pane label="HTML 编辑" name="edit"><el-form-item label="公告内容" required><el-input v-model="form.content" type="textarea" :rows="13" maxlength="5000" show-word-limit spellcheck="false" placeholder="支持安全 HTML，例如：&lt;div align=&quot;center&quot; style=&quot;color:red&quot;&gt;公告内容&lt;/div&gt;" /></el-form-item></el-tab-pane>
          <el-tab-pane label="效果预览" name="preview"><div class="html-preview"><AnnouncementContent :content="form.title" empty-text="请输入公告标题" class-name="preview-title" /><AnnouncementContent :content="form.content" empty-text="输入 HTML 后可在这里查看前台效果" /></div></el-tab-pane>
        </el-tabs>
        <el-form-item label="是否可见" class="visibility-field"><el-switch v-model="form.isVisible" active-text="显示" inactive-text="隐藏" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.announcement-page{display:flex;flex-direction:column;gap:16px}.page-heading,.card-heading,.actions,.pinned-content,.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px}.page-heading h1{margin:0;font-size:22px}.page-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px}.card-heading>div,.actions{display:flex;gap:8px}.pinned-preview{display:grid;gap:12px}.pinned-preview small{color:var(--el-text-color-secondary)}.pinned-content{justify-content:flex-start;color:var(--el-text-color-regular);font-size:13px}.html-preview{min-height:240px;max-height:480px;overflow:auto;padding:20px;border:1px solid var(--card-border);border-radius:6px;background:var(--content-bg)}.preview-title{margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--card-border);font-size:16px;font-weight:600}.visibility-field{margin:18px 0 0}.pagination{margin-top:14px}.pinned-preview :deep(.pinned-title){font-size:16px;font-weight:600;line-height:1.5}.pinned-preview :deep(.pinned-title > *){margin:0}@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.pagination{align-items:flex-start;flex-direction:column}}
</style>
