/**
 * 排行榜页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Avatar, Banner, Button, Card, Spin, Table, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/common';
import { fetchGlobalLeaderboard, fetchClassLeaderboard, type RatingUser, type ClassRank } from '../api/rank';

/**
 * RatingRow接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface RatingRow extends RatingUser {
  rank: number;
}

/**
 * 封装排名Tone相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function rankTone(rank: number) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'normal';
}

/**
 * 封装initials相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function initials(name?: string | null, fallback?: number) {
  const value = name?.trim() || String(fallback ?? '');
  return value.charAt(0).toUpperCase();
}

/**
 * 渲染排行榜页面，并协调其数据加载、状态和交互。
 */
export function LeaderboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [classRows, setClassRows] = useState<ClassRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [globalRank, classRank] = await Promise.all([
        fetchGlobalLeaderboard(1000),
        fetchClassLeaderboard(3).catch(() => []),
      ]);
      setRows(globalRank.map((item, index) => ({ ...item, rank: index + 1 })));
      setClassRows(classRank);
      setMessage('');
    } catch (error) {
      setRows([]);
      setClassRows([]);
      setMessage(error instanceof Error ? error.message : '排行榜加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 封装columns相关逻辑。可能改变当前路由或查询参数；对原始数据进行派生或聚合。
   */
  const columns = useMemo<ColumnProps<RatingRow>[]>(() => [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 96,
      render: (rank: number) => (
        <span className={`leaderboard-rank-badge leaderboard-rank-${rankTone(rank)}`}>
          {rank}
        </span>
      ),
    },
    {
      title: '用户',
      dataIndex: 'name',
      width: '28%',
      render: (name: string, record) => (
        <button
          type="button"
          onClick={() => navigate(`/users/${record.userId}`)}
          className="leaderboard-table-user"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            border: 0,
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <Avatar size="small" color="blue" src={record.avatarUrl || undefined}>
            {!record.avatarUrl ? initials(name, record.userId) : null}
          </Avatar>
          <Typography.Text strong ellipsis={{ showTooltip: true }}>
            {name || `#${record.userId}`}
          </Typography.Text>
        </button>
      ),
    },
    {
      title: '班级',
      dataIndex: 'className',
      width: '18%',
      render: (className?: string) => (
        <Typography.Text type={className ? 'primary' : 'tertiary'} ellipsis={{ showTooltip: true }}>
          {className || '-'}
        </Typography.Text>
      ),
    },
    {
      title: '非比赛 AC',
      dataIndex: 'acCount',
      width: '18%',
      render: (acCount: number) => (
        <Typography.Text strong style={{ color: 'var(--semi-color-primary)' }}>
          {acCount}
        </Typography.Text>
      ),
    },
    {
      title: '连续训练',
      dataIndex: 'streak',
      width: '16%',
      render: (streak: number) => <Typography.Text>{streak ?? 0} 天</Typography.Text>,
    },
  ], [navigate]);

  /**
   * 封装班级Columns相关逻辑。对原始数据进行派生或聚合。
   */
  const classColumns = useMemo<ColumnProps<ClassRank>[]>(() => [
    {
      title: '排名',
      width: 96,
      render: (_: unknown, __: ClassRank, index: number) => (
        <span className={`leaderboard-rank-badge leaderboard-rank-${rankTone(index + 1)}`}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '班级',
      dataIndex: 'className',
      render: (className: string) => <Typography.Text strong>{className || '-'}</Typography.Text>,
    },
    {
      title: '教师',
      dataIndex: 'teacherName',
      render: (teacherName: string) => <Typography.Text>{teacherName || '-'}</Typography.Text>,
    },
    {
      title: 'AC 数量',
      dataIndex: 'acCount',
      width: 160,
      render: (acCount: number) => (
        <Typography.Text strong style={{ color: 'var(--semi-color-primary)' }}>
          {acCount}
        </Typography.Text>
      ),
    },
  ], []);

  return (
    <PageContainer
      title="排行榜"
      subtitle="Leaderboard"
      description="只统计学生的非比赛 AC，班级榜每日 00:00 更新。"
      extra={(
        <Button icon={<IconRefresh />} onClick={load} loading={loading}>
          刷新
        </Button>
      )}
    >
      <style>{`
        .leaderboard-shell {
          display: grid;
          gap: 16px;
        }

        .leaderboard-table-card {
          border: 1px solid var(--semi-color-border);
        }

        .leaderboard-user-button {
          display: inline-flex;
          min-width: 0;
          align-items: center;
          gap: 12px;
          border: 0;
          background: transparent;
          padding: 0;
          color: inherit;
          cursor: pointer;
          text-align: left;
        }

        .leaderboard-user-name {
          display: block;
          max-width: 160px;
        }

        .leaderboard-rank-badge {
          display: inline-grid;
          min-width: 36px;
          height: 28px;
          place-items: center;
          border-radius: 8px;
          background: var(--semi-color-fill-0);
          color: var(--semi-color-text-1);
          font-weight: 700;
          line-height: 1;
        }

        .leaderboard-rank-gold {
          background: rgba(255, 197, 61, 0.22);
          color: #9a6400;
        }

        .leaderboard-rank-silver {
          background: rgba(148, 163, 184, 0.24);
          color: #475569;
        }

        .leaderboard-rank-bronze {
          background: rgba(217, 119, 6, 0.18);
          color: #92400e;
        }

        .leaderboard-table-card .semi-card-body {
          padding: 0;
        }

        .leaderboard-table-card,
        .leaderboard-table-card .semi-card-body,
        .leaderboard-table-wrap,
        .leaderboard-table {
          width: 100%;
          min-width: 0;
        }

        .leaderboard-table-card {
          overflow: hidden;
        }

        .leaderboard-table-wrap {
          overflow-x: auto;
        }

        .leaderboard-table .semi-table-wrapper,
        .leaderboard-table .semi-table-container,
        .leaderboard-table .semi-table {
          width: 100%;
        }

        .leaderboard-table .semi-table {
          min-width: 720px;
          table-layout: fixed;
        }

        .leaderboard-table .semi-table-thead > .semi-table-row > .semi-table-row-head,
        .leaderboard-table .semi-table-tbody > .semi-table-row > .semi-table-row-cell {
          padding: 18px 20px;
        }

        .leaderboard-table .semi-table-pagination-outer {
          margin: 0;
          padding: 16px 20px;
          border-top: 1px solid var(--semi-color-border);
        }

        .leaderboard-table-user {
          width: 100%;
          min-width: 0;
        }

        .leaderboard-table-user .semi-typography {
          min-width: 0;
        }

      `}</style>

      {message && <Banner type="danger" description={message} closeIcon={null} style={{ marginBottom: 16 }} />}

      <div className="leaderboard-shell">
        <Card className="leaderboard-table-card" title="班级最多 AC">
          {loading && classRows.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Spin tip="排行榜加载中" />
            </div>
          ) : (
            <div className="leaderboard-table-wrap">
              <Table
                className="leaderboard-table"
                dataSource={classRows}
                rowKey="classId"
                pagination={false}
                columns={classColumns}
                empty={
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <Typography.Text type="tertiary">暂无班级排行榜数据</Typography.Text>
                  </div>
                }
              />
            </div>
          )}
        </Card>

        <Card className="leaderboard-table-card" title="所有人排行榜">
          {loading && rows.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Spin tip="排行榜加载中" />
            </div>
          ) : (
            <div className="leaderboard-table-wrap">
              <Table
                className="leaderboard-table"
                columns={columns}
                dataSource={rows}
                rowKey="userId"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                }}
                empty={
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <Typography.Text type="tertiary">暂无真实排行榜数据</Typography.Text>
                  </div>
                }
              />
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
