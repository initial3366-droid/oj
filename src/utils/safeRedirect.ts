/**
 * safeRedirect工具模块。提供无页面依赖的通用处理能力。
 */
export function safeSameOriginPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/")) return fallback;

  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
