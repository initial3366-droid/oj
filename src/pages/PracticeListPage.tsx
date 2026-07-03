import { Button, Tag, Typography, Banner, Table, Input, Select, Space } from '@douyinfe/semi-ui';
import { IconLock, IconSearch } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { fetchPractices, type Practice } from '../data/apiClient';
import { PageContainer } from '../components/common';

function audienceLabel(audience: Practice['audience']) {
  if (audience === 'CLASS') return '班级';
  return '所有人';
}

export function PracticeListPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPractices(page, pageSize, 'public')
      .then((data) => {
        if (!cancelled) {
          setPractices(data.list);
          setTotal(data.total);
          setMessage('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : '题单加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const filteredPractices = keyword.trim()
    ? practices.filter((practice) => {
        const query = keyword.trim().toLowerCase();
        return practice.title.toLowerCase().includes(query) || practice.description.toLowerCase().includes(query);
      })
    : practices;

  const columns = [
    {
      title: '题单名称',
      dataIndex: 'title',
      render: (title: string, record: Practice) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ showTooltip: true }}>
            {title}
          </Typography.Text>
          <Typography.Paragraph
            type="tertiary"
            ellipsis={{ rows: 1, showTooltip: true }}
            style={{ margin: '4px 0 0', fontSize: 13 }}
          >
            {record.description || '暂无说明'}
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: '范围',
      dataIndex: 'audience',
      width: 120,
      render: (audience: Practice['audience']) => <Tag>{audienceLabel(audience)}</Tag>,
    },
    {
      title: '题目',
      dataIndex: 'problems',
      width: 100,
      render: (problems: Practice['problems']) => `${problems.length} 题`,
    },
    {
      title: '权限',
      dataIndex: 'hasPassword',
      width: 100,
      render: (hasPassword: boolean) => hasPassword ? <Tag color="orange"><IconLock /> 密码</Tag> : <Tag color="green">公开</Tag>,
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, record: Practice) => (
        <Button type="primary" onClick={() => { window.location.href = `/practice/${record.id}`; }}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <PageContainer
      title="公共题单"
      subtitle="Problem Sets"
      extra={
        <Space>
          <Input
            prefix={<IconSearch />}
            placeholder="筛选题单"
            value={keyword}
            onChange={setKeyword}
            style={{ width: 220 }}
          />
          <Select value={pageSize} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} style={{ width: 120 }}>
            <Select.Option value={10}>10 条/页</Select.Option>
            <Select.Option value={20}>20 条/页</Select.Option>
            <Select.Option value={50}>50 条/页</Select.Option>
          </Select>
        </Space>
      }
    >
      {message && (
        <Banner
          type="danger"
          description={message}
          closeIcon={null}
          style={{ marginBottom: 24 }}
        />
      )}

      <Table
        rowKey="id"
        dataSource={filteredPractices}
        columns={columns}
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total,
          showSizeChanger: false,
          onPageChange: setPage,
        }}
      />
    </PageContainer>
  );
}
