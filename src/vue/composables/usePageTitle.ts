import { shallowRef, watch, type Ref } from "vue";
import { useRoute } from "vue-router";

export const dynamicPageTitle = shallowRef<{ path: string; title: string | null } | null>(null);

/** Keep asynchronously loaded page names scoped to the current navigation. */
export function usePageTitle(title: Readonly<Ref<string | null>>) {
  const route = useRoute();
  watch([title, () => route.fullPath], ([value, path]) => {
    dynamicPageTitle.value = { path, title: value };
  }, { immediate: true, flush: "post" });
}
