import { useState, useEffect, useCallback } from 'react';
import { adminGet } from '../../api/adminClient';
import type { AdminDashboard } from '../../../api/admin';

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

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
