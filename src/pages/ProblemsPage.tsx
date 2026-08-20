/**
 * Problems页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Alert, Button, Card, Input, Pagination, Select, Table, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchProblems } from '../data/apiClient';
import type { Difficulty, Problem } from '../data/types';
import { PageContainer } from '../components/common';

const { Text } = Typography;

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: Difficulty }> = [
  { value: '入门', label: '入门' },
  { value: '简单', label: '简单' },
  { value: '中等', label: '中等' },
  { value: '困难', label: '困难' },
  { value: '地狱', label: '地狱' },
];

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
type AttemptState = 'passed' | 'failed' | 'unattempted';

const ATTEMPT_STATE_OPTIONS: Array<{ value: AttemptState; label: string }> = [
  { value: 'failed', label: '未通过' },
  { value: 'passed', label: '通过' },
  { value: 'unattempted', label: '未尝试' },
];

/**
 * 归一化题目提交状态，供状态标签和筛选共用，避免两处规则不一致。
 */
function getAttemptState(status?: string | null): AttemptState {
  const normalized = status?.trim().toUpperCase();
  if (!normalized) return 'unattempted';
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'passed';
  return 'failed';
}

/**
 * 封装attemptBadge相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function attemptBadge(problem: Problem) {
  const state = getAttemptState(problem.attemptStatus);
  if (state === 'passed') {
    return (
      <Tag color="success" style={{ marginInlineEnd: 0 }}>
        已通过
      </Tag>
    );
  }
  if (state === 'failed') {
    return (
      <Tag color="error" style={{ marginInlineEnd: 0 }}>
        未通过
      </Tag>
    );
  }
  return (
    <Tag style={{ marginInlineEnd: 0 }}>
      未尝试
    </Tag>
  );
}

/**
 * 渲染Problems页面，并协调其数据加载、状态和交互。
 */
