/**
 * 比赛列表页面。保留现有比赛数据字段与前台 header/footer，
 * 将比赛列表迁移为独立的赛程卡片布局，并在前端完成筛选与分页。
 */
import {
  Alert,
  Card,
  Checkbox,
  Input,
  Pagination,
  Select,
  Spin,
  Tag,
  Typography,
} from '../ui/compat';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
} from '../ui/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchContests,
  type PublicContest,
} from '../data/apiClient';
import { PageContainer } from '../components/common';
import './ContestsPage.css';

const { Text, Title } = Typography;

const CONTEST_PAGE_SIZE = 10;
const CONTEST_REQUEST_PAGE_SIZE = 100;
type ContestStatusFilter = 'ALL' | PublicContest['status'];

/**
 * 封装状态Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusText(status: PublicContest['status']) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

/**
 * 计算状态标记使用的样式名，便于列表行复用同一套视觉状态。
 */
function statusClass(status: PublicContest['status']) {
  if (status === 'RUNNING') return 'is-running';
  if (status === 'ENDED') return 'is-ended';
  return 'is-upcoming';
}

/**
 * 封装audienceText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
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

/**
 * 封装报名Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function registrationText(value: string) {
  const normalized = value.toUpperCase();
  if (normalized === 'PASSWORD') return '密码报名';
  return normalized === 'PUBLIC' ? '公开报名' : '邀请码报名';
}

/**
 * 格式化DateTime。比赛列表使用正式的完整时间快照，不显示相对时间。
 */
function formatDateTime(dateTime: string): string {
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
 * 返回比赛左侧状态块中的日期文案。
 */
function statusDate(contest: PublicContest) {
  const date = new Date(contest.status === 'ENDED' ? contest.endTime : contest.startTime);
  if (!Number.isFinite(date.getTime())) return '--';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 判断比赛是否在未来 3 天内开始，用于“近期比赛”统计卡片。
 */
function isWithinThreeDays(contest: PublicContest) {
  if (contest.status !== 'NOT_STARTED') return false;
  const start = new Date(contest.startTime).getTime();
  const now = Date.now();
  return Number.isFinite(start) && start >= now && start - now <= 3 * 24 * 60 * 60 * 1000;
}

/**
 * 读取当前账号可见的全部比赛。筛选项在前端执行，因此在需要时补齐后端分页结果，
 * 但不会改变后端接口或新增任何字段。
 */
async function fetchAllVisibleContests() {
  const firstPage = await fetchContests(1, CONTEST_REQUEST_PAGE_SIZE);
  const totalPages = Math.ceil(firstPage.total / CONTEST_REQUEST_PAGE_SIZE);
  if (totalPages <= 1) return firstPage.list;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchContests(index + 2, CONTEST_REQUEST_PAGE_SIZE)),
  );
  return [firstPage.list, ...remainingPages.map((page) => page.list)].flat().slice(0, firstPage.total);
}

/**
 * 渲染Contests页面，并协调其数据加载、状态和交互。
 */
