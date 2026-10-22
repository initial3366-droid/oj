import { defineStore } from 'pinia';
import { ref } from 'vue';
import { store } from './store';
// QOJ has no tenant switching contract. Keep upstream's feature gate disabled.
export const useTenantStore = defineStore('qoj-template-tenant', () => {
  const tenantList = ref<{ id: number; name: string }[]>([]);
  const currentTenantId = ref<number>();
  const currentTenant = ref<{ id: number; name: string }>();
  async function switchTenant(_id: number): Promise<void> { throw new Error('QOJ 不支持租户切换'); }
  return { tenantList, currentTenantId, currentTenant, switchTenant };
});
export const useTenantStoreHook = () => useTenantStore(store);
