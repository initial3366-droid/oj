/**
 * 练习历史提交页面（非比赛）。展示该题所有用户的提交，可查看代码（只读弹窗）。
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Empty, Modal, Table, Tag, Typography } from "antd";
import { decryptIdFromUrl } from "../utils/cipher";
import { fetchProblemDetail } from "../api/problem";
import { fetchProblemSubmissions, fetchSubmissionDetail, type SubmissionRecord } from "../api/submission";
import { CodeViewer } from "../components/common";

/**
 * 解码题目路由标识为后端题目 ID（与 PracticePage 一致）。
 */
function backendProblemId(problemId: string): number | null {
  const prefix = problemId.startsWith("cp") ? "cp" : problemId.startsWith("p") ? "p" : "";
  const encoded = problemId.slice(prefix.length);
  if (!encoded || !/^\d{8}$/.test(encoded)) return null;
  return decryptIdFromUrl(encoded);
}

function formatSubmitTime(value?: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

const statusLabels: Record<string, string> = {
  WAITING: "Waiting",
  PENDING: "Pending",
  QUEUED: "Queued",
  REJUDGE_PENDING: "Rejudge Pending",
  JUDGING: "Judging",
  COMPILING: "Compiling",
  RUNNING: "Running",
  AC: "Accepted",
  ACCEPTED: "Accepted",
  WA: "Wrong Answer",
  WRONG_ANSWER: "Wrong Answer",
  TLE: "Time Limit Exceeded",
  TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
  MLE: "Memory Limit Exceeded",
  MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded",
  RE: "Runtime Error",
  RUNTIME_ERROR: "Runtime Error",
  CE: "Compile Error",
  COMPILE_ERROR: "Compile Error",
  COMPILATION_ERROR: "Compile Error",
  NOO: "No Output",
  SE: "System Error",
  SYSTEM_ERROR: "System Error",
  FAILED: "Failed",
};

/**
 * 提交状态对应的 antd Tag 颜色。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusColor(status: string): "success" | "error" | "warning" | "processing" | "default" {
  const normalized = status.toUpperCase();
  if (normalized === "AC" || normalized === "ACCEPTED") return "success";
  if (["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(normalized)) return "processing";
  if (["SE", "SYSTEM_ERROR", "FAILED"].includes(normalized)) return "default";
  return "error";
}

/**
 * 历史提交页面：显示该题所有人的提交记录，代码只读弹窗查看。
 */
export function PracticeHistoryPage() {
  const navigate = useNavigate();
  const { problemId } = useParams();
  const numericProblemId = useMemo(() => (problemId ? backendProblemId(problemId) : null), [problemId]);
  const [problemTitle, setProblemTitle] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyModal, setHistoryModal] = useState<{ submissionId: number; language: string; submitTime: string; code: string } | null>(null);
  const [historyCodeLoading, setHistoryCodeLoading] = useState(false);

  useEffect(() => {
    if (!numericProblemId) return;
    fetchProblemDetail(numericProblemId)
      .then((problem) => setProblemTitle(problem.title))
      .catch(() => setProblemTitle(""));
  }, [numericProblemId]);

  // 页面标题：历史提交 - 题目名称
  useEffect(() => {
    if (!problemTitle) return;
    window.dispatchEvent(new CustomEvent("qoj:document-title", {
      detail: { title: `历史提交 - ${problemTitle}` },
    }));
  }, [problemTitle]);

  const loadSubmissions = async () => {
    if (!numericProblemId) return;
    setLoading(true);
    try {
      setSubmissions(await fetchProblemSubmissions(numericProblemId, null, 1, 200));
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [numericProblemId]);

  const viewHistoryCode = async (record: SubmissionRecord) => {
    setHistoryCodeLoading(true);
    try {
      const detail = await fetchSubmissionDetail(record.id);
      setHistoryModal({
        submissionId: record.id,
        language: record.language,
        submitTime: record.createdAt,
        code: detail.code ?? record.code ?? "",
      });
    } catch {
      // 无权限或加载失败时静默：后端已按比赛/非比赛策略限制
    } finally {
      setHistoryCodeLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          历史提交{problemTitle ? ` · ${problemTitle}` : ""}
        </Typography.Title>
        <Button onClick={() => problemId && navigate(`/practice/problem/${problemId}`)}>
          返回写题
        </Button>
      </div>

      <Table
        size="middle"
        rowKey="id"
        dataSource={submissions}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无提交记录" /> }}
        columns={[
          { title: "提交者", dataIndex: "displayName", width: 140, ellipsis: true, render: (value?: string | null) => value || "-" },
          { title: "题目名称", dataIndex: "problemTitle", ellipsis: true, render: (value?: string | null) => value || "-" },
          { title: "代码长度", dataIndex: "codeLength", width: 110, align: "center" as const, render: (value?: number | null) => (value != null ? `${value} B` : "-") },
          { title: "运行时间", dataIndex: "timeUsed", width: 110, align: "center" as const, render: (value?: number | null) => (value != null ? `${value} ms` : "-") },
          { title: "内存", dataIndex: "memoryUsed", width: 110, align: "center" as const, render: (value?: number | null) => (value != null ? `${value} KB` : "-") },
          {
            title: "提交状态",
            dataIndex: "status",
            width: 120,
            align: "center" as const,
            render: (value?: string | null) => {
              const status = (value || "").toUpperCase();
              if (!status) return "-";
              return (
                <Tag color={statusColor(status)} style={{ marginInlineEnd: 0 }}>
                  {statusLabels[status] ?? value}
                </Tag>
              );
            },
          },
          { title: "提交时间", dataIndex: "createdAt", width: 180, render: (value?: string | null) => formatSubmitTime(value) },
          {
            title: "查看代码",
            width: 110,
            align: "center" as const,
            render: (_: unknown, record: SubmissionRecord) => (
              <Button size="small" loading={historyCodeLoading} onClick={() => viewHistoryCode(record)}>
                查看代码
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title={historyModal ? `提交代码 #${historyModal.submissionId}（${historyModal.language}）` : "提交代码"}
        open={Boolean(historyModal)}
        onCancel={() => setHistoryModal(null)}
        footer={null}
        width="60%"
      >
        <CodeViewer
          code={historyModal?.code || "（无代码）"}
          language={historyModal?.language || ""}
          height="60vh"
        />
      </Modal>
    </div>
  );
}
