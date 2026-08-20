/**
 * 比赛详情顶部概览 Card 组件。展示比赛阶段、赛制、标题、描述、时间、
 * 倒计时、赛后提示、报名人数与操作按钮，严格使用 Ant Design 组件与
 * theme token 颜色，不做渐变、悬浮动画或多层嵌套。
 */
import { Alert, Button, Card, Divider, Flex, Space, Statistic, Tag, Typography, theme } from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { PublicContest } from '../data/apiClient';
import type { ContestPhase } from '../lib/useContestClock';
import './ContestOverviewCard.css';

const { Text, Title } = Typography;

/**
 * ContestOverviewCardProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ContestOverviewCardProps {
  contest: PublicContest;
  phase: ContestPhase;
  countdownLabel: string;
  countdownValue: string;
  registrationClosed: boolean;
  registrationLoading: boolean;
  registrationDisabledReason: string;
  canViewProblemsAfterEnd: boolean;
  onRegister: () => void;
  onEnterContest: () => void;
}

/**
 * 阶段对应的 Tag 颜色。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function phaseTagColor(phase: ContestPhase): 'processing' | 'success' | 'default' {
  if (phase === 'running') return 'success';
  if (phase === 'ended') return 'default';
  return 'processing';
}

/**
 * 阶段文案。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function phaseText(phase: ContestPhase) {
  if (phase === 'running') return '进行中';
  if (phase === 'ended') return '已结束';
  return '未开始';
}

/**
 * 格式化时间为 MM/DD HH:mm。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDate(dateTime: string): string {
  const date = new Date(dateTime);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * 渲染比赛详情顶部概览 Card，并协调其数据加载、状态和交互。
 */
export function ContestOverviewCard({
  contest,
  phase,
  countdownLabel,
  countdownValue,
  registrationClosed,
  registrationLoading,
  registrationDisabledReason,
  canViewProblemsAfterEnd,
  onRegister,
  onEnterContest,
}: ContestOverviewCardProps) {
  const { token } = theme.useToken();
  const showCountdown = phase !== 'ended';
  const showAfterEndAlert = contest.status === 'ENDED' && contest.allowAfterEndSubmit;
  const registered = contest.registered;
  const registrationCount = contest.registrationCount ?? 0;
  const registerDisabled = Boolean(registrationDisabledReason);

  /**
   * 主操作按钮。按阶段与报名状态派生，保持与报名功能完全一致的入口。
   */
  let primaryAction: { label: string; icon: ReactNode; onClick: () => void } | null = null;
  if (phase === 'not-started' || (phase === 'running' && !registrationClosed)) {
    if (!registered) {
      primaryAction = { label: '立即报名', icon: <UserAddOutlined />, onClick: onRegister };
    }
  }
  if (phase === 'ended' && canViewProblemsAfterEnd) {
    primaryAction = {
      label: contest.allowAfterEndSubmit ? '赛后练习' : '查看题目',
      icon: <ArrowRightOutlined />,
      onClick: onEnterContest,
    };
  }

  return (
    <Card
      className="contest-overview-card"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: 'none',
      }}
    >
      <section className="contest-overview-main">
        <div className="contest-overview-content">
          <Space size={8} wrap>
            <Tag color={phaseTagColor(phase)} style={{ marginInlineEnd: 0 }}>
              {phaseText(phase)}
            </Tag>
            <Tag style={{ marginInlineEnd: 0 }}>{contest.type}</Tag>
          </Space>
          <Title level={1} className="contest-overview-title" style={{ color: token.colorText }}>
            {contest.title}
          </Title>
          <Flex className="contest-overview-times" wrap gap={12}>
            <Text className="contest-overview-time-item" style={{ color: token.colorTextSecondary }}>
              <CalendarOutlined style={{ marginInlineEnd: 6 }} />
              {formatDate(contest.startTime)} → {formatDate(contest.endTime)}
            </Text>
            <Text className="contest-overview-time-item" style={{ color: token.colorTextSecondary }}>
              {contest.durationMinutes} 分钟
            </Text>
          </Flex>
          {showAfterEndAlert && (
            <Alert
              type="warning"
              showIcon
              message="比赛已结束，仍可提交代码，但不会计入排行榜。"
              className="contest-overview-alert"
            />
          )}
        </div>

        {showCountdown && (
          <div
            className="contest-overview-clock"
            style={{
              background: token.colorPrimaryBg,
              border: `1px solid ${token.colorPrimaryBorder}`,
            }}
          >
            <Statistic
              title={<span style={{ color: token.colorTextSecondary }}>{countdownLabel}</span>}
              value={countdownValue}
              styles={{ content: { color: token.colorPrimary, fontSize: 24, fontWeight: 600 } }}
            />
          </div>
        )}
      </section>

      <Divider className="contest-overview-divider" style={{ borderColor: token.colorSplit }} />

      <Flex className="contest-overview-footer" justify="space-between" align="center" wrap gap={12}>
        <Space size={16} wrap>
          <Text className="contest-overview-meta" style={{ color: token.colorTextSecondary }}>
            <TeamOutlined style={{ marginInlineEnd: 6 }} />
            {registrationCount} 人报名
          </Text>
          {registered ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginInlineEnd: 0 }}>
              已报名
            </Tag>
          ) : registrationClosed ? (
            <Tag style={{ marginInlineEnd: 0 }}>报名已截止</Tag>
          ) : null}
        </Space>

        <Space size={8} wrap className="contest-overview-actions">
          {contest.publicScoreboardEnabled === true && (
            <Button
              icon={<TrophyOutlined />}
              href={`/contests/${contest.id}/public-scoreboard`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看外榜
            </Button>
          )}
          {primaryAction && (
            <Button
              type="primary"
              icon={primaryAction.icon}
              loading={primaryAction.label === '立即报名' ? registrationLoading : false}
              disabled={primaryAction.label === '立即报名' && registerDisabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}
          {primaryAction?.label === '立即报名' && registerDisabled && registrationDisabledReason && (
            <Text type="secondary" className="contest-overview-register-reason">
              {registrationDisabledReason}
            </Text>
          )}
        </Space>
      </Flex>
    </Card>
  );
}
