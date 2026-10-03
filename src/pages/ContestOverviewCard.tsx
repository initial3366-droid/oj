/** 比赛详情顶部概览：比赛状态、赛程、倒计时和参赛操作。 */
import { Alert, Button, Card, Tag } from '../ui/compat';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
} from '../ui/icons';
import type { ReactNode } from 'react';
import type { PublicContest } from '../data/apiClient';
import type { ContestPhase } from '../lib/useContestClock';
import './ContestOverviewCard.css';

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
  if (!Number.isFinite(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * 比赛可见范围文案，与比赛列表沿用同一字段语义，不引入新的后端字段。
 */
function audienceText(contest: PublicContest) {
  if (contest.audiences?.some((item) => item.audienceType !== 'ALL')) {
    return contest.audiences
      .filter((item) => item.audienceType === 'CLASS')
      .map((item) => item.name)
      .join('、') || '指定范围';
  }
  if (contest.audience === 'CLASS') return '指定范围';
  return '全校公开';
}

function registrationTypeText(type: string) {
  if (type === 'PASSWORD') return '密码报名';
  if (type === 'INVITATION') return '邀请码报名';
  return '公开报名';
}

/**
 * 计算比赛进度，用于顶部深色时钟卡片的进度条与分钟摘要。
 */
function contestProgress(contest: PublicContest, phase: ContestPhase) {
  if (phase === 'not-started') return 0;
  if (phase === 'ended') return 100;
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
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
  const showCountdown = phase !== 'ended';
  const showAfterEndAlert = contest.status === 'ENDED' && contest.allowAfterEndSubmit;
  const registered = contest.registered;
  const registrationCount = contest.registrationCount ?? 0;
  const registerDisabled = Boolean(registrationDisabledReason);
  const progress = contestProgress(contest, phase);
  const elapsedMinutes = Math.min(contest.durationMinutes, Math.round((contest.durationMinutes * progress) / 100));
  const remainingMinutes = Math.max(0, contest.durationMinutes - elapsedMinutes);

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
    <Card className="contest-overview-card">
      <section className="contest-overview-main">
        <div className="contest-overview-content">
          <div className="contest-overview-eyebrow"><span aria-hidden="true" />比赛信息</div>
          <div className="contest-overview-title-line">
            <h1 className="contest-overview-title">{contest.title}</h1>
            <span className={`contest-overview-status is-${phase}`}>
              <span aria-hidden="true" />
              {phaseText(phase)}
            </span>
          </div>
          <div className="contest-overview-meta-list">
            <span className="contest-overview-meta-item">
              <TrophyOutlined aria-hidden="true" />
              {contest.type === 'ACM' ? 'ACM / ICPC' : 'OI'} 赛制
            </span>
            <span className="contest-overview-meta-item">
              <TeamOutlined aria-hidden="true" />
              {audienceText(contest)}
            </span>
            <span className="contest-overview-meta-item">
              <UserAddOutlined aria-hidden="true" />
              {registrationTypeText(contest.registrationType)}
            </span>
          </div>

          <div className="contest-overview-schedule" aria-label="比赛时间">
            <div className="contest-overview-schedule-heading">
              <CalendarOutlined aria-hidden="true" />
              <span>比赛时间</span>
              <small>以本地时间为准</small>
            </div>
            <div className="contest-overview-schedule-track">
              <div className="contest-overview-schedule-time">
                <span>开始时间</span>
                <strong>{formatDate(contest.startTime)}</strong>
              </div>
              <div className="contest-overview-schedule-duration" aria-label={`比赛时长 ${contest.durationMinutes} 分钟`}>
                <span>{contest.durationMinutes} 分钟</span>
              </div>
              <div className="contest-overview-schedule-time">
                <span>结束时间</span>
                <strong>{formatDate(contest.endTime)}</strong>
              </div>
            </div>
          </div>
        </div>

        <aside
          className={`contest-overview-clock${showCountdown ? '' : ' is-ended'}`}
          aria-label={showCountdown ? '比赛倒计时' : '比赛结束状态'}
        >
          <div className="contest-overview-clock-kicker">
            <span>赛事计时</span>
            <span className="contest-overview-live-pip">{phase === 'running' ? '进行中' : phase === 'ended' ? '已结束' : '即将开始'}</span>
          </div>
          <div className="contest-overview-clock-body">
            <span className="contest-overview-clock-label">{showCountdown ? countdownLabel : '本场比赛'}</span>
            <strong className="contest-overview-clock-value">{showCountdown ? countdownValue : '已结束'}</strong>
          </div>
          <div className="contest-overview-clock-progress">
            <div className="contest-overview-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="contest-overview-clock-foot">
              <span>{phase === 'not-started' ? '等待开赛' : phase === 'ended' ? '赛程已完成' : `已进行 ${progress}%`}</span>
              <span>{phase === 'running' ? `剩余约 ${remainingMinutes} 分钟` : `时长 ${contest.durationMinutes} 分钟`}</span>
            </div>
          </div>
        </aside>
      </section>

      {showAfterEndAlert && (
        <Alert
          type="warning"
          showIcon
          message="比赛已结束，仍可提交代码，但不会计入排行榜。"
          className="contest-overview-alert"
        />
      )}

      <div className="contest-overview-footer">
        <div className="contest-overview-participation">
          <span className="contest-overview-participation-icon" aria-hidden="true"><TeamOutlined /></span>
          <span><strong>{registrationCount}</strong> 人报名</span>
          {registered ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginInlineEnd: 0 }}>
              已报名
            </Tag>
          ) : registrationClosed ? (
            <Tag style={{ marginInlineEnd: 0 }}>报名已截止</Tag>
          ) : (
            <Tag color="processing" style={{ marginInlineEnd: 0 }}>开放报名</Tag>
          )}
        </div>

        <div className="contest-overview-actions">
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
            <span className="contest-overview-register-reason">
              {registrationDisabledReason}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
