import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import {
  IconCopy,
  IconDelete,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
} from '@arco-design/web-react/icon';
import { teacherDelete, teacherGet, teacherPost } from '../teacherApi';

type AccessScope = 'ALL' | 'MAJOR' | 'PRIVATE';

interface Practice {
  id: number;
  title: string;
  description?: string;
  accessScope: AccessScope;
  majorName?: string;
  ownerAccountType: string;
  owner: boolean;
  canEdit: boolean;
  canCopy: boolean;
  canPublish: boolean;
  problems: Array<{ id: number; title: string }>;
  createdAt: string;
}

interface PageResult {
  total: number;
  list: Practice[];
}

interface PracticePublication {
  id: number;
  sourcePracticeId: number;
  title: string;
  status: string;
  studentAccessMode: 'ALL' | 'SELECTED_CLASSES';
  classIds: number[];
  problems: Array<{ id: number; title: string }>;
  createdAt: string;
}

function scopeTag(practice: Practice) {
  if (practice.accessScope === 'ALL') return <Tag color="green">所有人</Tag>;
  if (practice.accessScope === 'MAJOR') return <Tag color="arcoblue">本专业{practice.majorName ? `：${practice.majorName}` : ''}</Tag>;
  return <Tag color="gray">私有</Tag>;
}

export function TeacherPracticeListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [publications, setPublications] = useState<PracticePublication[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => { void loadPractices(); }, []);

  async function loadPractices() {
    setLoading(true);
    try {
      const [result, publicationResult] = await Promise.all([
        teacherGet<PageResult>('/api/admin/v1/practices?page=1&pageSize=200'),
        teacherGet<PracticePublication[]>('/api/admin/v1/practices/publications/mine'),
      ]);
      setPractices(result.list);
      setPublications(publicationResult);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题单列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await teacherDelete(`/api/admin/v1/practices/${id}`);
      Message.success('题单已删除');
      void loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function handleCopy(id: number) {
    try {
      await teacherPost(`/api/admin/v1/practices/${id}/copy`);
      Message.success('题单已复制到我的题单');
      void loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '复制失败');
    }
  }

  async function handleDeletePublication(id: number) {
    try {
      await teacherDelete(`/api/admin/v1/practices/publications/${id}`);
      Message.success('发布实例已删除');
      void loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  const filteredPractices = keyword.trim()
    ? practices.filter((item) => item.title.toLowerCase().includes(keyword.trim().toLowerCase()))
    : practices;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title="题单列表"
        extra={(
          <Space>
            <Input
              style={{ width: 240 }}
              placeholder="搜索题单"
              prefix={<IconSearch />}
              value={keyword}
              onChange={setKeyword}
            />
            <Button icon={<IconRefresh />} onClick={loadPractices}>刷新</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => navigate('/teacher/practices/new')}>添加题单</Button>
          </Space>
        )}
      >
        <Table
          rowKey="id"
          data={filteredPractices}
          loading={loading}
          pagination={{ pageSize: 20, showTotal: true }}
          expandedRowRender={(record: Practice) => (
            <Space wrap>
              {(record.problems ?? []).map((problem, index) => (
                <Tag key={problem.id}>{index + 1}. {problem.title}</Tag>
              ))}
            </Space>
          )}
          columns={[
          { title: 'ID', dataIndex: 'id', width: 70, align: 'center' as const },
          {
            title: '题单名称',
            dataIndex: 'title',
            width: 260,
            render: (title: string, record: Practice) => (
              <div>
                <Space><Typography.Text bold>{title}</Typography.Text>{!record.owner && <Tag color="orange">共享</Tag>}</Space>
                {record.description && <Typography.Text type="secondary" ellipsis style={{ display: 'block', maxWidth: 320 }}>{record.description}</Typography.Text>}
              </div>
            ),
          },
          { title: '教师开放范围', width: 180, render: (_: unknown, record: Practice) => scopeTag(record) },
          { title: '题目数', width: 90, align: 'center' as const, render: (_: unknown, record: Practice) => record.problems?.length ?? 0 },
          { title: '创建者类型', dataIndex: 'ownerAccountType', width: 110, render: (value: string) => value === 'ADMIN' ? '管理员' : '教师' },
          { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
          {
            title: '操作',
            width: 360,
            align: 'center' as const,
            render: (_: unknown, record: Practice) => (
              <Space wrap>
                {record.owner && (
                  <Button type="text" size="small" icon={<IconEye />} onClick={() => navigate(`/teacher/practices/${record.id}/report`)}>做题信息</Button>
                )}
                {record.canEdit && (
                  <Button type="text" size="small" icon={<IconEdit />} onClick={() => navigate(`/teacher/practices/${record.id}/edit`)}>编辑</Button>
                )}
                {record.canCopy && (
                  <Button type="text" size="small" icon={<IconCopy />} onClick={() => handleCopy(record.id)}>复制</Button>
                )}
                {record.canPublish && (
                  <Button type="text" size="small" icon={<IconSend />} onClick={() => navigate(`/teacher/practices/${record.id}/publish`)}>发布</Button>
                )}
                {record.owner && (
                  <Popconfirm title="确定删除该题单吗？" onOk={() => handleDelete(record.id)}>
                    <Button type="text" size="small" status="danger" icon={<IconDelete />}>删除</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
          ]}
        />
      </Card>

      <Card bordered={false} title={`我的发布（${publications.length}）`}>
        <Table
          rowKey="id"
          data={publications}
          loading={loading}
          pagination={{ pageSize: 20, showTotal: true }}
          columns={[
            { title: '发布ID', dataIndex: 'id', width: 80 },
            { title: '发布标题', dataIndex: 'title', width: 200, ellipsis: true, render: (value: string) => <Typography.Text bold ellipsis={{ showTooltip: true }} style={{ maxWidth: 180 }}>{value}</Typography.Text> },
            { title: '来源题单', dataIndex: 'sourcePracticeId', width: 90, render: (value: number) => `#${value}` },
            { title: '题目数', width: 80, align: 'center' as const, render: (_: unknown, item: PracticePublication) => item.problems.length },
            {
              title: '学生范围',
              width: 150,
              render: (_: unknown, item: PracticePublication) => item.studentAccessMode === 'ALL'
                ? <Tag color="green">所有学生</Tag>
                : <Tag color="arcoblue">指定班级（{item.classIds.length}）</Tag>,
            },
            { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <Tag color="green">{value === 'PUBLISHED' ? '已发布' : value}</Tag> },
            { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
            {
              title: '操作',
              width: 150,
              render: (_: unknown, item: PracticePublication) => (
                <Space>
                  <Button type="text" size="small" icon={<IconEdit />} onClick={() => navigate(`/teacher/practices/publications/${item.id}/edit`)}>编辑</Button>
                  <Popconfirm title="确定删除该发布实例吗？删除后学生将无法访问。" onOk={() => handleDeletePublication(item.id)}>
                    <Button type="text" size="small" status="danger" icon={<IconDelete />}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
