import Editor, { type OnMount } from "@monaco-editor/react";
import { Button, Tag } from "@douyinfe/semi-ui";
import { IconBulb, IconClose, IconCode, IconFile, IconHistory, IconMinus, IconPlus, IconSend } from "@douyinfe/semi-icons";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MarkdownMath } from "../components/MarkdownMath";
import { useOjData } from "../data/OjDataProvider";
import { chatWithAgent, fetchAgentQuota, type AgentQuota } from "../api/agent";
import { fetchContestProblemDetail, fetchProblemDetail } from "../api/problem";
import { fetchSubmissionDetail, runCodeInSandbox, submitCode, type SubmissionRecord } from "../api/submission";
import type { Problem } from "../data/types";
import { wsClient } from "../utils/websocket";
import { decryptIdFromUrl } from "../utils/cipher";

type PracticeLanguage = "C" | "C++" | "Python" | "Java";

type DebugAlert = {
  type: "success" | "danger" | "neutral" | "info";
  title: string;
  detail?: string;
  source?: "debug" | "submit";
};

type SubmissionResult = Partial<Pick<
  SubmissionRecord,
  "id" | "language" | "status" | "timeUsed" | "memoryUsed" | "passedCaseCount" | "totalCaseCount" | "cases"
>>;

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const languageOptions: Array<{ label: PracticeLanguage; apiValue: string }> = [
  { label: "C", apiValue: "c" },
  { label: "C++", apiValue: "cpp" },
  { label: "Python", apiValue: "python" },
  { label: "Java", apiValue: "java" },
];

const monacoLanguages: Record<PracticeLanguage, string> = {
  C: "c",
  "C++": "cpp",
  Python: "python",
  Java: "java",
};

