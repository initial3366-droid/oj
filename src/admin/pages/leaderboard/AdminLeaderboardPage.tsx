/**
 * 管理员排行榜页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, Grid, Message, Statistic, Table, Tag } from '@arco-design/web-react';
import { IconTrophy } from '@arco-design/web-react/icon';
import { adminGet } from '../../api/adminClient';

const { Row, Col } = Grid;

/**
 * Global排名接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface GlobalRank {
  userId: number;
  name: string;
  className?: string;
  acCount: number;
  streak: number;
}

/**
 * 班级排名接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ClassRank {
  classId: number;
  className: string;
  memberCount: number;
  acCount: number;
}

/**
 * 渲染管理员排行榜页面，并协调其数据加载、状态和交互。
 */
export function AdminLeaderboardPage() {
  const [globalRows, setGlobalRows] = useState<GlobalRank[]>([]);
  const [classRows, setClassRows] = useState<ClassRank[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [globalRank, classRank] = await Promise.all([
        adminGet<GlobalRank[]>('/api/v1/leaderboard/global?limit=5000'),
        adminGet<ClassRank[]>('/api/v1/leaderboard/classes?limit=5000'),
      ]);
      setGlobalRows(globalRank || []);
      setClassRows(classRank || []);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '榜单数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topUser = globalRows[0];
  const topClass = classRows[0];
  const totalClassAc = classRows.reduce((sum, item) => sum + (item.acCount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Row gutter={[16, 20]}>
        <Col span={6}>
          <Card>
            <Statistic title="上榜用户" value={globalRows.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="最高 AC 用户" value={topUser?.acCount ?? 0} suffix={topUser ? `题 · ${topUser.name}` : '题'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="上榜班级" value={classRows.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="班级 AC 总量" value={totalClassAc} suffix={topClass ? `题 · 第一：${topClass.className}` : '题'} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconTrophy />
            学生 AC 排行榜
          </span>
        }
      >
        <Table
          rowKey="userId"
          loading={loading}
          data={globalRows}
          pagination={{ pageSize: 10, showTotal: true, showJumper: true, sizeCanChange: true }}
          columns={[
            { title: '排名', width: 90, render: (_value, _record, index) => <Tag color={index < 3 ? 'gold' : 'gray'}>#{index + 1}</Tag> },
            { title: '用户', dataIndex: 'name', width: 180 },
            { title: '班级', dataIndex: 'className', width: 180, render: (value) => value || '-' },
            { title: '非比赛 AC', dataIndex: 'acCount', width: 140, sorter: (a, b) => a.acCount - b.acCount },
            { title: '连续训练', dataIndex: 'streak', width: 120, render: (value) => `${value ?? 0} 天` },
          ]}
        />
      </Card>

      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconTrophy />
            班级 AC 排行榜
          </span>
        }
      >
        <Table
          rowKey="classId"
          loading={loading}
          data={classRows}
          pagination={{ pageSize: 10, showTotal: true, showJumper: true, sizeCanChange: true }}
          columns={[
            { title: '排名', width: 90, render: (_value, _record, index) => <Tag color={index < 3 ? 'gold' : 'gray'}>#{index + 1}</Tag> },
            { title: '班级', dataIndex: 'className', width: 220 },
            { title: '学生数', dataIndex: 'memberCount', width: 120 },
            { title: '班级 AC 数量', dataIndex: 'acCount', width: 160, sorter: (a, b) => a.acCount - b.acCount },
          ]}
        />
      </Card>
    </div>
  );
}
