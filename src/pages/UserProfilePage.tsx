/**
 * 用户资料页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { UserRound } from 'lucide-react';
import { AnimatedBadge } from '../components/motion/animated-badge';
import { Loader } from '../components/motion/loader';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicUserProfile, type PublicUserProfile } from '../data/apiClient';
import { PageContainer } from '../components/common';

/**
 * 格式化Date。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

/**
 * 渲染用户资料页面，并协调其数据加载、状态和交互。
 */
export function UserProfilePage() {
  const { userId } = useParams();
  const id = Number(userId ?? 0);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setMessage('用户不存在');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPublicUserProfile(id)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setMessage('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : '用户资料加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <PageContainer title={profile?.displayName ?? '用户主页'} subtitle="User Profile">
      {message && <div role="alert" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, background: '#fff5f5', color: '#9f2525' }}>{message}</div>}
      <div style={{ border: '1px solid var(--qoj-color-border)', borderRadius: 16, padding: 24, background: '#fff' }}>
        {loading ? (
          <div
            style={{
              minHeight: 240,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Loader size={32} label="加载用户资料" />
            <span style={{ color: 'var(--qoj-color-text-2)' }}>
              加载中...
            </span>
          </div>
        ) : profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--qoj-color-primary)', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                {profile.displayName?.charAt(0)?.toUpperCase() || <UserRound size={24} />}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>
                  {profile.displayName}
                </h2>
                <span style={{ display: 'block', marginTop: 6, color: 'var(--qoj-color-text-2)' }}>
                  @{profile.username}
                </span>
              </div>
              <AnimatedBadge status="info" showIcon={false}>{profile.role}</AnimatedBadge>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
              }}
            >
              {[
                ['非比赛 AC', profile.acCount],
                ['提交', profile.submitCount],
                ['总分', profile.totalScore],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: 16, border: '1px solid var(--qoj-color-border)', borderRadius: 8 }}>
                  <span style={{ color: 'var(--qoj-color-text-2)', fontSize: 13 }}>{label}</span>
                  <h3 style={{ margin: '6px 0 0', fontSize: 20 }}>{value}</h3>
                </div>
              ))}
            </div>

            <span style={{ color: 'var(--qoj-color-text-2)' }}>
              加入时间：{formatDate(profile.createdAt)}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--qoj-color-text-2)' }}>用户不存在</span>
        )}
      </div>
    </PageContainer>
  );
}
