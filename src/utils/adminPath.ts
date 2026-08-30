/**
 * 管理员Path工具模块。提供无页面依赖的通用处理能力。
 */
import { ADMIN_PREFIX } from '../config';

const ADMIN_API_CANONICAL_PREFIX = '/api/admin/v1';
const ADMIN_API_PREFIX = (
  import.meta.env.VITE_ADMIN_API_PREFIX || `/api/${ADMIN_PREFIX}/v1`
).replace(/\/+$/, '');

/**
 * 生成后台页面或 API 路径。
 * @param sub 页面子路径（如 '/dashboard'）或稳定后台 API 路径（如 '/api/admin/v1/problems'）
 * @returns 使用当前环境前缀的完整路径
 */
export function adminPath(sub: string): string {
  // API 调用也统一走这个固定入口，避免页面或客户端自行拼接后台前缀。
  if (sub === ADMIN_API_CANONICAL_PREFIX || sub.startsWith(`${ADMIN_API_CANONICAL_PREFIX}/`)) {
    return `${ADMIN_API_PREFIX}${sub.slice(ADMIN_API_CANONICAL_PREFIX.length)}`;
  }
  return `/${ADMIN_PREFIX}${sub.startsWith('/') ? sub : `/${sub}`}`;
}
