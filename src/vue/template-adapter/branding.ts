import type { ComputedRef, InjectionKey } from "vue";

export const managementBrandKey: InjectionKey<ComputedRef<{ title: string; logo?: string; home: string }>> = Symbol("qoj-management-brand");
