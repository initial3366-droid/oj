import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconFile, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { teacherGet, teacherDelete } from '../teacherApi';
import { encryptId } from '../../utils/cipher';

interface Problem {
  id: number;
  title: string;
  difficulty: number;
  tags: string[];
  folderId?: number;
  folderName?: string;
  ownerName?: string;
  acRate: number;
  isPublic: boolean;
  createdAt: string;
  testCaseCount: number;
}

interface FolderOption {
  id: number;
  name: string;
}

interface PageResult {
  list: Problem[];
  total: number;
}

const difficultyOptions = [
  { value: 1, label: '入门', color: 'arcoblue' },
  { value: 2, label: '简单', color: 'green' },
  { value: 3, label: '中等', color: 'orange' },
  { value: 4, label: '困难', color: 'red' },
  { value: 5, label: '地狱', color: 'purple' },
];

const difficultyMap: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

export function TeacherProblemListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<number | undefined>();
  const [filterTag, setFilterTag] = useState('');
  const [filterFolderId, setFilterFolderId] = useState<number | undefined>();
  const [filterOwnerName, setFilterOwnerName] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);

  const loadFolders = useCallback(async () => {
    try {
      const result = await teacherGet<FolderOption[]>('/api/admin/v1/problem-folders');
      setFolders(result);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    loadProblems();
  }, [page, keyword, filterDifficulty, filterTag, filterFolderId, filterOwnerName]);

  async function loadProblems() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (keyword) params.append('keyword', keyword);
      if (filterDifficulty != null) params.append('difficulty', String(filterDifficulty));
      if (filterTag) params.append('tag', filterTag);
      if (filterFolderId != null) params.append('folderId', String(filterFolderId));
      if (filterOwnerName) params.append('ownerName', filterOwnerName);
      const result = await teacherGet<PageResult>(`/api/admin/v1/problems?${params.toString()}`);
      setProblems(result.list);
      setTotal(result.total);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题目列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(value: string) {
    setKeyword(value);
    setPage(1);
  }

  function handleEdit(id: number) {
    navigate(`/teacher/problems/${encryptId(id)}/edit`);
  }

  function handleTestCases(id: number) {
    navigate(`/teacher/problems/${encryptId(id)}/test-cases`);
  }

  async function handleDelete(id: number) {
    try {
      await teacherDelete(`/api/admin/v1/problems/${id}`);
      Message.success('题目已删除');
      loadProblems();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 64,
      align: 'center' as const,
    },
    {
      title: '题目名称',
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '创建者',
      dataIndex: 'ownerName',
      width: 90,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 72,
      align: 'center' as const,
      render: (value: number) => {
        const info = difficultyMap[value] || { text: '未知', color: 'gray' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '所属文件夹',
      dataIndex: 'folderName',
      width: 110,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '通过率',
      dataIndex: 'acRate',
      width: 72,
      align: 'center' as const,
      render: (value: number) => `${value}%`,
    },
    {
      title: '测试点',
      dataIndex: 'testCaseCount',
      width: 70,
      align: 'center' as const,
      render: (value: number) => value ?? 0,
    },
    {
      title: '状态',
      dataIndex: 'isPublic',
      width: 72,
      align: 'center' as const,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'green' : 'red'}>
          {isPublic ? '公开' : '隐藏'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: Problem) => (
        <Space size={2} wrap={false}>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record.id)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconFile />}
            onClick={() => handleTestCases(record.id)}
          >
            测试点
          </Button>
          <Popconfirm title="确定删除该题目吗？" onOk={() => handleDelete(record.id)}>
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      bordered={false}
      title="题目列表"
      extra={
        <Button type="primary" icon={<IconPlus />} onClick={() => navigate('/teacher/problems/new')}>
          添加题目
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          style={{ width: 220 }}
          placeholder="搜索题目"
          prefix={<IconSearch />}
          value={keyword}
          onChange={setKeyword}
          onSearch={handleSearch}
        />
        <Select
          style={{ width: 130 }}
          placeholder="难度筛选"
          allowClear
          value={filterDifficulty}
          onChange={(v) => { setFilterDifficulty(v); setPage(1); }}
        >
          {difficultyOptions.map((d) => (
            <Select.Option key={d.value} value={d.value}>{d.label}</Select.Option>
          ))}
        </Select>
        <Input
          style={{ width: 140 }}
          placeholder="知识点"
          prefix={<IconSearch />}
          value={filterTag}
          onChange={setFilterTag}
          onPressEnter={() => setPage(1)}
        />
        <Select
          style={{ width: 160 }}
          placeholder="文件夹筛选"
          allowClear
          value={filterFolderId}
          onChange={(v) => { setFilterFolderId(v); setPage(1); }}
        >
          {folders.map((f) => (
            <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
          ))}
        </Select>
        <Input
          style={{ width: 140 }}
          placeholder="创建者"
          prefix={<IconSearch />}
          value={filterOwnerName}
          onChange={setFilterOwnerName}
          onPressEnter={() => setPage(1)}
        />
      </Space>

      <Table
        className="teacher-problem-list-table"
        tableLayoutFixed
        rowKey="id"
        columns={columns}
        data={problems}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: true,
          onChange: setPage,
        }}
      />
    </Card>
  );
}
