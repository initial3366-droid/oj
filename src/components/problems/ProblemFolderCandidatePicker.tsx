import { useEffect, useRef, useState } from 'react';
import { Button, Input, Message, Select, Space, Table, Tag, Typography } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';
import { adminGet } from '../../admin/api/adminClient';
import { teacherGet } from '../../teacher/teacherApi';

export interface ProblemFolderCandidate {
  id: number;
  title: string;
  difficulty: number;
  timeLimit: number;
  memoryLimit: number;
  accessScope: 'ALL' | 'MAJOR' | 'PRIVATE';
  majorName?: string | null;
  folderNames: string[];
}

interface FolderOption {
  id: number;
  name: string;
}

interface PageResult<T> {
  total: number;
  list: T[];
}

interface Props {
  variant: 'admin' | 'teacher';
  folderId: number;
  folders: FolderOption[];
  selectedProblemIds: number[];
  onAdd: (problem: ProblemFolderCandidate) => void;
}

type CandidateSource = 'ALL' | 'FOLDER' | 'MINE' | 'PUBLIC' | 'MAJOR' | 'OUTSIDE';

const difficultyMap: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

export function ProblemFolderCandidatePicker({
  variant,
  folderId,
  folders,
  selectedProblemIds,
  onAdd,
}: Props) {
  const requestSequence = useRef(0);
  const [source, setSource] = useState<CandidateSource>('ALL');
  const [sourceFolderId, setSourceFolderId] = useState<number>();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<ProblemFolderCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const selectedSet = new Set(selectedProblemIds);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    setPage(1);
  }, [source, sourceFolderId, debouncedKeyword]);

  useEffect(() => {
    if (source === 'FOLDER' && sourceFolderId == null) {
      requestSequence.current += 1;
      setProblems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    void loadCandidates();
  }, [folderId, source, sourceFolderId, debouncedKeyword, page, pageSize]);

  async function loadCandidates() {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        source,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (sourceFolderId != null) params.set('sourceFolderId', String(sourceFolderId));
      if (debouncedKeyword) params.set('keyword', debouncedKeyword);
      const url = `/api/admin/v1/problem-folders/${folderId}/candidates?${params.toString()}`;
      const result = variant === 'admin'
        ? await adminGet<PageResult<ProblemFolderCandidate>>(url)
        : await teacherGet<PageResult<ProblemFolderCandidate>>(url);
      if (sequence !== requestSequence.current) return;
      setProblems(result.list);
      setTotal(result.total);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      Message.error(error instanceof Error ? error.message : '可选题目加载失败');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Select
          style={{ width: 150 }}
          value={source}
          onChange={(value) => {
            const next = value as CandidateSource;
            setSource(next);
            if (next !== 'FOLDER') setSourceFolderId(undefined);
          }}
        >
          <Select.Option value="ALL">全部可用</Select.Option>
          <Select.Option value="FOLDER">可访问文件夹</Select.Option>
          <Select.Option value="MINE">我的题目</Select.Option>
          <Select.Option value="PUBLIC">所有人开放</Select.Option>
          <Select.Option value="MAJOR">本专业开放</Select.Option>
          <Select.Option value="OUTSIDE">文件夹外题目</Select.Option>
        </Select>
        {source === 'FOLDER' && (
          <Select
            style={{ width: 190 }}
            placeholder="选择来源文件夹"
            value={sourceFolderId}
            onChange={(value) => setSourceFolderId(value as number)}
          >
            {folders.filter((folder) => folder.id !== folderId).map((folder) => (
              <Select.Option key={folder.id} value={folder.id}>{folder.name}</Select.Option>
            ))}
          </Select>
        )}
        <Input
          style={{ width: 240 }}
          allowClear
          prefix={<IconSearch />}
          placeholder="模糊搜索题目 ID、名称或标签"
          value={keyword}
          onChange={setKeyword}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        data={problems}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: true,
          sizeCanChange: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        columns={[
          {
            title: '操作',
            width: 82,
            align: 'center',
            render: (_: unknown, problem: ProblemFolderCandidate) => {
              const selected = selectedSet.has(problem.id);
              return (
                <Button size="mini" type={selected ? 'outline' : 'primary'} disabled={selected} onClick={() => onAdd(problem)}>
                  {selected ? '已选择' : '添加'}
                </Button>
              );
            },
          },
          {
            title: '题目',
            render: (_: unknown, problem: ProblemFolderCandidate) => (
              <div>
                <Space size={6}>
                  <Typography.Text code>#{problem.id}</Typography.Text>
                  <Typography.Text>{problem.title}</Typography.Text>
                </Space>
                {problem.folderNames.length > 0 && (
                  <Space size={4} wrap style={{ display: 'flex', marginTop: 4 }}>
                    {problem.folderNames.map((name) => <Tag key={name} size="small">{name}</Tag>)}
                  </Space>
                )}
              </div>
            ),
          },
          {
            title: '开放范围',
            width: 105,
            render: (_: unknown, problem: ProblemFolderCandidate) => (
              <Tag>
                {problem.accessScope === 'ALL'
                  ? '所有人'
                  : problem.accessScope === 'MAJOR'
                    ? problem.majorName || '本专业'
                    : '私有'}
              </Tag>
            ),
          },
          {
            title: '难度',
            width: 80,
            render: (value: number) => {
              const info = difficultyMap[value] ?? { text: '未知', color: 'gray' };
              return <Tag color={info.color}>{info.text}</Tag>;
            },
          },
        ]}
      />
    </Space>
  );
}
