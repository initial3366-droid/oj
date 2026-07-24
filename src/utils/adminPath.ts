/**
 * 管理员Path工具模块。提供无页面依赖的通用处理能力。
 */
import { ADMIN_PREFIX } from '../config';

/**
 * 生成后台管理路径
 * @param sub 子路径，如 '/dashboard' 或 '/problems/new'
 * @returns 完整路径，如 '/admin/dashboard'
 */
export function adminPath(sub: string): string {
  return `/${ADMIN_PREFIX}${sub.startsWith('/') ? sub : `/${sub}`}`;
}
