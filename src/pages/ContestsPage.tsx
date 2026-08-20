/**
 * Contests页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Alert, Button, Checkbox, Input, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { CodeOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchContestRegistrationOptions,
  fetchContests,
  registerContest,
  type ContestRegistrationOption,
  type PublicContest,
} from '../data/apiClient';
import { PageContainer } from '../components/common';

const { Text } = Typography;

/**
 * 封装状态Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusText(status: PublicContest['status']) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

/**
 * 封装状态Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusColor(status: PublicContest['status']): 'success' | 'default' | 'processing' {
  if (status === 'RUNNING') return 'success';
  if (status === 'ENDED') return 'default';
  return 'processing';
}

/**
 * 封装audienceText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function audienceText(contest: PublicContest) {
  if (contest.audiences?.some((item) => item.audienceType !== 'ALL')) {
    return contest.audiences.filter((item) => item.audienceType === 'CLASS').map((item) => item.name).join('、') || '指定范围';
  }
  if (contest.audience === 'CLASS') return '指定范围';
  return '全校公开';
}

/**
 * 封装报名Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function registrationText(value: string) {
  if (value === 'PASSWORD') return '密码报名';
  return value === 'PUBLIC' ? '公开报名' : '邀请码';
}

/**
 * 格式化DateTime。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 渲染Contests页面，并协调其数据加载、状态和交互。
 */
export function ContestsPage() {
  const [contests, setContests] = useState<PublicContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeContest, setActiveContest] = useState<PublicContest | null>(null);
  const [options, setOptions] = useState<ContestRegistrationOption[]>([]);
  const [starred, setStarred] = useState(false);
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [optionLoading, setOptionLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  /**
   * 封装filteredContests相关逻辑。对原始数据进行派生或聚合。
   */
  const filteredContests = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return contests.filter((c) => {
      if (kw && !c.title.toLowerCase().includes(kw)) return false;
      if (typeFilter && c.type !== typeFilter) return false;
      return true;
    });
  }, [contests, searchKeyword, typeFilter]);

  /**
   * 读取Contests并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
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

  /**
   * 封装open注册相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const openRegister = async (contest: PublicContest) => {
    setActiveContest(contest);
    setOptions([]);
    setStarred(Boolean(contest.registeredStarred));
    setRegistrationPassword('');
    setMessage('');
    setOptionLoading(true);
    try {
      const visibleOptions = await fetchContestRegistrationOptions(contest.id);
      setOptions(visibleOptions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '报名选项加载失败');
      setActiveContest(null);
    } finally {
      setOptionLoading(false);
    }
  };

  /**
   * 创建或提交注册。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const submitRegister = async () => {
    const option = options[0];
    if (!activeContest || !option?.available) {
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

  const columns: TableColumnsType<PublicContest> = [
    {
      title: '比赛名称',
      dataIndex: 'title',
      render: (title: string, contest) => (
        <div style={{ minWidth: 0 }}>
          <Text
            strong
            ellipsis={{ tooltip: title }}
            style={{ cursor: 'pointer', color: '#1677ff' }}
            onClick={() => { window.location.href = `/contests/${contest.id}`; }}
          >
            {title}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <Tag color={statusColor(contest.status)} style={{ marginInlineEnd: 0 }}>{statusText(contest.status)}</Tag>
            <Tag style={{ marginInlineEnd: 0 }}>{contest.type}</Tag>
            {contest.allowStarRegistration ? <Tag color="gold" style={{ marginInlineEnd: 0 }}>支持打星</Tag> : null}
            {contest.registered ? <Tag color="success" style={{ marginInlineEnd: 0 }}>已报名</Tag> : null}
            {contest.registeredStarred ? <Tag color="gold" style={{ marginInlineEnd: 0 }}>打星</Tag> : null}
          </div>
        </div>
      ),
    },
    {
      title: '范围/报名',
      width: 180,
      render: (_: unknown, contest) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text>{audienceText(contest)}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>{registrationText(contest.registrationType)}</Text>
        </div>
      ),
    },
    {
      title: '时间',
      width: 260,
      render: (_: unknown, contest) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>开始：{formatDateTime(contest.startTime)}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>结束：{formatDateTime(contest.endTime)}</Text>
        </div>
      ),
    },
    {
      title: '报名人数',
      dataIndex: 'participantCount',
      width: 110,
      render: (count: number) => <Text>{count} 人</Text>,
    },
    {
      title: '操作',
      width: 260,
      render: (_: unknown, contest) => (
        <Space size={8} wrap>
          {contest.status === 'ENDED' ? (
            <Button
              type="primary"
              icon={<CodeOutlined />}
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
              icon={<CodeOutlined />}
              onClick={() => {
                window.location.href = `/contests/${contest.id}`;
              }}
            >
              进入
            </Button>
          )}
          {contest.publicScoreboardEnabled === true && (
            <Button
              icon={<SafetyCertificateOutlined />}
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
    >
      {message && (
        <Alert
          type="info"
          message={message}
          showIcon={false}
          banner
          style={{ marginBottom: 24 }}
        />
      )}

      {loading && (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            background: '#ffffff',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <Spin tip="比赛加载中" />
        </div>
      )}

      {!loading && contests.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索比赛名称"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              placeholder="赛制"
              value={typeFilter || undefined}
              onChange={(v) => setTypeFilter(typeof v === 'string' ? v : '')}
              style={{ width: 140 }}
              options={[
                { label: '全部赛制', value: '' },
                { label: 'ACM', value: 'ACM' },
                { label: 'OI', value: 'OI' },
              ]}
            />
          </div>
          <Table
            rowKey="id"
            dataSource={filteredContests}
            columns={columns}
            pagination={{ pageSize: 20 }}
          />
        </>
      )}

      {!loading && contests.length === 0 && (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            background: '#ffffff',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <Text type="secondary">暂无比赛</Text>
        </div>
      )}

      <Modal
        title="比赛报名"
        open={!!activeContest}
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
              disabled={!options[0]?.available || registering || Boolean(activeContest?.hasPassword && !registrationPassword.trim())}
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
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {activeContest.title}
            </Text>

            {optionLoading ? (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid #f0f0f0',
                  backgroundColor: '#fafafa',
                  padding: '32px 16px',
                  textAlign: 'center',
                }}
              >
                <Spin tip="报名信息加载中" />
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 16,
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                    backgroundColor: '#fafafa',
                    padding: '12px 16px',
                  }}
                >
                  <Text strong>将以账号 {options[0]?.name || '-'} 报名</Text>
                </div>
                {options[0] && !options[0].available && options[0].disabledReason && (
                  <Alert
                    type="warning"
                    showIcon
                    message={options[0].disabledReason}
                    style={{ marginBottom: 16 }}
                  />
                )}
              </>
            )}

            {activeContest.hasPassword && (
              <label style={{ display: 'block', marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  比赛密码
                </Text>
                <Input.Password
                  value={registrationPassword}
                  onChange={(event) => setRegistrationPassword(event.target.value)}
                  placeholder="请输入比赛密码"
                />
              </label>
            )}

            {activeContest.allowStarRegistration && (
              <label style={{ display: 'block', marginBottom: 16 }}>
                <Checkbox checked={starred} onChange={(event) => setStarred(event.target.checked)}>
                  打星报名
                </Checkbox>
              </label>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
