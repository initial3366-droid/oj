import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { RouteRecordRaw } from 'vue-router';
import { store } from './store';
import { login as loginWithQoj } from './auth';
export { store };
export { useAppStore, useAppStoreHook } from '../../../vendor/vue3-element-admin/src/stores/app';
export { useSettingsStore } from '../../../vendor/vue3-element-admin/src/stores/settings';
export { useTagsViewStore } from '../../../vendor/vue3-element-admin/src/stores/tags-view';
export const usePermissionStore = defineStore('qoj-template-permission', () => {
  const routes = ref<RouteRecordRaw[]>([]);
  const mixLayoutSideMenus = ref<RouteRecordRaw[]>([]);
  function setMixLayoutSideMenus(path: string) { mixLayoutSideMenus.value = routes.value.find(route => route.path === path)?.children || []; }
  return { routes, mixLayoutSideMenus, setMixLayoutSideMenus };
});
export const useUserStore = defineStore('qoj-template-user', () => {
  const userInfo = ref({ nickname: '', avatar: '', username: '', roles: [] as string[], perms: ['*'], canSwitchTenant: false });
  const profilePath = ref('/');
  const loginPath = ref('/login');
  let logoutHandler: () => Promise<void> = async () => {};
  function configure(nickname: string, avatar: string, profile: string, login: string, logout: () => Promise<void>) {
    userInfo.value = { ...userInfo.value, nickname, username: nickname, avatar };
    profilePath.value = profile;
    loginPath.value = login;
    logoutHandler = logout;
  }
  async function logout() { await logoutHandler(); }
  async function login(data: import('./auth').LoginRequest) {
    try {
      await loginWithQoj(data);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '登录失败');
      throw error;
    }
    ElMessage({ type: 'success', message: '登录成功', duration: 2000 });
  }
  async function loginByQrCode(_ticket: string) { throw new Error('QOJ 尚未提供扫码登录接口'); }
  return { userInfo, profilePath, loginPath, configure, logout, login, loginByQrCode };
});
export const useUserStoreHook = () => useUserStore(store);
export const usePermissionStoreHook = () => usePermissionStore(store);
export const useDictStore = defineStore('qoj-template-dict', () => {
  async function loadDictItems(_code: string) {}
  function getDictItems(code: string): { value: number; label: string; tagType: string }[] {
    return code === 'notice_type' ? [{ value: 1, label: '公告', tagType: 'primary' }] : [];
  }
  return { loadDictItems, getDictItems };
});