const templates: Record<PracticeLanguage, string> = {
  C: `#include <stdio.h>

int main(void) {
    return 0;
}`,
  "C++": `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}`,
  Python: `import sys

def solve():
    pass

if __name__ == "__main__":
    solve()
`,
  Java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
    }
}`,
};

function backendProblemId(problemId: string): number | null {
  const prefix = problemId.startsWith("cp") ? "cp" : problemId.startsWith("p") ? "p" : "";
  const encoded = problemId.slice(prefix.length);
  if (!encoded || !/^\d{8}$/.test(encoded)) return null;
  return decryptIdFromUrl(encoded);
}

function currentCodeOwnerKey() {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    return "guest";
  }
  try {
    const payloadPart = token.split(".")[1] ?? "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded));
    return String(payload.userId ?? payload.sub ?? "guest");
  } catch {
    return "guest";
  }
}

function codeStorageKey(problemId: string, language: PracticeLanguage) {
  return `qoj.code.user.${currentCodeOwnerKey()}.${problemId}.${language}`;
}

function clampHeight(value: number) {
  return Math.min(Math.max(value, 180), Math.floor(window.innerHeight * 0.68));
}

function clampSplit(value: number) {
  return Math.min(Math.max(value, 18), 82);
}

function clampFontSize(value: number) {
  return Math.min(Math.max(value, 12), 28);
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

const submissionStatusLabels: Record<string, string> = {
  WAITING: "队列中",
  PENDING: "等待测评",
  QUEUED: "等待测评",
  REJUDGE_PENDING: "等待重判",
  JUDGING: "测评中",
  COMPILING: "编译中",
  RUNNING: "运行中",
  AC: "通过",
  ACCEPTED: "通过",
  WA: "答案错误",
  WRONG_ANSWER: "答案错误",
  TLE: "运行超时",
  TIME_LIMIT_EXCEEDED: "运行超时",
  MLE: "内存超限",
  MEMORY_LIMIT_EXCEEDED: "内存超限",
  RE: "运行错误",
  RUNTIME_ERROR: "运行错误",
  CE: "编译错误",
  COMPILE_ERROR: "编译错误",
  NOO: "无输出",
  SE: "系统错误",
  SYSTEM_ERROR: "系统错误",
  FAILED: "测评失败",
};

function isRunningSubmissionStatus(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  return ["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(normalized);
}

function isFinalSubmissionStatus(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  return Boolean(normalized) && !isRunningSubmissionStatus(normalized);
}

function formatSubmissionAlert(data: SubmissionResult, options?: { showCaseDetails?: boolean }): DebugAlert {
  const showCaseDetails = options?.showCaseDetails ?? true;
  const status = String(data.status ?? "PENDING").toUpperCase();
  const statusLabel = submissionStatusLabels[status] ?? status;
  const detail = [
    data.id ? `提交 ID：${data.id}` : null,
    data.language ? `提交语言：${data.language}` : null,
    `测评状态：${statusLabel}`,
    showCaseDetails && typeof data.passedCaseCount === "number" && typeof data.totalCaseCount === "number"
      ? `测试点：${data.passedCaseCount} / ${data.totalCaseCount}`
      : null,
    typeof data.timeUsed === "number" ? `运行时间：${data.timeUsed} ms` : null,
    typeof data.memoryUsed === "number" ? `运行内存：${data.memoryUsed} KB` : null,
    ...(showCaseDetails && data.cases?.length
      ? data.cases.map((item) => {
          const caseStatus = item.status ? (submissionStatusLabels[item.status] ?? item.status) : "-";
          const time = typeof item.timeMs === "number" ? `，${item.timeMs} ms` : "";
          const memory = typeof item.memoryKb === "number" ? `，${item.memoryKb} KB` : "";
          return `测试点 ${item.caseNo ?? "-"}：${caseStatus}${time}${memory}`;
        })
      : []),
  ].filter(Boolean);

  return {
    type: status === "AC" || status === "ACCEPTED" ? "success" : isRunningSubmissionStatus(status) ? "info" : "danger",
    title: `提交结果：${statusLabel}`,
    detail: detail.join("\n"),
    source: "submit",
  };
}

export function PracticePage() {
  const splitRootRef = useRef<HTMLDivElement | null>(null);
  const submissionWatcherCleanupRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();
  const { problemId } = useParams();
  const [searchParams] = useSearchParams();
  const { state } = useOjData();
  const [remoteProblem, setRemoteProblem] = useState<Problem | null>(null);
  const numericProblemId = useMemo(() => (problemId ? backendProblemId(problemId) : null), [problemId]);
  const hasLocalProblem = useMemo(
    () => Boolean(problemId && state.problems.some((item) => item.id === problemId)),
    [problemId, state.problems],
  );
  const problem = useMemo(() => {
    if (!problemId) {
      return null;
    }
    return state.problems.find((item) => item.id === problemId) ?? (remoteProblem?.id === problemId ? remoteProblem : null);
  }, [problemId, remoteProblem, state.problems]);
  const [language, setLanguage] = useState<PracticeLanguage>("C++");
  const [code, setCode] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugHeight, setDebugHeight] = useState(280);
  const [debugInput, setDebugInput] = useState("");
  const [debugOutput, setDebugOutput] = useState("调试结果会显示在这里。");
  const [debugLoading, setDebugLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [debugAlert, setDebugAlert] = useState<DebugAlert | null>(null);
  const [sampleIndex, setSampleIndex] = useState<number | "custom">("custom");
  const [leftPanePercent, setLeftPanePercent] = useState(50);
  const [paneResizing, setPaneResizing] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentQuota, setAgentQuota] = useState<AgentQuota | null>(null);
  const [lastSubmissionId, setLastSubmissionId] = useState<number | null>(null);
  const practiceId = searchParams.get("practiceId");
  const contestId = searchParams.get("contestId");
  const isContestMode = Boolean(contestId);
  const samples = problem?.samples ?? [];
  const selectedSample = typeof sampleIndex === "number" ? samples[sampleIndex] : null;
  const sampleSelectValue = typeof sampleIndex === "number" ? String(sampleIndex) : "custom";
  const showDebugFields = debugAlert?.source !== "submit";

  useEffect(() => {
    return () => {
      submissionWatcherCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    fetchAgentQuota().then(setAgentQuota).catch(() => {});
  }, []);

  useEffect(() => {
    if (!problem?.title) {
      return;
    }
    window.dispatchEvent(new CustomEvent("qoj:document-title", { detail: { title: problem.title } }));
  }, [problem?.title]);

  useEffect(() => {
    setRemoteProblem(null);
    if (!numericProblemId || hasLocalProblem) {
      return;
    }
    let cancelled = false;
    const loader = contestId
      ? fetchContestProblemDetail(Number(contestId), numericProblemId)
      : fetchProblemDetail(numericProblemId);
    loader
      .then((data) => {
        if (!cancelled) {
          setRemoteProblem(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteProblem(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contestId, hasLocalProblem, numericProblemId]);

  useEffect(() => {
    if (!problem?.id) {
      return;
    }
    setCode(window.localStorage.getItem(codeStorageKey(problem.id, language)) ?? templates[language]);
  }, [language, problem?.id]);

  useEffect(() => {
    if (typeof sampleIndex === "number" && !samples[sampleIndex]) {
      setSampleIndex("custom");
      setDebugInput("");
    }
  }, [samples, sampleIndex]);

  const changeLanguage = (next: PracticeLanguage) => {
    if (problem?.id) {
      window.localStorage.setItem(codeStorageKey(problem.id, language), code);
    }
    setLanguage(next);
  };

  const updateCode = (next: string) => {
    setCode(next);
    if (problem?.id) {
      window.localStorage.setItem(codeStorageKey(problem.id, language), next);
    }
  };

  const nextAgentMessageId = (role: AgentMessage["role"]) => {
    return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const appendAgentMessage = (role: AgentMessage["role"], content: string) => {
    setAgentMessages((current) => [
      ...current,
      { id: nextAgentMessageId(role), role, content },
    ]);
  };

  const latestDebugText = () => {
    if (!debugAlert) {
      return "暂无最新调试或提交结果。";
    }
    return [debugAlert.title, debugAlert.detail].filter(Boolean).join("\n");
  };

  const sendAgentMessage = async (message?: string) => {
    const content = (message ?? agentInput).trim();
    if (!content || agentLoading) {
      return;
    }
    setAgentOpen(true);

    const hasToken = Boolean(
      window.localStorage.getItem("qoj.accessToken")
      || window.localStorage.getItem("qoj.refreshToken"),
    );
    if (!hasToken) {
      appendAgentMessage("assistant", "请先登录后使用 AI 助手。");
      return;
    }

    if (!numericProblemId) {
      appendAgentMessage("assistant", "当前题目缺少后端题目 ID，无法使用 AI 助手。");
      return;
    }

    const option = languageOptions.find((item) => item.label === language);
    const userMessage: AgentMessage = {
      id: nextAgentMessageId("user"),
      role: "user",
      content,
    };
    setAgentMessages((current) => [...current, userMessage]);
    setAgentInput("");
    setAgentLoading(true);

    try {
      const response = await chatWithAgent({
        message: content,
        problemId: numericProblemId,
        contestId: contestId ? Number(contestId) : undefined,
        contestProblemId: contestId ? numericProblemId : undefined,
        language: option?.apiValue ?? language.toLowerCase(),
        code,
        submissionId: lastSubmissionId ?? undefined,
      });
      appendAgentMessage("assistant", response.reply);
      // 更新配额
      fetchAgentQuota().then(setAgentQuota).catch(() => {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "AI 助手请求失败";
      appendAgentMessage("assistant", `请求失败：${errorMessage}`);
    } finally {
      setAgentLoading(false);
    }
  };

  const startSubmissionWatcher = (submissionId: number) => {
    submissionWatcherCleanupRef.current?.();

    let stopped = false;
    let unsubscribe: (() => void) | null = null;
    let pollTimer: number | null = null;

    const stop = () => {
      stopped = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      if (submissionWatcherCleanupRef.current === stop) {
        submissionWatcherCleanupRef.current = null;
      }
    };

    const refreshSubmission = async () => {
      if (stopped) {
        return;
      }
      try {
        const detail = await fetchSubmissionDetail(submissionId);
        if (stopped) {
          return;
        }
        setDebugAlert(formatSubmissionAlert(detail, { showCaseDetails: !isContestMode }));
        if (isFinalSubmissionStatus(detail.status)) {
          stop();
        }
      } catch {
        // WebSocket/polling 是体验增强，偶发失败不打断当前提交结果展示。
      }
    };

    submissionWatcherCleanupRef.current = stop;

    wsClient
      .subscribeToSubmission(submissionId, (update) => {
        if (stopped) {
          return;
        }
        setDebugAlert(formatSubmissionAlert(
          {
            id: update.submissionId,
            language: undefined,
            status: update.status,
            timeUsed: update.time,
            memoryUsed: update.memory,
            passedCaseCount: undefined,
            totalCaseCount: undefined,
            cases: null,
          },
          { showCaseDetails: !isContestMode },
        ));
        refreshSubmission();
      })
      .then((dispose) => {
        if (stopped) {
          dispose();
          return;
        }
        unsubscribe = dispose;
      })
      .catch(() => {
        unsubscribe = null;
      });

    pollTimer = window.setInterval(refreshSubmission, 2000);
    refreshSubmission();
  };

  const startDebugResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = debugHeight;
    const onMove = (moveEvent: MouseEvent) => {
      setDebugHeight(clampHeight(startHeight + startY - moveEvent.clientY));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startPaneResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setPaneResizing(true);
    const onMove = (moveEvent: MouseEvent) => {
      const rect = splitRootRef.current?.getBoundingClientRect();
      if (!rect?.width) {
        return;
      }
      setLeftPanePercent(clampSplit(((moveEvent.clientX - rect.left) / rect.width) * 100));
    };
    const onUp = () => {
      setPaneResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const changeFontSize = (delta: number) => {
    setFontSize((current) => clampFontSize(current + delta));
  };

  const configureEditor: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme("qoj-vscode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955" },
        { token: "keyword", foreground: "569CD6" },
        { token: "number", foreground: "B5CEA8" },
        { token: "string", foreground: "CE9178" },
        { token: "type", foreground: "4EC9B0" },
      ],
      colors: {
        "editor.background": "#1E1E1E",
        "editor.foreground": "#D4D4D4",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#C6C6C6",
        "editorCursor.foreground": "#AEAFAD",
        "editor.selectionBackground": "#264F78",
        "editor.inactiveSelectionBackground": "#3A3D41",
        "editorIndentGuide.background1": "#404040",
        "editorIndentGuide.activeBackground1": "#707070",
        "editor.lineHighlightBackground": "#2A2D2E",
      },
    });
    monaco.editor.setTheme("qoj-vscode-dark");
    editor.focus();
  };

  const runDebug = async () => {
    if (debugLoading) {
      return;
    }
    if (state.judgeSettings && !state.judgeSettings.enabled) {
      setDebugOpen(true);
      setDebugAlert({
        type: "danger",
        title: "判题服务已关闭",
        detail: "管理员已暂时关闭判题功能，无法调试运行。",
        source: "debug",
      });
      return;
    }
    setDebugOpen(true);

    const option = languageOptions.find((item) => item.label === language);
    setDebugLoading(true);

    try {
      const result = await runCodeInSandbox({
        language: option?.apiValue ?? language.toLowerCase(),
        code,
        input: debugInput,
      });

      const status = String(result.status ?? "").toUpperCase();
      const actualOutput = String(result.output ?? "");
      const displayOutput = actualOutput || (status ? `运行状态：${status}` : "(无输出)");
      setDebugOutput(displayOutput);

      if (status === "CE") {
        setDebugAlert({
          type: "danger",
          title: "编译失败",
          source: "debug",
        });
        return;
      }

      if (selectedSample) {
        const expectedOutput = selectedSample.output ?? "";
        const accepted = normalizeOutput(actualOutput) === normalizeOutput(expectedOutput);
        setDebugAlert({
          type: accepted ? "success" : "danger",
          title: accepted ? "你的测试结果与样例一样" : "你的测试结果与样例不一样",
          source: "debug",
        });
      } else {
        setDebugAlert(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "调试失败，请检查后端服务。";
      setDebugOutput(message);
      setDebugAlert({ type: "danger", title: "调试失败", detail: message, source: "debug" });
    } finally {
      setDebugLoading(false);
    }
  };

  const selectSample = (value: string) => {
    if (value === "custom") {
      setSampleIndex("custom");
      setDebugOutput("");
      setDebugAlert(null);
      setDebugOpen(true);
      return;
    }
    const next = Number(value);
    const sample = samples[next];
    if (Number.isNaN(next) || !sample) {
      setSampleIndex("custom");
      setDebugInput("");
      setDebugOutput("调试结果会显示在这里。");
      setDebugAlert(null);
      setDebugOpen(true);
      return;
    }
    setSampleIndex(next);
    setDebugInput(sample.input ?? "");
    setDebugOutput("");
    setDebugAlert(null);
    setDebugOpen(true);
  };

  const submitCodeAction = async () => {
    if (submitLoading) {
      return;
    }
    setDebugOpen(true);

    if (state.judgeSettings && !state.judgeSettings.enabled) {
      setDebugAlert({
        type: "danger",
        title: "判题服务已关闭",
        detail: "管理员已暂时关闭判题功能，无法提交记录。",
        source: "submit",
      });
      return;
    }

    if (!numericProblemId) {
      setDebugAlert({ type: "danger", title: "提交失败", detail: "当前题目缺少后端题目 ID，无法提交。", source: "submit" });
      return;
    }

    const option = languageOptions.find((item) => item.label === language);
    submissionWatcherCleanupRef.current?.();
    setDebugAlert({
      type: "info",
      title: "正在提交代码",
      detail: "正在发送到后端判题队列...",
      source: "submit",
    });
    setSubmitLoading(true);

    try {
      const result = await submitCode({
        problemId: numericProblemId,
        practiceId: practiceId ? Number(practiceId) : undefined,
        contestId: contestId ? Number(contestId) : undefined,
        language: option?.apiValue ?? language.toLowerCase(),
        code,
      });

      setDebugAlert(formatSubmissionAlert(result, { showCaseDetails: !isContestMode }));
      if (result.id) {
        setLastSubmissionId(result.id);
        startSubmissionWatcher(result.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请检查后端服务。";
      setDebugAlert({
        type: "danger",
        title: "提交失败",
        detail: message,
        source: "submit",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // 如果没有题目数据，显示加载状态
  if (!problem) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600">加载题目中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={splitRootRef}
      className="fixed inset-0 grid overflow-hidden bg-slate-950"
      style={{
        gridTemplateColumns: `minmax(0, ${leftPanePercent}fr) 6px minmax(0, ${100 - leftPanePercent}fr)`,
      }}
    >
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-5 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <Tag color="blue" size="large">
              <span className="inline-flex items-center gap-1 text-base font-semibold text-blue-800">
                <IconFile style={{ fontSize: 16 }} />
                {isContestMode ? "比赛题目" : "题目"}
              </span>
            </Tag>
            <h1 className="truncate text-base font-semibold leading-7">{problem.title}</h1>
          </div>
          <Button
            theme="light"
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={() => navigate(isContestMode && contestId ? `/contests/${contestId}` : "/problems")}
          >
            {isContestMode ? "返回比赛详情" : "返回题目列表"}
          </Button>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          <article className="min-w-0 space-y-6 text-sm leading-8 text-slate-700">
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-800">题目描述</h2>
              <MarkdownMath className="pl-7" value={problem.statement || problem.summary} />
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-slate-700">输入描述：</h2>
              <div className="border-l-4 border-success bg-slate-50 px-7 py-4">
                <MarkdownMath value={problem.inputFormat || "输入数据。"} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-slate-700">输出描述：</h2>
              <div className="border-l-4 border-success bg-slate-50 px-7 py-4">
                <MarkdownMath value={problem.outputFormat || "输出答案。"} />
              </div>
            </section>

            <fieldset className="layui-elem-field bg-white">
              <legend>评测信息</legend>
              <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">运行时间</p>
                  <p className="mt-1 font-semibold">{problem.timeLimit} ms</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">运行内存</p>
                  <p className="mt-1 font-semibold">{problem.memoryLimit} MB</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">64bit IO Format</p>
                  <p className="mt-1 font-semibold">%lld</p>
                </div>
              </div>
            </fieldset>

            {samples.map((sample, index) => (
              <section key={`${sample.caseNo}-${index}`}>
                <h2 className="mb-3 text-base font-bold text-slate-700">示例{index + 1}</h2>
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  <div className="px-4 py-3 font-semibold text-slate-600">输入</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap border-l-4 border-success bg-white px-7 py-4 font-mono text-slate-700">
                    {sample.input}
                  </pre>
                  <div className="px-4 py-3 font-semibold text-slate-600">输出</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap border-l-4 border-success bg-white px-7 py-4 font-mono text-slate-700">
                    {sample.output}
                  </pre>
                  {sample.explanation ? (
                    <>
                      <div className="px-4 py-3 font-semibold text-slate-600">解释</div>
                      <div className="bg-white px-7 py-4 text-slate-700">
                        <MarkdownMath value={sample.explanation} />
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            ))}
          </article>
        </div>
      </section>

      <div
        className="z-20 cursor-col-resize bg-[#111827] hover:bg-primary"
        onMouseDown={startPaneResize}
        title="拖动调整题面和代码区域比例"
      />

      <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#20251f]">
        <div className="flex h-14 min-w-0 shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-slate-900 bg-slate-950 px-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <label className="sr-only" htmlFor="practice-language">选择提交语言</label>
            <select
              id="practice-language"
              className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus:border-success"
              value={language}
              onChange={(event) => changeLanguage(event.target.value as PracticeLanguage)}
            >
              {languageOptions.map((item) => (
                <option key={item.label} value={item.label}>{item.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <Button
                aria-label="减小文字大小"
                icon={<IconMinus />}
                size="small"
                theme="light"
                className="bg-white/10 text-white"
                onClick={() => changeFontSize(-1)}
              />
              <span className="min-w-[56px] text-center">{fontSize}px</span>
              <Button
                aria-label="增大文字大小"
                icon={<IconPlus />}
                size="small"
                theme="light"
                className="bg-white/10 text-white"
                onClick={() => changeFontSize(1)}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              theme="light"
              className="bg-white/10 text-white hover:bg-white/15"
              icon={<IconHistory />}
              onClick={() => navigate(`/problems/${problem.id}/submissions${contestId ? `?contestId=${contestId}` : ""}`)}
            >
              查看提交记录
            </Button>
            {!isContestMode && (
              <Button
                theme="light"
                className={`${agentOpen ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white/10 text-white hover:bg-white/15"} ${agentLoading ? 'opacity-70' : ''}`}
                icon={<IconBulb />}
                onClick={() => !agentLoading && setAgentOpen((open) => !open)}
              >
                {agentLoading ? "思考中..." : `AI 助手${agentQuota ? ` (${agentQuota.remaining})` : ''}`}
              </Button>
            )}
            <Button
              theme="light"
              className={`bg-white/10 text-white hover:bg-white/15 ${debugLoading ? 'opacity-70' : ''}`}
              icon={<IconCode />}
              onClick={() => !debugLoading && setDebugOpen((open) => !open)}
            >
              {debugLoading ? "调试中..." : "调试"}
            </Button>
            <Button
              type="primary"
              theme="solid"
              className={submitLoading ? 'opacity-70' : ''}
              icon={<IconSend />}
              onClick={() => !submitLoading && submitCodeAction()}
            >
              {submitLoading ? "提交中" : "提交"}
            </Button>
          </div>
        </div>

        <div
          className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#1e1e1e]"
          style={{ pointerEvents: paneResizing ? "none" : undefined }}
        >
          <div className="flex h-full min-h-0 min-w-0">
            <div className="min-h-0 min-w-0 flex-1">
              <Editor
                height="100%"
                language={monacoLanguages[language]}
                theme="qoj-vscode-dark"
                value={code}
                onChange={(value) => updateCode(value ?? "")}
                onMount={configureEditor}
                loading={<div className="grid h-full place-items-center bg-[#1e1e1e] text-slate-300">加载编辑器...</div>}
                options={{
                  automaticLayout: true,
                  bracketPairColorization: { enabled: true },
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                  fontLigatures: true,
                  fontSize,
                  formatOnPaste: true,
                  formatOnType: true,
                  glyphMargin: false,
                  lineHeight: Math.round(fontSize * 1.65),
                  lineNumbers: "on",
                  minimap: { enabled: true },
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: "all",
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  tabSize: 4,
                  wordWrap: "off",
                }}
              />
            </div>

            {agentOpen ? (
              <aside className="flex h-full w-[460px] max-w-[52%] shrink-0 flex-col border-l border-slate-800 bg-slate-950 text-slate-100">
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4">
                  <h2 className="text-sm font-semibold">AI 助手</h2>
                  <Button
                    aria-label="关闭 AI 助手"
                    icon={<IconClose />}
                    size="small"
                    theme="borderless"
                    className="text-slate-200 hover:bg-white/10"
                    onClick={() => setAgentOpen(false)}
                  />
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-800 p-3">
                  <Button
                    size="small"
                    theme="light"
                    className="min-w-0 bg-white/10 text-slate-100 hover:bg-white/15"
                    onClick={() => sendAgentMessage("请解释这道题的题意和核心思路，不要给完整代码。")}
                  >
                    解释题目
                  </Button>
                  <Button
                    size="small"
                    theme="light"
                    className="min-w-0 bg-white/10 text-slate-100 hover:bg-white/15"
                    onClick={() => sendAgentMessage("请分析我当前代码中可能的问题，不要直接给完整 AC 代码。")}
                  >
                    分析代码
                  </Button>
                  <Button
                    size="small"
                    theme="light"
                    className="min-w-0 bg-white/10 text-slate-100 hover:bg-white/15"
                    onClick={() => sendAgentMessage(`请根据下面的调试或提交信息给出排查方向：\n${latestDebugText()}`)}
                  >
                    解释报错
                  </Button>
                  <Button
                    size="small"
                    theme="light"
                    className="min-w-0 bg-white/10 text-slate-100 hover:bg-white/15"
                    onClick={() => sendAgentMessage("请提醒这道题常见边界情况和自测数据方向。")}
                  >
                    边界提醒
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {agentMessages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        "rounded-md border px-3 py-2 text-sm leading-6",
                        message.role === "user"
                          ? "ml-6 border-blue-400/30 bg-blue-500/15 text-blue-50"
                          : "mr-6 border-slate-700 bg-slate-900 text-slate-100",
                      ].join(" ")}
                    >
                      {message.role === "assistant" ? (
                        <MarkdownMath
                          className="agent-markdown"
                          value={message.content}
                          convertInlineCodeToMath
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap break-words font-sans">{message.content}</pre>
                      )}
                    </div>
                  ))}
                  {agentLoading ? (
                    <div className="mr-6 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                      正在思考...
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-slate-800 p-3">
                  <textarea
                    className="h-24 w-full resize-none rounded-md border border-slate-700 bg-slate-900 p-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
                    placeholder="输入你的问题"
                    value={agentInput}
                    onChange={(event) => setAgentInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendAgentMessage();
                      }
                    }}
                  />
                  <Button
                    block
                    loading={agentLoading}
                    disabled={agentLoading || !agentInput.trim()}
                    type="primary"
                    theme="solid"
                    icon={agentLoading ? undefined : <IconSend />}
                    className="mt-2"
                    onClick={() => sendAgentMessage()}
                  >
                    {agentLoading ? "发送中" : "发送"}
                  </Button>
                </div>
              </aside>
            ) : null}
          </div>
        </div>

        {debugOpen ? (
          <div
            className="flex shrink-0 flex-col border-t border-slate-700 bg-white"
            style={{ height: debugHeight }}
          >
            <div
              className="h-2 cursor-row-resize bg-slate-800 hover:bg-primary"
              onMouseDown={startDebugResize}
            />
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
                <h2 className="font-semibold text-slate-800">调试面板</h2>
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary"
                    value={sampleSelectValue}
                    onChange={(event) => selectSample(event.target.value)}
                  >
                    {samples.length ? (
                      <>
                        <option value="custom">自定义输入</option>
                        {samples.map((_, index) => (
                          <option key={index} value={index}>样例 {index + 1}</option>
                        ))}
                      </>
                    ) : (
                      <option value="custom">无样例</option>
                    )}
                  </select>
                  <Button
                    loading={debugLoading}
                    disabled={debugLoading}
                    type="primary"
                    theme="solid"
                    size="small"
                    onClick={runDebug}
                  >
                    {debugLoading ? "调试中" : "运行调试"}
                  </Button>
                  <Button
                    aria-label="关闭调试面板"
                    icon={<IconClose />}
                    size="small"
                    theme="light"
                    onClick={() => setDebugOpen(false)}
                  />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
                {showDebugFields ? (
                  <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="flex min-h-0 flex-col gap-2 text-sm font-medium text-slate-700">
                      输入
                      <textarea
                        className="min-h-0 flex-1 resize-none rounded-md border border-slate-200 bg-white p-3 font-mono text-sm leading-6 outline-none focus:border-success"
                        placeholder="在这里输入自定义数据，支持换行"
                        value={debugInput}
                        onChange={(event) => {
                          setDebugInput(event.target.value);
                          setSampleIndex("custom");
                          setDebugOutput("");
                          setDebugAlert(null);
                        }}
                      />
                    </label>
                    <label className="flex min-h-0 flex-col gap-2 text-sm font-medium text-slate-700">
                      输出
                      <textarea
                        readOnly
                        className="min-h-0 flex-1 resize-none rounded-md border border-slate-200 bg-white p-3 font-mono text-sm leading-6 outline-none focus:border-success"
                        placeholder="运行结果会显示在这里"
                        value={debugOutput}
                      />
                    </label>
                  </div>
                ) : null}
                {debugAlert ? (
                  <div
                    className={[
                      "shrink-0 rounded-md border px-4 py-3 text-sm",
                      debugAlert.type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : debugAlert.type === "danger"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : debugAlert.type === "info"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <p className="font-semibold">{debugAlert.title}</p>
                    {debugAlert.detail ? (
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5">{debugAlert.detail}</pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
