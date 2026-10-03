/**
 * Problems页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchProblems } from '../data/apiClient';
import type { Difficulty, Problem } from '../data/types';
import { PageContainer } from '../components/common';
import { Button } from '../components/motion/button/base';
import { Input } from '../components/motion/input';
import { AnimatedBadge } from '../components/motion/animated-badge';
import {
  MultiSelect, MultiSelectContent, MultiSelectEmpty, MultiSelectInput,
  MultiSelectItem, MultiSelectList, MultiSelectTrigger, MultiSelectValue,
} from '../components/motion/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/motion/select';
import './ProblemsPage.css';

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
      <AnimatedBadge status="success" showIcon={false} size="sm">已通过</AnimatedBadge>
    );
  }
  if (state === 'failed') {
    return (
      <AnimatedBadge status="danger" showIcon={false} size="sm">未通过</AnimatedBadge>
    );
  }
  return (
    <AnimatedBadge status="neutral" showIcon={false} size="sm">未尝试</AnimatedBadge>
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


  const pageCount = Math.max(1, Math.ceil(problems.length / pageSize));

  return (
    <PageContainer title="题库">
      {message && <div className="problems-notice" role="alert">{message}</div>}

      <div className="problems-toolbar">
        <Input
          aria-label="搜索题目或标签"
          leftIcon={<Search size={17} />}
          placeholder="搜索题目或标签"
          value={keyword}
          onChange={setKeyword}
          className="problems-search"
        />
        <div className="problems-filter">
          <MultiSelect value={selectedDifficulties} onValueChange={(values) => setSelectedDifficulties(values as Difficulty[])}>
            <MultiSelectTrigger><MultiSelectValue placeholder="难度" /><MultiSelectInput aria-label="搜索难度" placeholder="" /></MultiSelectTrigger>
            <MultiSelectContent><MultiSelectList ariaLabel="难度">
              {DIFFICULTY_OPTIONS.map(({ value, label }) => <MultiSelectItem key={value} value={value} textValue={label}>{label}</MultiSelectItem>)}
              <MultiSelectEmpty>无匹配难度</MultiSelectEmpty>
            </MultiSelectList></MultiSelectContent>
          </MultiSelect>
        </div>
        <div className="problems-filter problems-tags-filter">
          <MultiSelect value={selectedTags} onValueChange={setSelectedTags}>
            <MultiSelectTrigger><MultiSelectValue placeholder="标签" /><MultiSelectInput aria-label="搜索标签" placeholder="" /></MultiSelectTrigger>
            <MultiSelectContent><MultiSelectList ariaLabel="标签">
              {allTags.map((tag) => <MultiSelectItem key={tag} value={tag} textValue={tag}>{tag}</MultiSelectItem>)}
              <MultiSelectEmpty>无匹配标签</MultiSelectEmpty>
            </MultiSelectList></MultiSelectContent>
          </MultiSelect>
        </div>
        <div className="problems-filter problems-status-filter">
          <Select value={selectedAttemptState ?? ''} onValueChange={(value) => setSelectedAttemptState((value || null) as AttemptState | null)}>
            <SelectTrigger><SelectValue placeholder="是否通过" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              {ATTEMPT_STATE_OPTIONS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(selectedDifficulties.length > 0 || selectedTags.length > 0 || selectedAttemptState || keyword) && (
          <Button variant="ghost" onClick={() => {
            setKeyword('');
            setSelectedDifficulties([]);
            setSelectedTags([]);
            setSelectedAttemptState(null);
          }}>清除筛选</Button>
        )}
        <span className="problems-count">共 {problems.length} 题</span>
      </div>

      <div className="problems-table-wrap">
        <table className="problems-table">
          <thead><tr><th>题目</th><th>标签</th><th>难度</th><th>是否通过</th><th>AC 率</th><th>操作</th></tr></thead>
          <tbody>
            {pagedProblems.map((problem) => (
              <tr key={problem.id}>
                <td><NavLink className="problems-title-link" to={`/practice/problem/${problem.id}`} target="_blank" rel="noopener noreferrer">{problem.title}</NavLink></td>
                <td><div className="problems-tags">{problem.tags.map((tag) => <span key={tag} className="problems-tag">{tag}</span>)}</div></td>
                <td><AnimatedBadge status={getDifficultyColor(problem.difficulty) === 'success' ? 'success' : getDifficultyColor(problem.difficulty) === 'warning' ? 'warning' : getDifficultyColor(problem.difficulty) === 'error' ? 'danger' : 'neutral'} showIcon={false} size="sm">{problem.difficulty}</AnimatedBadge></td>
                <td>{attemptBadge(problem)}</td>
                <td>{problem.acRate}%</td>
                <td><NavLink className="problems-action-link" to={`/practice/problem/${problem.id}`} target="_blank" rel="noopener noreferrer">答题</NavLink></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagedProblems.length === 0 && <div className="problems-empty">
          {(keyword || selectedDifficulties.length > 0 || selectedTags.length > 0 || selectedAttemptState)
            ? '未找到匹配的题目，试试调整筛选条件'
            : '暂无题目'}
        </div>}
      </div>

      {problems.length > 0 && (
        <div className="problems-pagination">
          <span>显示第 {currentStart} 条-第 {currentEnd} 条，共 {problems.length} 条</span>
          <div className="problems-pagination-controls">
            <label>每页 <select aria-label="每页题数" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select> 条</label>
            <Button variant="secondary" size="icon" aria-label="上一页" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}><ChevronLeft size={16} /></Button>
            <span>{currentPage} / {pageCount}</span>
            <Button variant="secondary" size="icon" aria-label="下一页" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => page + 1)}><ChevronRight size={16} /></Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
