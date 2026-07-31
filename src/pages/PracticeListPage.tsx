/**
 * 练习列表页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Button, Tag, Typography, Banner, Table, Input, Pagination, Select } from '@douyinfe/semi-ui';
import { IconLock, IconSearch } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { fetchPractices, type Practice } from '../data/apiClient';
import { PageContainer } from '../components/common';

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
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Input
          prefix={<IconSearch />}
          placeholder="筛选题单"
          value={keyword}
          onChange={setKeyword}
          style={{ width: 220 }}
        />
        <Select
          value={scope}
          style={{ width: 160 }}
          optionList={[
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
        pagination={false}
      />

      {total > 0 && (
        <div className="front-table-pagination">
          <Typography.Text type="tertiary">
            显示第 {currentStart} 条-第 {currentEnd} 条，共 {total} 条
          </Typography.Text>
          <Pagination
            currentPage={page}
            pageSize={pageSize}
            pageSizeOpts={[10, 20, 50]}
            total={total}
            showSizeChanger
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </div>
      )}
    </PageContainer>
  );
}