export function ContestsPage() {
  const [contests, setContests] = useState<PublicContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContestStatusFilter>('ALL');
  const [joinedOnly, setJoinedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * 封装filteredContests相关逻辑。对原始数据进行派生或聚合。
   */
  const filteredContests = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return contests.filter((contest) => {
      if (kw && !contest.title.toLowerCase().includes(kw)) return false;
      if (typeFilter && contest.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && contest.status !== statusFilter) return false;
      if (joinedOnly && !contest.registered) return false;
      return true;
    });
  }, [contests, joinedOnly, searchKeyword, statusFilter, typeFilter]);

  const pagedContests = useMemo(() => {
    const start = (currentPage - 1) * CONTEST_PAGE_SIZE;
    return filteredContests.slice(start, start + CONTEST_PAGE_SIZE);
  }, [currentPage, filteredContests]);

  const runningCount = useMemo(
    () => contests.filter((contest) => contest.status === 'RUNNING').length,
    [contests],
  );
  const recentCount = useMemo(
    () => contests.filter(isWithinThreeDays).length,
    [contests],
  );
  const joinedCount = useMemo(
    () => contests.filter((contest) => contest.registered).length,
    [contests],
  );

  /**
   * 筛选条件变化后回到第一页，避免当前页超出筛选结果范围。
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [joinedOnly, searchKeyword, statusFilter, typeFilter]);

  /**
   * 读取Contests并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态。
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 列表筛选在前端完成，先取可见比赛集合，再按每页 10 条呈现。
    fetchAllVisibleContests()
      .then((list) => {
        if (cancelled) return;
        setContests(list);
        setMessage('');
      })
      .catch((error) => {
        if (cancelled) return;
        setContests([]);
        setMessage(error instanceof Error ? error.message : '比赛加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearFilters = () => {
    setSearchKeyword('');
    setTypeFilter('');
    setStatusFilter('ALL');
    setJoinedOnly(false);
  };

  return (
    <PageContainer title="比赛">
      {message && (
        <Alert
          type="info"
          message={message}
          showIcon={false}
          banner
          style={{ marginBottom: 20 }}
        />
      )}

      {loading && (
        <Card className="contests-loading-card">
          <Spin tip="比赛加载中" />
        </Card>
      )}

      {!loading && contests.length > 0 && (
        <div className="contests-page-content">
          <section className="contests-summary-grid" aria-label="比赛统计">
            <div className="contests-summary-card">
              <div>
                <Text className="contests-summary-label">进行中</Text>
                <Title level={3} className="contests-summary-value">{runningCount}</Title>
                <Text className="contests-summary-hint">现在可以进入</Text>
              </div>
              <span className="contests-summary-mark is-blue" aria-hidden="true">●</span>
            </div>
            <div className="contests-summary-card">
              <div>
                <Text className="contests-summary-label">近期比赛</Text>
                <Title level={3} className="contests-summary-value">{recentCount}</Title>
                <Text className="contests-summary-hint">未来 3 天内</Text>
              </div>
              <span className="contests-summary-mark is-amber" aria-hidden="true">◷</span>
            </div>
            <div className="contests-summary-card">
              <div>
                <Text className="contests-summary-label">已报名比赛</Text>
                <Title level={3} className="contests-summary-value">{joinedCount}</Title>
                <Text className="contests-summary-hint">你已报名的比赛</Text>
              </div>
              <span className="contests-summary-mark is-violet" aria-hidden="true">✓</span>
            </div>
          </section>

          <section className="contests-filter-panel" aria-label="比赛筛选">
            <div className="contests-filter-heading">
              <Text strong>筛选比赛</Text>
              <Text type="secondary">共 {filteredContests.length} 场比赛</Text>
            </div>
            <div className="contests-filter-controls">
              <div className="contests-status-tabs" role="group" aria-label="比赛状态">
                {([
                  ['ALL', '全部'],
                  ['RUNNING', '进行中'],
                  ['NOT_STARTED', '即将开始'],
                  ['ENDED', '已结束'],
                ] as Array<[ContestStatusFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`contests-status-tab${statusFilter === value ? ' is-active' : ''}`}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Input
                className="contests-search-field"
                prefix={<SearchOutlined />}
                placeholder="搜索比赛名称"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                allowClear
              />
              <Select
                className="contests-type-field"
                value={typeFilter || undefined}
                placeholder="全部赛制"
                onChange={(value) => setTypeFilter(typeof value === 'string' ? value : '')}
                options={[
                  { label: '全部赛制', value: '' },
                  { label: 'ACM', value: 'ACM' },
                  { label: 'OI', value: 'OI' },
                ]}
              />
              <Checkbox checked={joinedOnly} onChange={(event) => setJoinedOnly(event.target.checked)}>
                只看已报名
              </Checkbox>
              <button type="button" className="contests-clear-button" onClick={clearFilters}>
                <DeleteOutlined />
                清空筛选
              </button>
            </div>
          </section>

          <Card
            className="contests-list-card"
            styles={{ body: { padding: 0 } }}
            title={
              <div className="contests-list-heading">
                <Title level={4}>赛程列表</Title>
              </div>
            }
          >
            <div className="contests-list-body">
              {pagedContests.length === 0 ? (
                <div className="contests-empty-state">没有找到符合条件的比赛，试试清空筛选。</div>
              ) : (
                pagedContests.map((contest) => (
                  <article className="contest-list-item" key={contest.id}>
                    <div className={`contest-list-status ${statusClass(contest.status)}`}>
                      <strong>{statusText(contest.status)}</strong>
                      <small>{statusDate(contest)}</small>
                    </div>
                    <div className="contest-list-main">
                      <div className="contest-list-title-row">
                        <a className="contest-list-title" href={`/contests/${contest.id}`}>
                          {contest.title}
                        </a>
                        <Tag className={`contest-type-tag${contest.type === 'OI' ? ' is-oi' : ''}`}>
                          {contest.type}
                        </Tag>
                        {contest.registered && (
                          <Tag className="contest-joined-tag" icon={<CheckCircleOutlined />}>
                            已报名
                          </Tag>
                        )}
                      </div>
                      <div className="contest-list-meta">
                        <span className="contest-list-time">
                          <CalendarOutlined />
                          <b>时间</b>
                          {formatDateTime(contest.startTime)} – {formatDateTime(contest.endTime)}
                        </span>
                        <span>
                          <ClockCircleOutlined />
                          <b>时长</b>
                          {contest.durationMinutes} 分钟
                        </span>
                        <span>
                          <TeamOutlined />
                          {contest.participantCount ?? 0} 人
                        </span>
                        <span className="contest-audience-tag">{audienceText(contest)}</span>
                      </div>
                      <Text className="contest-list-registration" type="secondary">
                        {registrationText(contest.registrationType)}
                      </Text>
                    </div>
                    <div className="contest-list-side">
                      <a className="contest-list-action" href={`/contests/${contest.id}`}>
                        查看详情
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
            {filteredContests.length > 0 && (
              <div className="contests-pagination-wrap">
                <Text type="secondary">
                  显示第 {Math.min((currentPage - 1) * CONTEST_PAGE_SIZE + 1, filteredContests.length)}-
                  {Math.min(currentPage * CONTEST_PAGE_SIZE, filteredContests.length)} 条，共 {filteredContests.length} 条
                </Text>
                <Pagination
                  current={currentPage}
                  pageSize={CONTEST_PAGE_SIZE}
                  total={filteredContests.length}
                  showSizeChanger={false}
                  onChange={setCurrentPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {!loading && contests.length === 0 && (
        <Card className="contests-empty-card">
          <Text type="secondary">暂无比赛</Text>
        </Card>
      )}
    </PageContainer>
  );
}
