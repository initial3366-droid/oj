import { Button, Checkbox, Tag, Typography, Spin, Modal, Banner, Space, Table } from '@douyinfe/semi-ui';
import { IconCheckCircleStroked, IconCode, IconShield } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchContestRegistrationOptions,
  fetchContests,
  registerContest,
  type ContestRegistrationOption,
  type PublicContest,
} from '../data/apiClient';
import { PageContainer } from '../components/common';

function statusText(status: PublicContest['status']) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

function statusColor(status: PublicContest['status']): 'green' | 'grey' | 'blue' {
  if (status === 'RUNNING') return 'green';
  if (status === 'ENDED') return 'grey';
  return 'blue';
}

function audienceText(contest: PublicContest) {
  if (contest.audiences?.some((item) => item.audienceType !== 'ALL')) {
    return contest.audiences.filter((item) => item.audienceType === 'CLASS').map((item) => item.name).join('、') || '指定范围';
  }
  if (contest.audience === 'CLASS') return '指定范围';
  return '全校公开';
}

function registrationText(value: string) {
  if (value === 'PASSWORD') return '密码报名';
  return value === 'PUBLIC' ? '公开报名' : '邀请码';
}

function formatDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function ContestsPage() {
  const [contests, setContests] = useState<PublicContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeContest, setActiveContest] = useState<PublicContest | null>(null);
  const [options, setOptions] = useState<ContestRegistrationOption[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [starred, setStarred] = useState(false);
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [optionLoading, setOptionLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const loadContests = () => {
    setLoading(true);
    fetchContests()
      .then((data) => {
        setContests(data.list);
        setMessage('');
      })
      .catch((error) => {
        setContests([]);
        setMessage(error instanceof Error ? error.message : '比赛加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContests();
  }, []);

  const selectedOption = useMemo(() => {
    return options.find((item) => `${item.identityType}:${item.identityId ?? ''}` === selectedKey);
  }, [options, selectedKey]);

  const openRegister = async (contest: PublicContest) => {
    setActiveContest(contest);
    setOptions([]);
    setSelectedKey('');
    setStarred(Boolean(contest.registeredStarred));
    setRegistrationPassword('');
    setMessage('');
    setOptionLoading(true);
    try {
      const visibleOptions = await fetchContestRegistrationOptions(contest.id);
      setOptions(visibleOptions);
      const currentKey = contest.registeredIdentityType
        ? `${contest.registeredIdentityType}:${contest.registeredIdentityId ?? ''}`
        : '';
      const firstAvailable = visibleOptions.find((item) => item.available);
      setSelectedKey(visibleOptions.some((item) => `${item.identityType}:${item.identityId ?? ''}` === currentKey)
        ? currentKey
        : firstAvailable
          ? `${firstAvailable.identityType}:${firstAvailable.identityId ?? ''}`
          : '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '报名选项加载失败');
      setActiveContest(null);
    } finally {
      setOptionLoading(false);
    }
  };

  const submitRegister = async () => {
    if (!activeContest || !selectedOption || !selectedOption.available) {
      return;
    }
    setRegistering(true);
    try {
      await registerContest(activeContest.id, {
        identityType: 'PERSONAL',
        starred: activeContest.allowStarRegistration ? starred : false,
        password: activeContest.hasPassword ? registrationPassword : undefined,
      });
      setActiveContest(null);
      setOptions([]);
      setRegistrationPassword('');
      setStarred(false);
      setMessage('报名信息已保存。');
      loadContests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '报名失败');
    } finally {
      setRegistering(false);
    }
  };

  const columns = [
    {
      title: '比赛名称',
      dataIndex: 'title',
      render: (title: string, contest: PublicContest) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ showTooltip: true }}>
            {title}
          </Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <Tag color={statusColor(contest.status)} size="small">{statusText(contest.status)}</Tag>
            <Tag size="small" type="ghost">{contest.type}</Tag>
            {contest.allowStarRegistration ? <Tag color="amber" size="small">支持打星</Tag> : null}
            {contest.registered ? <Tag color="green" size="small">已报名</Tag> : null}
            {contest.registeredStarred ? <Tag color="amber" size="small">打星</Tag> : null}
          </div>
        </div>
      ),
    },
    {
      title: '范围/报名',
      width: 180,
      render: (_: unknown, contest: PublicContest) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography.Text>{audienceText(contest)}</Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 13 }}>{registrationText(contest.registrationType)}</Typography.Text>
        </div>
      ),
    },
    {
      title: '时间',
      width: 260,
      render: (_: unknown, contest: PublicContest) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>开始：{formatDateTime(contest.startTime)}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>结束：{formatDateTime(contest.endTime)}</Typography.Text>
        </div>
      ),
    },
    {
      title: '报名人数',
      dataIndex: 'participantCount',
      width: 110,
      render: (count: number) => <Typography.Text>{count} 人</Typography.Text>,
    },
    {
      title: '操作',
      width: 260,
      render: (_: unknown, contest: PublicContest) => (
        <Space spacing={8} wrap>
          {contest.status === 'ENDED' ? (
            <Button
              type="primary"
              icon={<IconCode />}
              onClick={() => {
                window.location.href = `/contests/${contest.id}`;
              }}
            >
              查看
            </Button>
          ) : (
            <Button type="primary" onClick={() => openRegister(contest)}>
              {contest.registered ? '修改报名' : '报名'}
            </Button>
          )}
          {contest.registered && contest.status !== 'ENDED' && (
            <Button
              theme="borderless"
              icon={<IconCode />}
              onClick={() => {
                window.location.href = `/contests/${contest.id}`;
              }}
            >
              进入
            </Button>
          )}
          {contest.publicScoreboardEnabled !== false && (
            <Button
              theme="borderless"
              icon={<IconShield />}
              onClick={() => {
                window.location.href = `/contests/${contest.id}/public-scoreboard`;
              }}
            >
              外榜
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="比赛"
      subtitle="Contest Center"
      description="比赛报名、参赛与提交统计。"
    >
      {message && (
        <Banner
          type="info"
          description={message}
          closeIcon={null}
          style={{ marginBottom: 24 }}
        />
      )}

      {loading && (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid var(--semi-color-border)',
            background: 'var(--semi-color-bg-0)',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <Spin tip="比赛加载中" />
        </div>
      )}

      {!loading && contests.length > 0 && (
        <Table
          rowKey="id"
          dataSource={contests}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      )}

      {!loading && contests.length === 0 && (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid var(--semi-color-border)',
            background: 'var(--semi-color-bg-0)',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <Typography.Text type="tertiary">暂无比赛</Typography.Text>
        </div>
      )}

      <Modal
        title="比赛报名"
        visible={!!activeContest}
          onCancel={() => {
            if (!registering) {
              setActiveContest(null);
              setRegistrationPassword('');
              setStarred(false);
            }
          }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => {
              setActiveContest(null);
              setRegistrationPassword('');
              setStarred(false);
            }}>取消</Button>
            <Button
              type="primary"
              disabled={!selectedOption?.available || registering || Boolean(activeContest?.hasPassword && !registrationPassword.trim())}
              loading={registering}
              onClick={submitRegister}
            >
              {registering ? '保存中' : '确认报名'}
            </Button>
          </div>
        }
      >
        {activeContest && (
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {activeContest.title}
            </Typography.Text>
            {activeContest.hasPassword && (
              <label style={{ display: 'block', marginBottom: 16 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                  比赛密码
                </Typography.Text>
                <input
                  type="password"
                  value={registrationPassword}
                  onChange={(event) => setRegistrationPassword(event.target.value)}
                  placeholder="请输入比赛密码"
                  style={{
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid var(--semi-color-border)',
                    padding: '10px 12px',
                    outline: 'none',
                  }}
                />
              </label>
            )}

            {activeContest.allowStarRegistration && (
              <label style={{ display: 'block', marginBottom: 16 }}>
                <Checkbox checked={starred} onChange={(event) => setStarred(Boolean(event.target.checked))}>
                  打星报名
                </Checkbox>
              </label>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {optionLoading && (
                <div
                  style={{
                    borderRadius: 6,
                    border: '1px solid var(--semi-color-border)',
                    backgroundColor: 'var(--semi-color-fill-0)',
                    padding: '32px 16px',
                    textAlign: 'center',
                  }}
                >
                  <Spin tip="报名信息加载中" />
                </div>
              )}

              {!optionLoading &&
                options.map((option) => {
                  const key = `${option.identityType}:${option.identityId ?? ''}`;
                  const active = selectedKey === key;
                  return (
                    <button
                      key={key}
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        border: `1px solid ${active ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                        backgroundColor: active ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 14,
                        transition: 'all 0.2s',
                        opacity: option.available ? 1 : 0.55,
                        cursor: option.available ? 'pointer' : 'not-allowed',
                      }}
                      disabled={!option.available}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text strong>个人报名</Typography.Text>
                        {active && <IconCheckCircleStroked style={{ color: 'var(--semi-color-primary)', fontSize: 17 }} />}
                      </div>
                      <Typography.Text type="secondary" style={{ marginTop: 4, display: 'block' }}>
                        {option.name}
                      </Typography.Text>
                      {!option.available && option.disabledReason && (
                        <Typography.Text type="danger" style={{ marginTop: 8, display: 'block', fontSize: 12 }}>
                          {option.disabledReason}
                        </Typography.Text>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
