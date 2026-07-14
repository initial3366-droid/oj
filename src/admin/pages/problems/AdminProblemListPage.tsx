/**
 * 管理员题目列表页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { adminPath } from '../../../utils/adminPath';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Message,
  Popconfirm,
  Tag,
} from '@arco-design/web-react';
import { IconPlus, IconSearch, IconEdit, IconDelete, IconFile } from '@arco-design/web-react/icon';
import { adminGet, adminDelete } from '../../api/adminClient';
import { encryptId } from '../../../utils/cipher';

/**
 * 题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
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

/**
 * 文件夹Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FolderOption {
  id: number;
  name: string;
}

/**
 * 页面结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
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

const difficultyMap: Record<number, { text: string; color: string }> = Object.fromEntries(
  difficultyOptions.map((d) => [d.value, { text: d.label, color: d.color }])
);

/**
 * 渲染管理员题目列表页面，并协调其数据加载、状态和交互。
 */
export function AdminProblemListPage() {
  const requestSequence = useRef(0);
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

  /**
   * 读取Folders并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const loadFolders = useCallback(async () => {
    try {
      const result = await adminGet<FolderOption[]>('/api/admin/v1/problem-folders');
      setFolders(result);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    loadProblems();
  }, [page, keyword, filterDifficulty, filterTag, filterFolderId, filterOwnerName]);

  /**
   * 读取Problems并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function loadProblems() {
    const sequence = ++requestSequence.current;
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

      const result = await adminGet<PageResult>(`/api/admin/v1/problems?${params.toString()}`);
      if (sequence !== requestSequence.current) return;
      setProblems(result.list);
      setTotal(result.total);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      Message.error('加载题目列表失败');
      console.error(error);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  /**
   * 处理Search。会更新 React 状态并触发重新渲染。
   */
  function handleSearch(value: string) {
    setKeyword(value);
    setPage(1);
  }

  /**
   * 处理Create。可能改变当前路由或查询参数。
   */
  function handleCreate() {
    navigate(adminPath('/problems/new'));
  }

  /**
   * 处理Edit。可能改变当前路由或查询参数。
   */
  function handleEdit(id: number) {
    navigate(`/admin/problems/${encryptId(id)}/edit`);
  }

  /**
   * 处理TestCases。可能改变当前路由或查询参数。
   */
  function handleTestCases(id: number) {
    navigate(`/admin/problems/${encryptId(id)}/test-cases`);
  }

  /**
   * 处理Delete。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
   */
  async function handleDelete(id: number) {
    try {
      await adminDelete(`/api/admin/v1/problems/${id}`);
      Message.success('删除成功');
      loadProblems();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '题目名称',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '创建者',
      dataIndex: 'ownerName',
      width: 100,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      align: 'center' as const,
      render: (value: number) => {
        const info = difficultyMap[value] || { text: '未知', color: 'gray' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '所属文件夹',
      dataIndex: 'folderName',
      width: 120,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '通过率',
      dataIndex: 'acRate',
      width: 80,
      align: 'center' as const,
      render: (value: number) => `${value}%`,
    },
    {
      title: '测试点',
      dataIndex: 'testCaseCount',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '状态',
      dataIndex: 'isPublic',
      width: 70,
      align: 'center' as const,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'gray'}>{value ? '公开' : '私有'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: Problem) => (
        <Space>
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
          <Popconfirm
            title="确定要删除该题目吗？"
            onOk={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={8} wrap>
            <Input.Search
              style={{ width: 240 }}
              placeholder="搜索题目名称"
              onSearch={handleSearch}
              prefix={<IconSearch />}
            />
            <Select
              style={{ width: 120 }}
              placeholder="难度"
              allowClear
              value={filterDifficulty}
              onChange={(v) => { setFilterDifficulty(v); setPage(1); }}
              options={difficultyOptions.map((d) => ({ value: d.value, label: d.label }))}
            />
            <Input
              style={{ width: 140 }}
              placeholder="知识点"
              allowClear
              value={filterTag}
              onChange={(v) => { setFilterTag(v); setPage(1); }}
            />
            <Select
              style={{ width: 160 }}
              placeholder="文件夹"
              allowClear
              value={filterFolderId}
              onChange={(v) => { setFilterFolderId(v); setPage(1); }}
              options={folders.map((f) => ({ value: f.id, label: f.name }))}
            />
            <Input
              style={{ width: 140 }}
              placeholder="创建者"
              allowClear
              value={filterOwnerName}
              onChange={(v) => { setFilterOwnerName(v); setPage(1); }}
            />
          </Space>
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            添加题目
          </Button>
        </div>
      </Space>

      <Table
        loading={loading}
        columns={columns}
        data={problems}
        scroll={{ x: '100%' }}
        pagination={{
          total,
          current: page,
          pageSize,
          onChange: setPage,
          showTotal: true,
        }}
      />
    </Card>
  );
}
