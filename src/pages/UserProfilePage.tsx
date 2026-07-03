import { Avatar, Banner, Card, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { IconUser } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicUserProfile, type PublicUserProfile } from '../data/apiClient';
import { PageContainer } from '../components/common';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

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
      {message && <Banner type="danger" description={message} closeIcon={null} style={{ marginBottom: 24 }} />}
      <Card style={{ border: '1px solid var(--semi-color-border)' }}>
        {loading ? (
          <div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Avatar size="large" color="blue">
                {profile.displayName?.charAt(0)?.toUpperCase() || <IconUser />}
              </Avatar>
              <div>
                <Typography.Title heading={3} style={{ margin: 0 }}>
                  {profile.displayName}
                </Typography.Title>
                <Typography.Text type="tertiary" style={{ display: 'block', marginTop: 6 }}>
                  @{profile.username}
                </Typography.Text>
              </div>
              <Tag color="blue">{profile.role}</Tag>
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
                <div key={label} style={{ padding: 16, border: '1px solid var(--semi-color-border)', borderRadius: 8 }}>
                  <Typography.Text type="tertiary" style={{ fontSize: 13 }}>{label}</Typography.Text>
                  <Typography.Title heading={4} style={{ margin: '6px 0 0' }}>{value}</Typography.Title>
                </div>
              ))}
            </div>

            <Typography.Text type="tertiary">
              加入时间：{formatDate(profile.createdAt)}
            </Typography.Text>
          </div>
        ) : (
          <Typography.Text type="tertiary">用户不存在</Typography.Text>
        )}
      </Card>
    </PageContainer>
  );
}
