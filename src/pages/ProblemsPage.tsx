import { Button, Card, Input, Select, Table, Tag, Typography, Banner } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchProblems } from '../data/apiClient';
import type { Difficulty, Problem } from '../data/types';
import { PageContainer } from '../components/common';

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: Difficulty }> = [
  { value: '入门', label: '入门' },
  { value: '简单', label: '简单' },
  { value: '中等', label: '中等' },
  { value: '困难', label: '困难' },
  { value: '地狱', label: '地狱' },
];

function attemptBadge(problem: Problem) {
  if (problem.attemptStatus === 'AC') {
    return (
      <Tag color="green" size="small">
        已通过
      </Tag>
    );
  }
  if (problem.attemptStatus) {
    return (
      <Tag color="red" size="small">
        未通过
      </Tag>
    );
  }
  return (
    <Tag color="grey" size="small" type="ghost">
      未尝试
    </Tag>
  );
}

export function ProblemsPage() {
  const [sourceProblems, setSourceProblems] = useState<Problem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [message, setMessage] = useState('');

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
      return true;
    });
  }, [keyword, sourceProblems, selectedDifficulties, selectedTags]);

  const getDifficultyColor = (
    difficulty: string,
  ): 'green' | 'orange' | 'red' | 'grey' => {
    const normalized = difficulty.toLowerCase();
    if (normalized.includes('简单') || normalized === 'easy' || normalized === '入门')
      return 'green';
    if (normalized.includes('中等') || normalized === 'medium') return 'orange';
    if (normalized.includes('困难') || normalized === 'hard' || normalized === '地狱')
      return 'red';
    return 'grey';
  };

  const columns: ColumnProps<Problem>[] = [
    {
      title: '题目',
      dataIndex: 'title',
      width: 300,
      render: (title: string) => (
        <Typography.Text strong style={{ fontSize: 14 }}>
          {title}
        </Typography.Text>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 250,
      render: (tags: string[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((tag) => (
            <Tag key={tag} size="small" type="ghost">
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
        <Tag color={getDifficultyColor(difficulty)} size="small">
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
        <Typography.Text style={{ fontSize: 14 }}>{acRate}%</Typography.Text>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (_text, record) => (
        <Button
          size="small"
          theme="borderless"
          type="primary"
          onClick={() => {
            window.location.href = `/practice/problem/${record.id}`;
          }}
        >
          做题
        </Button>
      ),
    },
  ];

  return (
    <PageContainer
      title="题库"
      subtitle="Problem Bank"
      description="Markdown + LaTeX 题面、标签、难度和通过率集中管理。"
    >
      {message && (
        <Banner
          type="danger"
          description={message}
          closeIcon={null}
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
          prefix={<IconSearch />}
          placeholder="搜索题目或标签"
          value={keyword}
          onChange={setKeyword}
          style={{ width: 280 }}
          showClear
          onClear={() => setKeyword('')}
        />
        <Select
          multiple
          filter
          placeholder="难度"
          value={selectedDifficulties}
          onChange={(value) => setSelectedDifficulties((value ?? []) as Difficulty[])}
          style={{ minWidth: 160 }}
          optionList={DIFFICULTY_OPTIONS}
          emptyContent="无匹配难度"
        />
        <Select
          multiple
          filter
          placeholder="标签"
          value={selectedTags}
          onChange={(value) => setSelectedTags((value ?? []) as string[])}
          style={{ minWidth: 200, maxWidth: 360 }}
          optionList={allTags.map((tag) => ({ value: tag, label: tag }))}
          emptyContent="无匹配标签"
        />
        {(selectedDifficulties.length > 0 || selectedTags.length > 0 || keyword) && (
          <Button
            theme="borderless"
            type="tertiary"
            onClick={() => {
              setKeyword('');
              setSelectedDifficulties([]);
              setSelectedTags([]);
            }}
          >
            清除筛选
          </Button>
        )}
        <Typography.Text type="tertiary" style={{ marginLeft: 'auto', fontSize: 13 }}>
          共 {problems.length} 题
        </Typography.Text>
      </div>

      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={problems}
          rowKey="id"
          pagination={false}
          empty={
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Typography.Text type="tertiary">
                {(keyword || selectedDifficulties.length > 0 || selectedTags.length > 0)
                  ? '未找到匹配的题目，试试调整筛选条件'
                  : '暂无题目'}
              </Typography.Text>
            </div>
          }
        />
      </Card>
    </PageContainer>
  );
}
