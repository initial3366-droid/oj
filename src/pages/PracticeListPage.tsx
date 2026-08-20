/**
 * 练习列表页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Alert, Button, Input, Pagination, Select, Table, Tag, Typography } from 'antd';
import { LockOutlined, SearchOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useEffect, useState } from 'react';
import { fetchPractices, type Practice } from '../data/apiClient';
import { PageContainer } from '../components/common';

const { Paragraph, Text } = Typography;

/**
 * 封装audienceLabel相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function audienceLabel(audience: Practice['audience']) {
  if (audience === 'CLASS') return '班级';
  return '所有人';
}

/**
 * 渲染练习列表页面，并协调其数据加载、状态和交互。
 */
export function PracticeListPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<'all' | 'public' | 'class'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPractices(page, pageSize, scope)
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
  }, [page, pageSize, scope]);

  const filteredPractices = keyword.trim()
    ? practices.filter((practice) => {
        const query = keyword.trim().toLowerCase();
        return practice.title.toLowerCase().includes(query) || practice.description.toLowerCase().includes(query);
      })
    : practices;

  const currentStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const currentEnd = Math.min(page * pageSize, total);

  const columns: TableColumnsType<Practice> = [
    {
      title: '题单名称',
      dataIndex: 'title',
      render: (title: string, record) => (
        <div style={{ minWidth: 0 }}>
          <Text strong ellipsis={{ tooltip: title }}>
            {title}
          </Text>
          <Paragraph
            type="secondary"
            ellipsis={{ rows: 1, tooltip: record.description || '暂无说明' }}
            style={{ margin: '4px 0 0', fontSize: 13 }}
          >
            {record.description || '暂无说明'}
          </Paragraph>
        </div>
      ),
    },
    {
      title: '范围',
      dataIndex: 'audience',
      width: 120,
      render: (audience: Practice['audience']) => <Tag style={{ marginInlineEnd: 0 }}>{audienceLabel(audience)}</Tag>,
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
      render: (hasPassword: boolean) => hasPassword ? (
        <Tag color="warning" icon={<LockOutlined />} style={{ marginInlineEnd: 0 }}>密码</Tag>
      ) : (
        <Tag color="success" style={{ marginInlineEnd: 0 }}>公开</Tag>
      ),
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
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="筛选题单"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 220 }}
        />
        <Select
          value={scope}
          style={{ width: 160 }}
          options={[
            { label: '全部范围', value: 'all' },
            { label: '所有人', value: 'public' },
            { label: '班级', value: 'class' },
          ]}
          onChange={(value) => {
            setScope(value as 'all' | 'public' | 'class');
            setPage(1);
          }}
        />
      </div>

      {message && (
        <Alert
          type="error"
          message={message}
          showIcon={false}
          banner
          style={{ marginBottom: 24 }}
        />
      )}

      <Table
        rowKey="id"
        dataSource={filteredPractices}
        columns={columns}
        loading={loading}
        pagination={false}
      />

      {total > 0 && (
        <div className="front-table-pagination">
          <Text type="secondary">
            显示第 {currentStart} 条-第 {currentEnd} 条，共 {total} 条
          </Text>
          <Pagination
            current={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50]}
            total={total}
            showSizeChanger
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
                setPage(1);
              }
            }}
          />
        </div>
      )}
    </PageContainer>
  );
}