export function ProblemsPage() {
  const [sourceProblems, setSourceProblems] = useState<Problem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAttemptState, setSelectedAttemptState] = useState<AttemptState | null>(null);
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // 从已加载题目中收集全部标签（去重 + 按出现频次排序，便于筛选高频标签）
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const problem of sourceProblems) {
      for (const tag of problem.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value);
  }, [sourceProblems]);

  useEffect(() => {
    let cancelled = false;
    /**
     * 读取Problems并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；对原始数据进行派生或聚合。
     */
    const loadProblems = () => {
      fetchProblems()
        .then((data) => {
          if (!cancelled) {
            setSourceProblems(data);
            // 题库刷新后，丢弃已不存在的标签筛选
            const remainingTags = new Set<string>();
            for (const problem of data) {
              for (const tag of problem.tags) remainingTags.add(tag);
            }
            setSelectedTags((prev) => prev.filter((t) => remainingTags.has(t)));
            setMessage('');
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSourceProblems([]);
            setMessage(error instanceof Error ? error.message : '题库加载失败');
          }
        });
    };
    loadProblems();
    window.addEventListener('focus', loadProblems);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadProblems);
    };
  }, []);

  /**
   * 封装problems相关逻辑。对原始数据进行派生或聚合。
   */
  const problems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return sourceProblems.filter((problem) => {
      if (normalized) {
        const matched =
          problem.title.toLowerCase().includes(normalized) ||
          problem.tags.some((tag) => tag.toLowerCase().includes(normalized));
        if (!matched) return false;
      }
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(problem.difficulty)) {
        return false;
      }
      if (
        selectedTags.length > 0 &&
        !selectedTags.every((tag) => problem.tags.includes(tag))
      ) {
        return false;
      }
      if (selectedAttemptState && getAttemptState(problem.attemptStatus) !== selectedAttemptState) {
        return false;
      }
      return true;
    });
  }, [keyword, sourceProblems, selectedDifficulties, selectedTags, selectedAttemptState]);

  // 筛选条件变化后从第一页重新展示，避免保留一个已经越界的页码。
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedDifficulties, selectedTags, selectedAttemptState]);

  const pagedProblems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return problems.slice(start, start + pageSize);
  }, [currentPage, pageSize, problems]);

  const currentStart = problems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const currentEnd = Math.min(currentPage * pageSize, problems.length);

  /**
   * 读取DifficultyColor并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getDifficultyColor = (
    difficulty: string,
  ): 'success' | 'warning' | 'error' | 'default' => {
    const normalized = difficulty.toLowerCase();
    if (normalized.includes('简单') || normalized === 'easy' || normalized === '入门')
      return 'success';
    if (normalized.includes('中等') || normalized === 'medium') return 'warning';
    if (normalized.includes('困难') || normalized === 'hard' || normalized === '地狱')
      return 'error';
    return 'default';
  };

  const columns: TableColumnsType<Problem> = [
    {
      title: '题目',
      dataIndex: 'title',
      width: 300,
      render: (title: string, record) => (
        <NavLink
          to={`/practice/problem/${record.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#1677ff',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {title}
        </NavLink>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 250,
      render: (tags: string[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((tag) => (
            <Tag key={tag} style={{ marginInlineEnd: 0 }}>
              {tag}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 100,
      render: (difficulty: string) => (
        <Tag color={getDifficultyColor(difficulty)} style={{ marginInlineEnd: 0 }}>
          {difficulty}
        </Tag>
      ),
    },
    {
      title: '是否通过',
      dataIndex: 'attemptStatus',
      width: 120,
      render: (_text, record) => attemptBadge(record),
    },
    {
      title: 'AC 率',
      dataIndex: 'acRate',
      width: 100,
      render: (acRate: number) => (
        <Text style={{ fontSize: 14 }}>{acRate}%</Text>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (_text, record) => (
        <NavLink
          to={`/practice/problem/${record.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1677ff', textDecoration: 'none' }}
        >
          答题
        </NavLink>
      ),
    },
  ];

  return (
    <PageContainer
      title="题库"
    >
      {message && (
        <Alert
          type="error"
          message={message}
          showIcon={false}
          banner
          style={{ marginBottom: 24 }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索题目或标签"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          allowClear
          onClear={() => setKeyword('')}
          style={{ width: 280 }}
        />
        <Select
          mode="multiple"
          placeholder="难度"
          value={selectedDifficulties}
          onChange={(value) => setSelectedDifficulties(value as Difficulty[])}
          style={{ minWidth: 160 }}
          options={DIFFICULTY_OPTIONS}
          notFoundContent="无匹配难度"
        />
        <Select
          mode="multiple"
          showSearch
          placeholder="标签"
          value={selectedTags}
          onChange={(value) => setSelectedTags(value as string[])}
          style={{ minWidth: 200, maxWidth: 360 }}
          options={allTags.map((tag) => ({ value: tag, label: tag }))}
          notFoundContent="无匹配标签"
        />
        <Select
          placeholder="是否通过"
          value={selectedAttemptState ?? undefined}
          onChange={(value) => setSelectedAttemptState((value as AttemptState | undefined) ?? null)}
          allowClear
          style={{ minWidth: 140 }}
          options={ATTEMPT_STATE_OPTIONS}
        />
        {(selectedDifficulties.length > 0 || selectedTags.length > 0 || selectedAttemptState || keyword) && (
          <Button
            onClick={() => {
              setKeyword('');
              setSelectedDifficulties([]);
              setSelectedTags([]);
              setSelectedAttemptState(null);
            }}
          >
            清除筛选
          </Button>
        )}
        <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 13 }}>
          共 {problems.length} 题
        </Text>
      </div>

      <Card
        style={{
          border: '1px solid #f0f0f0',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={pagedProblems}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Text type="secondary">
                  {(keyword || selectedDifficulties.length > 0 || selectedTags.length > 0 || selectedAttemptState)
                    ? '未找到匹配的题目，试试调整筛选条件'
                    : '暂无题目'}
                </Text>
              </div>
            ),
          }}
        />
      </Card>

      {problems.length > 0 && (
        <div className="front-table-pagination">
          <Text type="secondary">
            显示第 {currentStart} 条-第 {currentEnd} 条，共 {problems.length} 条
          </Text>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            total={problems.length}
            showSizeChanger
            onChange={(page, nextPageSize) => {
              setCurrentPage(page);
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              }
            }}
          />
        </div>
      )}
    </PageContainer>
  );
}
