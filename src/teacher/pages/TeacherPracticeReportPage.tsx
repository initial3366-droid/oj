/**
 * 教师练习Report页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Grid,
  Message,
  Modal,
  Space,
  Statistic,
  Table,
  Tag,
} from '@arco-design/web-react';
import { IconDownload, IconEye, IconLeft } from '@arco-design/web-react/icon';
import { teacherGet } from '../teacherApi';

const { Row, Col } = Grid;

/**
 * 练习Ranking接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PracticeRanking {
  userId: number;
  displayName: string;
  score: number;
  solved: number;
  submissionCount: number;
}

/**
 * 练习提交接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PracticeSubmission {
  id: number;
  userId: number;
  displayName: string;
  problemId: number;
  problemTitle: string;
  language: string;
  status: string;
  timeUsed: number;
  memoryUsed: number;
  createdAt: string;
}

/**
 * 练习Report接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PracticeReport {
  practiceId: number;
  participantCount: number;
  submissionCount: number;
  rankings: PracticeRanking[];
  submissions: PracticeSubmission[];
}

const statusColors: Record<string, string> = {
  AC: 'green',
  ACCEPTED: 'green',
  WA: 'red',
  WRONG_ANSWER: 'red',
  TLE: 'orange',
  TIME_LIMIT_EXCEEDED: 'orange',
  MLE: 'orange',
  MEMORY_LIMIT_EXCEEDED: 'orange',
  RE: 'red',
  RUNTIME_ERROR: 'red',
  CE: 'gray',
  COMPILATION_ERROR: 'gray',
};

/**
 * 渲染教师练习Report页面，并协调其数据加载、状态和交互。
 */
export function TeacherPracticeReportPage() {
  const navigate = useNavigate();
  const { practiceId } = useParams();
  const numericId = practiceId ? Number(practiceId) : undefined;

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PracticeReport | null>(null);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (numericId) loadReport();
  }, [numericId]);

  /**
   * 读取Report并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadReport() {
    setLoading(true);
    try {
      const result = await teacherGet<PracticeReport>(`/api/admin/v1/practices/${numericId}/report`);
      setReport(result);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载报告失败');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 封装view编码相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function viewCode(submissionId: number) {
    setCodeLoading(true);
    setCodeModalVisible(true);
    try {
      const code = await teacherGet<string>(`/api/teacher/v1/submissions/${submissionId}/code`);
      setCodeContent(code);
    } catch (error) {
      setCodeContent('加载代码失败');
    } finally {
      setCodeLoading(false);
    }
  }

  /**
   * 封装导出Rankings相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  function exportRankings() {
    if (!report?.rankings?.length) return;
    const header = '排名,用户ID,用户名,得分,通过题数,提交次数\n';
    const rows = report.rankings.map((r, i) =>
      `${i + 1},${r.userId},${r.displayName},${r.score},${r.solved},${r.submissionCount}`
    ).join('\n');
    downloadCsv(header + rows, `practice_${practiceId}_rankings.csv`);
  }

  /**
   * 封装导出Submissions相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  function exportSubmissions() {
    if (!report?.submissions?.length) return;
    const header = '提交ID,用户ID,用户名,题目ID,题目名称,语言,状态,耗时(ms),内存(KB),提交时间\n';
    const rows = report.submissions.map((s) =>
      `${s.id},${s.userId},${s.displayName},${s.problemId},${s.problemTitle},${s.language},${s.status},${s.timeUsed ?? ''},${s.memoryUsed ?? ''},${s.createdAt}`
    ).join('\n');
    downloadCsv(header + rows, `practice_${practiceId}_submissions.csv`);
  }

  /**
   * 封装downloadCsv相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  function downloadCsv(content: string, filename: string) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title="题单做题信息"
        loading={loading}
        extra={
          <Button icon={<IconLeft />} onClick={() => navigate('/teacher/practices')}>返回列表</Button>
        }
      >
        {report && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Statistic title="参与人数" value={report.participantCount} />
            </Col>
            <Col span={8}>
              <Statistic title="总提交数" value={report.submissionCount} />
            </Col>
            <Col span={8}>
              <Statistic title="题目数" value={report.rankings?.[0]?.solved ? Math.max(...report.rankings.map(r => r.solved)) : 0} />
            </Col>
          </Row>
        )}
      </Card>

      {report && (
        <>
          <Card
            bordered={false}
            title="学生排名"
            extra={
              <Button icon={<IconDownload />} onClick={exportRankings}>导出排名</Button>
            }
          >
            <Table
              rowKey="userId"
              data={report.rankings}
              pagination={{ pageSize: 20, showTotal: true }}
              columns={[
                { title: '排名', width: 70, align: 'center', render: (_: unknown, __: PracticeRanking, i: number) => <Tag color={i < 3 ? 'gold' : 'gray'}>#{i + 1}</Tag> },
                { title: '用户名', dataIndex: 'displayName', width: 150 },
                { title: '得分', dataIndex: 'score', width: 100, align: 'center', sorter: (a: PracticeRanking, b: PracticeRanking) => a.score - b.score },
                { title: '通过题数', dataIndex: 'solved', width: 100, align: 'center' },
                { title: '提交次数', dataIndex: 'submissionCount', width: 100, align: 'center' },
              ]}
            />
          </Card>

          <Card
            bordered={false}
            title="提交记录"
            extra={
              <Button icon={<IconDownload />} onClick={exportSubmissions}>导出提交</Button>
            }
          >
            <Table
              rowKey="id"
              data={report.submissions}
              pagination={{ pageSize: 20, showTotal: true }}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 80, align: 'center' },
                { title: '用户', dataIndex: 'displayName', width: 120 },
                { title: '题目', dataIndex: 'problemTitle', width: 200 },
                { title: '语言', dataIndex: 'language', width: 80, align: 'center' },
                {
                  title: '状态', dataIndex: 'status', width: 100, align: 'center',
                  render: (status: string) => <Tag color={statusColors[status] || 'gray'}>{status}</Tag>,
                },
                { title: '耗时', dataIndex: 'timeUsed', width: 80, align: 'center', render: (v: number) => v ? `${v}ms` : '-' },
                { title: '内存', dataIndex: 'memoryUsed', width: 80, align: 'center', render: (v: number) => v ? `${v}KB` : '-' },
                { title: '提交时间', dataIndex: 'createdAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
                {
                  title: '代码', width: 80, align: 'center',
                  render: (_: unknown, record: PracticeSubmission) => (
                    <Button type="text" size="small" icon={<IconEye />} onClick={() => viewCode(record.id)}>查看</Button>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}

      <Modal
        title="提交代码"
        visible={codeModalVisible}
        onCancel={() => { setCodeModalVisible(false); setCodeContent(''); }}
        footer={null}
        style={{ width: 700 }}
      >
        {codeLoading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>
        ) : (
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 500, fontSize: 13, fontFamily: 'monospace' }}>
            {codeContent}
          </pre>
        )}
      </Modal>
    </Space>
  );
}
