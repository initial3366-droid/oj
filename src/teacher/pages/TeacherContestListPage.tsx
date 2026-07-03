import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconEye, IconPlus, IconRefresh } from '@arco-design/web-react/icon';
import { teacherGet, teacherDelete } from '../teacherApi';

interface Contest {
  id: number;
  title: string;
  type: 'ACM' | 'OI';
  status: string;
  audience: string;
  audiences?: Array<{ audienceType: string; audienceId: number; name: string }>;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  registrationCount: number;
  submissionCount: number;
}

interface PageResult {
  total: number;
  list: Contest[];
}

function statusText(status: string) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

function statusColor(status: string) {
  if (status === 'RUNNING') return 'green';
  if (status === 'ENDED') return 'gray';
  return 'blue';
}

function audienceText(contest: Contest) {
  if (contest.audiences?.length) {
    const names = contest.audiences.map((a) => a.name).filter(Boolean);
    if (names.length > 0) return names.join('、');
  }
  if (contest.audience === 'CLASS') return '班级';
  return '所有人';
}

export function TeacherContestListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [contests, setContests] = useState<Contest[]>([]);

  useEffect(() => {
    loadContests();
  }, []);

  async function loadContests() {
    setLoading(true);
    try {
      const result = await teacherGet<PageResult>('/api/admin/v1/contests?page=1&pageSize=200');
      setContests(result.list);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '比赛列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await teacherDelete(`/api/admin/v1/contests/${id}`);
      Message.success('比赛已删除');
      loadContests();
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
      title: '比赛名称',
      dataIndex: 'title',
      width: 250,
    },
    {
      title: '赛制',
      dataIndex: 'type',
      width: 80,
      align: 'center' as const,
      render: (type: string) => <Tag color={type === 'ACM' ? 'blue' : 'purple'}>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => <Tag color={statusColor(status)}>{statusText(status)}</Tag>,
    },
    {
      title: '面向群体',
      dataIndex: 'audience',
      width: 150,
      render: (_: unknown, record: Contest) => <Tag>{audienceText(record)}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 180,
      render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-',
    },
    {
      title: '时长',
      dataIndex: 'durationMinutes',
      width: 80,
      align: 'center' as const,
      render: (value: number) => `${value}分钟`,
    },
    {
      title: '报名/提交',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: Contest) => `${record.registrationCount ?? 0}/${record.submissionCount ?? 0}`,
    },
    {
      title: '操作',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: Contest) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => navigate(`/teacher/contests/${record.id}`)}
          >
            比赛信息
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => navigate(`/teacher/contests/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除该比赛吗？" onOk={() => handleDelete(record.id)}>
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
      title="比赛列表"
      extra={
        <Space>
          <Button icon={<IconRefresh />} onClick={loadContests}>刷新</Button>
          <Button type="primary" icon={<IconPlus />} onClick={() => navigate('/teacher/contests/new')}>
            添加比赛
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        data={contests}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: true }}
      />
    </Card>
  );
}
