/**
 * 题目Submissions页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Alert, Button, Card, Modal, Table, Tag, Typography } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  fetchMyProblemSubmissions,
  fetchProblemDetail,
  fetchSubmissionDetail,
  type SubmissionRecord,
} from '../data/apiClient';
import type { Problem } from '../data/types';
import { PageContainer, CodeViewer } from '../components/common';
import { decryptIdFromUrl } from '../utils/cipher';

/**
 * 封装backend题目标识相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function backendProblemId(problemId: string | undefined): number | null {
  if (!problemId) return null;
  const prefix = problemId.startsWith("cp") ? "cp" : problemId.startsWith("p") ? "p" : "";
  const encoded = problemId.slice(prefix.length);
  if (!encoded || !/^\d{8}$/.test(encoded)) return null;
  return decryptIdFromUrl(encoded);
}

/**
 * 封装练习题目Path相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function practiceProblemPath(problemId: string | undefined, contestId: number | null) {
  if (!problemId) return '/problems';
  return `/practice/problem/${problemId}${contestId ? `?contestId=${contestId}` : ''}`;
}

const statusLabels: Record<string, string> = {
  WAITING: 'Waiting',
  PENDING: 'Pending',
  QUEUED: 'Pending',
  REJUDGE_PENDING: 'Rejudge Pending',
  JUDGING: 'Judging',
  COMPILING: 'Compiling',
  RUNNING: 'Running',
  AC: 'Accepted',
  ACCEPTED: 'Accepted',
  WA: 'Wrong Answer',
  WRONG_ANSWER: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
  TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
  MLE: 'Memory Limit Exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
  RE: 'Runtime Error',
  RUNTIME_ERROR: 'Runtime Error',
  CE: 'Compile Error',
  COMPILE_ERROR: 'Compile Error',
  NOO: 'No Output',
  SE: 'System Error',
  SYSTEM_ERROR: 'System Error',
  FAILED: 'Failed',
};

/**
 * 读取状态Color并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function getStatusColor(status: string): 'green' | 'grey' | 'red' | 'blue' {
  const normalized = status.toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
  if (['WAITING', 'PENDING', 'QUEUED', 'REJUDGE_PENDING', 'JUDGING', 'COMPILING', 'RUNNING'].includes(normalized)) {
    return 'blue';
  }
  if (normalized === 'SE' || normalized === 'SYSTEM_ERROR' || normalized === 'FAILED') return 'grey';
  return 'red';
}

/**
 * 格式化Time。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 封装提交Time相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function submissionTime(record: SubmissionRecord) {
  return record.submitTime || record.createdAt;
}

/**
 * 渲染题目Submissions页面，并协调其数据加载、状态和交互。
 */
export function ProblemSubmissionsPage() {
  const { problemId } = useParams();
  const [searchParams] = useSearchParams();
  /**
   * 封装numeric题目标识相关逻辑。对原始数据进行派生或聚合。
   */
  const numericProblemId = useMemo(() => backendProblemId(problemId), [problemId]);
  const contestId = Number(searchParams.get('contestId') ?? 0) || null;
  const [problem, setProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);
  const [codeLoadingId, setCodeLoadingId] = useState<number | null>(null);
  const [hasAccessToken] = useState(() => Boolean(window.localStorage.getItem('qoj.accessToken')));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!numericProblemId) {
      setMessage('题目 ID 无效');
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchProblemDetail(numericProblemId),
      fetchMyProblemSubmissions(numericProblemId, contestId),
    ])
      .then(([problemData, submissionData]) => {
        if (!cancelled) {
          setProblem(problemData);
          setSubmissions(submissionData);
          setMessage('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSubmissions([]);
          setMessage(error instanceof Error ? error.message : '提交记录加载失败');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [numericProblemId, contestId]);

  /**
   * 封装测试点CountText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const caseCountText = (submission: SubmissionRecord) => {
    const passed = submission.passedCaseCount ?? 0;
    const total = submission.totalCaseCount ?? 0;
    return total > 0 ? `${passed} / ${total}` : String(passed);
  };

  /**
   * 封装open编码相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const openCode = async (submission: SubmissionRecord) => {
    if (!hasAccessToken) {
      setMessage('请先登录后查看提交代码');
      return;
    }
    setCodeLoadingId(submission.id);
    try {
      const detail = submission.code ? submission : await fetchSubmissionDetail(submission.id);
      setSelectedSubmission(detail);
      setSubmissions((current) =>
        current.map((item) => (item.id === detail.id ? { ...item, ...detail } : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交代码加载失败');
    } finally {
      setCodeLoadingId(null);
    }
  };

  const columns: TableColumnsType<SubmissionRecord> = [
    {
      title: '代码',
      dataIndex: 'id',
      width: 120,
      render: (_text, record) => (
        <Button
          size="small"
          type="text"
          loading={codeLoadingId === record.id}
          disabled={!hasAccessToken || codeLoadingId === record.id}
          onClick={() => openCode(record)}
        >
          {!hasAccessToken ? '登录后查看' : codeLoadingId === record.id ? '加载中' : '查看代码'}
        </Button>
      ),
    },
    ...(!contestId
      ? [
          {
            title: '测试点通过数量',
            dataIndex: 'passedCaseCount',
            width: 150,
            render: (_text, record) => (
              <Typography.Text strong style={{ fontSize: 14 }}>
                {caseCountText(record)}
              </Typography.Text>
            ),
          } satisfies NonNullable<TableColumnsType<SubmissionRecord>[number]>,
        ]
      : []),
    {
      title: '时间',
      dataIndex: 'submitTime',
      width: 200,
      render: (_time: string, record: SubmissionRecord) => (
        <div style={{ minWidth: 144 }}>
          <Typography.Text style={{ fontSize: 14 }}>{formatTime(submissionTime(record))}</Typography.Text>
          <Typography.Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 12 }}>
            {record.language}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 200,
      render: (status: string, record: SubmissionRecord) => (
        <div style={{ minWidth: 112, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Tag
            color={getStatusColor(status) === 'grey' ? 'default' : getStatusColor(status)}
            style={{ fontSize: 12 }}
          >
            {statusLabels[status.toUpperCase()] ?? status}
          </Tag>
          {(typeof record.timeUsed === 'number' || typeof record.memoryUsed === 'number') && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {typeof record.timeUsed === 'number' ? `${record.timeUsed} ms` : '-'}
              {' / '}
              {typeof record.memoryUsed === 'number' ? `${record.memoryUsed} KB` : '-'}
            </Typography.Text>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer
      title={problem?.title ?? '本道题提交记录'}
      subtitle="Submissions"
      description={`查看${contestId ? '本场比赛' : '本道题'}的提交时间和测评状态。`}
      extra={
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => {
            window.location.href = practiceProblemPath(problemId, contestId);
          }}
        >
          返回写代码
        </Button>
      }
    >
      {message && (
        <Alert
          type="error"
          message={message}
          showIcon={false}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        style={{
          border: '1px solid var(--qoj-color-border)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={submissions}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Typography.Text type="secondary">暂无提交记录</Typography.Text>
              </div>
            ),
          }}
        />
      </Card>

      <Modal
        title="提交代码"
        open={!!selectedSubmission}
        onCancel={() => setSelectedSubmission(null)}
        footer={null}
        width="60%"
      >
        {selectedSubmission && (
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
              {formatTime(submissionTime(selectedSubmission))}
            </Typography.Text>
            <CodeViewer
              code={selectedSubmission.code || '(无代码)'}
              language={selectedSubmission.language}
              height="60vh"
            />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}