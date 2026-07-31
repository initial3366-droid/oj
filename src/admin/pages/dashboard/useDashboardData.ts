/**
 * use仪表盘Data页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useState, useEffect, useCallback } from 'react';
import { adminGet } from '../../api/adminClient';
import type { AdminDashboard } from '../../../api/admin';

/**
 * 封装仪表盘Data相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
 */
export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 封装reload相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminGet<AdminDashboard>('/api/admin/v1/dashboard');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { loading, data, error, reload };
}
