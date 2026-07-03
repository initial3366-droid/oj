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
import { IconDelete, IconEdit, IconEye, IconPlus, IconRefresh, IconSearch } from '@arco-design/web-react/icon';
import { teacherGet, teacherDelete } from '../teacherApi';

interface Practice {
  id: number;
  title: string;
  description?: string;
  audience: string;
  audienceId?: number;
  hasPassword: boolean;
  problems: Array<{ id: number; title: string }>;
  createdAt: string;
}

interface PageResult {
  total: number;
  list: Practice[];
}

function audienceText(practice: Practice) {
  if (practice.audience === 'CLASS') return '班级';
  return '所有人';
}

export function TeacherPracticeListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    loadPractices();
  }, []);

  async function loadPractices() {
    setLoading(true);
    try {
      const result = await teacherGet<PageResult>('/api/admin/v1/practices?page=1&pageSize=200');
      setPractices(result.list);
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
      loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  const filteredPractices = keyword.trim()
    ? practices.filter((p) => p.title.toLowerCase().includes(keyword.trim().toLowerCase()))
    : practices;

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '题单名称',
      dataIndex: 'title',
      width: 250,
      render: (title: string, record: Practice) => (
        <div>
          <Typography.Text bold>{title}</Typography.Text>
          {record.description && (
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
              {record.description.length > 50 ? record.description.slice(0, 50) + '...' : record.description}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: '范围',
      dataIndex: 'audience',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: Practice) => <Tag>{audienceText(record)}</Tag>,
    },
    {
      title: '题目数',
      dataIndex: 'problems',
      width: 80,
      align: 'center' as const,
      render: (problems: Practice['problems']) => problems?.length ?? 0,
    },
    {
      title: '密码',
      dataIndex: 'hasPassword',
      width: 80,
      align: 'center' as const,
      render: (hasPassword: boolean) => (
        <Tag color={hasPassword ? 'orange' : 'gray'}>{hasPassword ? '已设置' : '无'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      width: 250,
      align: 'center' as const,
      render: (_: unknown, record: Practice) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => navigate(`/teacher/practices/${record.id}/report`)}
          >
            做题信息
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => navigate(`/teacher/practices/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除该题单吗？" onOk={() => handleDelete(record.id)}>
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
      title="题单列表"
      extra={
        <Space>
          <Input
            style={{ width: 240 }}
            placeholder="搜索题单"
            prefix={<IconSearch />}
            value={keyword}
            onChange={setKeyword}
          />
          <Button icon={<IconRefresh />} onClick={loadPractices}>刷新</Button>
          <Button type="primary" icon={<IconPlus />} onClick={() => navigate('/teacher/practices/new')}>
            添加题单
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        data={filteredPractices}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: true }}
      />
    </Card>
  );
}
