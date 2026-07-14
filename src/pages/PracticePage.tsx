/**
 * 练习页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import Editor, { type OnMount } from "@monaco-editor/react";
import "../utils/monacoSetup";
import { Alert, Button, ConfigProvider, Input, Select, theme as antTheme } from "antd";
import { Tag } from "@douyinfe/semi-ui";
import { IconBulb, IconClose, IconCode, IconFile, IconMinus, IconPlus, IconSend } from "@douyinfe/semi-icons";
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

/**
 * 练习Language类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type PracticeLanguage = "C" | "C++" | "Python" | "Java";

/**
 * DebugAlert类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type DebugAlert = {
  type: "success" | "danger" | "neutral" | "info";
  title: string;
  detail?: string;
  source?: "debug" | "submit";
};

/**
 * EditorMarker类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type EditorMarker = {
  message: string;
  severity: number;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

/**
 * 提交结果类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type SubmissionResult = Partial<Pick<
  SubmissionRecord,
  "id" | "language" | "status" | "timeUsed" | "memoryUsed" | "passedCaseCount" | "totalCaseCount" | "cases"
>>;

/**
 * Agent消息类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
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

/**
 * 封装backend题目标识相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function backendProblemId(problemId: string): number | null {
  const prefix = problemId.startsWith("cp") ? "cp" : problemId.startsWith("p") ? "p" : "";
  const encoded = problemId.slice(prefix.length);
  if (!encoded || !/^\d{8}$/.test(encoded)) return null;
  return decryptIdFromUrl(encoded);
}

/**
 * 封装current编码OwnerKey相关逻辑。会读写浏览器本地会话信息。
 */
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

/**
 * 封装编码StorageKey相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function codeStorageKey(problemId: string, language: PracticeLanguage) {
  return `qoj.code.user.${currentCodeOwnerKey()}.${problemId}.${language}`;
}

/**
 * 封装clampHeight相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function clampHeight(value: number) {
  return Math.min(Math.max(value, 180), Math.floor(window.innerHeight * 0.68));
}

/**
 * 构造或转换AntAlert类型。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function toAntAlertType(type: DebugAlert["type"]): "success" | "info" | "warning" | "error" {
  if (type === "danger") {
    return "error";
  }
  if (type === "neutral") {
    return "info";
  }
  return type;
}

/**
 * 封装clampSplit相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function clampSplit(value: number) {
  return Math.min(Math.max(value, 18), 82);
}

/**
 * 封装clampFontSize相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function clampFontSize(value: number) {
  return Math.min(Math.max(value, 12), 28);
}

/**
 * 解析并规范化Output。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
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

/**
 * 判断Running提交状态是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function isRunningSubmissionStatus(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  return ["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(normalized);
}

/**
 * 判断Final提交状态是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function isFinalSubmissionStatus(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  return Boolean(normalized) && !isRunningSubmissionStatus(normalized);
}

/**
 * 封装max提交测试点Metric相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function maxSubmissionCaseMetric(
  cases: SubmissionResult["cases"],
  field: "timeMs" | "memoryKb",
) {
  const values = (cases ?? [])
    .map((item) => item[field])
    .filter((value): value is number => typeof value === "number" && value > 0);
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * 封装positiveMetric相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function positiveMetric(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? value : null;
}

/**
 * 格式化Metric。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatMetric(value: number | null | undefined, unit: string) {
  const metric = positiveMetric(value);
  return metric == null ? "-" : `${metric} ${unit}`;
}

/**
 * 格式化提交Alert。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatSubmissionAlert(data: SubmissionResult): DebugAlert {
  const status = String(data.status ?? "PENDING").toUpperCase();
  const statusLabel = submissionStatusLabels[status] ?? status;
  const timeUsed = positiveMetric(data.timeUsed) ?? maxSubmissionCaseMetric(data.cases, "timeMs");
  const memoryUsed = positiveMetric(data.memoryUsed) ?? maxSubmissionCaseMetric(data.cases, "memoryKb");
  const running = isRunningSubmissionStatus(status);
  const detail = running
    ? ""
    : `运行时间：${formatMetric(timeUsed, "ms")} | 运行内存：${formatMetric(memoryUsed, "KB")}`;

  return {
    type: status === "AC" || status === "ACCEPTED" ? "success" : running ? "info" : "danger",
    title: `提交结果：${statusLabel}`,
    detail,
    source: "submit",
  };
}

/**
 * 渲染练习页面，并协调其数据加载、状态和交互。
 */
export function PracticePage() {
  const splitRootRef = useRef<HTMLDivElement | null>(null);
  const submissionWatcherCleanupRef = useRef<(() => void) | null>(null);
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const navigate = useNavigate();
  const { problemId } = useParams();
  const [searchParams] = useSearchParams();
  const { state } = useOjData();
  const [remoteProblem, setRemoteProblem] = useState<Problem | null>(null);
  /**
   * 封装numeric题目标识相关逻辑。对原始数据进行派生或聚合。
   */
  const numericProblemId = useMemo(() => (problemId ? backendProblemId(problemId) : null), [problemId]);
  /**
   * 判断Local题目是否成立。对原始数据进行派生或聚合。
   */
  const hasLocalProblem = useMemo(
    () => Boolean(problemId && state.problems.some((item) => item.id === problemId)),
    [problemId, state.problems],
  );
  /**
   * 封装题目相关逻辑。对原始数据进行派生或聚合。
   */
  const problem = useMemo(() => {
    if (!problemId) {
      return null;
    }
    return state.problems.find((item) => item.id === problemId) ?? (remoteProblem?.id === problemId ? remoteProblem : null);
  }, [problemId, remoteProblem, state.problems]);
  const [language, setLanguage] = useState<PracticeLanguage>("C++");
  const languageRef = useRef<PracticeLanguage>(language);
  languageRef.current = language;
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
  const [editorTheme, setEditorTheme] = useState<"light" | "dark">("light");
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
  const sampleSelectOptions = samples.length
    ? [
        { label: "自定义输入", value: "custom" },
        ...samples.map((_, index) => ({ label: `样例 ${index + 1}`, value: String(index) })),
      ]
    : [{ label: "无样例", value: "custom" }];
  const showDebugFields = debugAlert?.source !== "submit";
  const isEditorDark = editorTheme === "dark";
  const monacoThemeName = isEditorDark ? "qoj-vscode-dark" : "qoj-vscode-light";
  const debugTextareaClassName = "min-h-0 flex-1 font-mono text-sm leading-6";

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

  useEffect(() => {
    const timer = setTimeout(() => runCustomSyntaxCheck(), 50);
    return () => clearTimeout(timer);
  }, [language]);

  /**
   * 封装changeLanguage相关逻辑。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
   */
  const changeLanguage = (next: PracticeLanguage) => {
    if (problem?.id) {
      window.localStorage.setItem(codeStorageKey(problem.id, language), code);
    }
    setLanguage(next);
  };

  /**
   * 更新编码。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
   */
  const updateCode = (next: string) => {
    setCode(next);
    if (problem?.id) {
      window.localStorage.setItem(codeStorageKey(problem.id, language), next);
    }
  };

  /**
   * 封装nextAgent消息标识相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const nextAgentMessageId = (role: AgentMessage["role"]) => {
    return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  /**
   * 封装appendAgent消息相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const appendAgentMessage = (role: AgentMessage["role"], content: string) => {
    setAgentMessages((current) => [
      ...current,
      { id: nextAgentMessageId(role), role, content },
    ]);
  };

  /**
   * 封装latestDebugText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const latestDebugText = () => {
    if (!debugAlert) {
      return "暂无最新调试或提交结果。";
    }
    return [debugAlert.title, debugAlert.detail].filter(Boolean).join("\n");
  };

  /**
   * 发送Agent消息。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
   */
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

  /**
   * 封装start提交Watcher相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const startSubmissionWatcher = (submissionId: number) => {
    submissionWatcherCleanupRef.current?.();

    let stopped = false;
    let unsubscribe: (() => void) | null = null;
    let pollTimer: number | null = null;

    /**
     * 封装stop相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
     */
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

    /**
     * 封装refresh提交相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
     */
    const refreshSubmission = async () => {
      if (stopped) {
        return;
      }
      try {
        const detail = await fetchSubmissionDetail(submissionId);
        if (stopped) {
          return;
        }
        setDebugAlert(formatSubmissionAlert(detail));
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
        setDebugAlert(formatSubmissionAlert({
          id: update.submissionId,
          language: undefined,
          status: update.status,
          timeUsed: update.time,
          memoryUsed: update.memory,
          passedCaseCount: undefined,
          totalCaseCount: undefined,
          cases: null,
        }));
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

  /**
   * 封装startDebugResize相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const startDebugResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = debugHeight;
    /**
     * 处理onMove。会更新 React 状态并触发重新渲染。
     */
    const onMove = (moveEvent: MouseEvent) => {
      setDebugHeight(clampHeight(startHeight + startY - moveEvent.clientY));
    };
    /**
     * 处理onUp。保持输入与返回值转换集中，避免调用处重复实现同一规则。
     */
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /**
   * 封装startPaneResize相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const startPaneResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setPaneResizing(true);
    /**
     * 处理onMove。会更新 React 状态并触发重新渲染。
     */
    const onMove = (moveEvent: MouseEvent) => {
      const rect = splitRootRef.current?.getBoundingClientRect();
      if (!rect?.width) {
        return;
      }
      setLeftPanePercent(clampSplit(((moveEvent.clientX - rect.left) / rect.width) * 100));
    };
    /**
     * 处理onUp。会更新 React 状态并触发重新渲染。
     */
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

  /**
   * 封装changeFontSize相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const changeFontSize = (delta: number) => {
    setFontSize((current) => clampFontSize(current + delta));
  };

  /**
   * 封装runCustomSyntaxCheck相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const runCustomSyntaxCheck = () => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    const markers: EditorMarker[] = [];
    try {
    const src = model.getValue();
    const lang = monacoLanguages[languageRef.current];
    const isSemicolonLang = lang === "c" || lang === "cpp" || lang === "java";

    /* ── strip comments and strings to avoid false positives ── */
    const stripped: string[] = [];
    let inLineComment = false;
    let inBlockComment = false;
    let inString = false;
    let inChar = false;
    let stringQuote = "";
    let isTripleQuoted = false;
    let blockCommentStartLine = -1;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const next = src[i + 1] ?? "";
      const afterNext = src[i + 2] ?? "";

      if (inLineComment) {
        if (ch === "\n") { inLineComment = false; stripped.push(ch); }
        continue;
      }
      if (inBlockComment) {
        if (ch === "*" && next === "/") { inBlockComment = false; i++; continue; }
        if (ch === "\n") stripped.push(ch);
        continue;
      }
      if (inString) {
        if (ch === "\\") { i++; continue; }
        if (isTripleQuoted) {
          if (ch === stringQuote && next === stringQuote && afterNext === stringQuote) {
            inString = false;
            isTripleQuoted = false;
            stripped.push('"');
            i += 2;
            continue;
          }
          if (ch === "\n") { stripped.push(ch); continue; }
          continue;
        }
        if (ch === stringQuote) { inString = false; stripped.push('"'); continue; }
        if (ch === "\n") { inString = false; stripped.push(ch); }
        continue;
      }
      if (inChar) {
        if (ch === "\\") { i++; continue; }
        if (ch === "'") { inChar = false; stripped.push("'"); continue; }
        if (ch === "\n") { inChar = false; stripped.push(ch); }
        continue;
      }

      if ((ch === "/" && next === "/") || (ch === "#" && lang === "python")) {
        inLineComment = true;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        blockCommentStartLine = src.slice(0, i).split("\n").length;
        i++;
        continue;
      }
      if (ch === '"') {
        inString = true;
        stringQuote = '"';
        isTripleQuoted = lang === "python" && next === '"' && afterNext === '"';
        stripped.push('"');
        if (isTripleQuoted) i += 2;
        continue;
      }
      if (ch === "'" && lang !== "python") {
        inChar = true;
        stripped.push("'");
        continue;
      }
      if (ch === "'" && lang === "python") {
        inString = true;
        stringQuote = "'";
        isTripleQuoted = next === "'" && afterNext === "'";
        stripped.push('"');
        if (isTripleQuoted) i += 2;
        continue;
      }

      stripped.push(ch);
    }

    const clean = stripped.join("");
    const lines = clean.split("\n");

    /* ── 1. bracket matching ── */
    const bracketPairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    const stack: Array<{ char: string; line: number; col: number }> = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === "(" || ch === "[" || ch === "{") {
          stack.push({ char: ch, line: lineIdx + 1, col: col + 1 });
        } else if (ch === ")" || ch === "]" || ch === "}") {
          const top = stack.pop();
          if (!top) {
            markers.push({
              message: `多余的闭合括号 "${ch}"，没有对应的开括号`,
              severity: 8,
              startLineNumber: lineIdx + 1,
              startColumn: col + 1,
              endLineNumber: lineIdx + 1,
              endColumn: col + 2,
            });
          } else if (top.char !== bracketPairs[ch]) {
            markers.push({
              message: `括号不匹配: "${top.char}" 与 "${ch}" 不配对`,
              severity: 8,
              startLineNumber: lineIdx + 1,
              startColumn: col + 1,
              endLineNumber: lineIdx + 1,
              endColumn: col + 2,
            });
          }
        }
      }
    }
    for (const item of stack) {
      markers.push({
        message: `未闭合的 "${item.char}"，缺少对应的闭合括号`,
        severity: 8,
        startLineNumber: item.line,
        startColumn: item.col,
        endLineNumber: item.line,
        endColumn: item.col + 1,
      });
    }

    /* ── 2. unclosed strings (track string + char state, skip comments) ── */
    {
      let inLC = false;
      let inBC = false;
      let inStr = false;
      let inChr = false;
      let strStartLine = 0;
      let strStartCol = 0;
      let strQuote = '"';
      let isTriple = false;
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        const next = src[i + 1] ?? "";
        const afterNext = src[i + 2] ?? "";
        if (inStr) {
          if (ch === "\\") { i++; continue; }
          if (isTriple) {
            if (ch === strQuote && next === strQuote && afterNext === strQuote) {
              inStr = false;
              isTriple = false;
              i += 2;
              continue;
            }
            if (ch === "\n") continue;
            continue;
          }
          if (ch === strQuote) { inStr = false; continue; }
          if (ch === "\n") {
            markers.push({
              message: "字符串未闭合，缺少结束引号 \"",
              severity: 8,
              startLineNumber: strStartLine,
              startColumn: strStartCol,
              endLineNumber: strStartLine,
              endColumn: strStartCol + 1,
            });
            inStr = false;
          }
          continue;
        }
        if (inChr) {
          if (ch === "\\") { i++; continue; }
          if (ch === "'") { inChr = false; continue; }
          if (ch === "\n") { inChr = false; }
          continue;
        }
        if (inLC) {
          if (ch === "\n") inLC = false;
          continue;
        }
        if (inBC) {
          if (ch === "*" && next === "/") { inBC = false; i++; }
          continue;
        }
        if ((ch === "/" && next === "/") || (ch === "#" && lang === "python")) { inLC = true; continue; }
        if (ch === "/" && next === "*") { inBC = true; i++; continue; }
        if (ch === "'" && lang !== "python") { inChr = true; continue; }
        if (ch === '"' || (ch === "'" && lang === "python")) {
          strQuote = ch;
          isTriple = next === ch && afterNext === ch;
          inStr = true;
          strStartLine = src.slice(0, i).split("\n").length;
          strStartCol = i - src.lastIndexOf("\n", i);
          if (isTriple) i += 2;
        }
      }
      if (inStr && !isTriple) {
        markers.push({
          message: "字符串未闭合，缺少结束引号 \"",
          severity: 8,
          startLineNumber: strStartLine,
          startColumn: strStartCol,
          endLineNumber: strStartLine,
          endColumn: strStartCol + 1,
        });
      }
    }

    /* ── 3. missing semicolons (C/C++/Java only) ── */
    if (isSemicolonLang) {
      const stmtKeywords = /\b(return|break|continue|int|long|short|double|float|char|bool|void|unsigned|auto|const|static|new|delete|throw)\b/;
      const continuationEnd = /[+\-*/%&|^<>=!?.]$/;
      const declKeywords = /\b(class|struct|enum|namespace|typedef|using|public|private|protected|import|package|template|friend|virtual|override|final)\b/;
      const controlFlow = /^\s*(if|else|for|while|switch|case|default|do|try|catch|finally)\b/;
      for (let i = 0; i < lines.length; i++) {
        const raw = src.split("\n")[i] ?? "";
        const line = lines[i].trimEnd();
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/[{};,:)([\].]$/.test(trimmed)) continue;
        if (continuationEnd.test(trimmed)) continue;
        if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
        if (controlFlow.test(trimmed)) continue;
        if (declKeywords.test(trimmed)) continue;
        if (stmtKeywords.test(trimmed) && !trimmed.includes(";") && !trimmed.includes("{") && !trimmed.includes("}")) {
          markers.push({
            message: "可能缺少分号 ;",
            severity: 4,
            startLineNumber: i + 1,
            startColumn: raw.trimEnd().length || 1,
            endLineNumber: i + 1,
            endColumn: (raw.trimEnd().length || 1) + 1,
          });
        }
      }
    }

    /* ── 4. unclosed block comments (from stripping loop state) ── */
    if (inBlockComment && blockCommentStartLine !== -1) {
      markers.push({
        message: "块注释未闭合，缺少 */",
        severity: 8,
        startLineNumber: blockCommentStartLine,
        startColumn: 1,
        endLineNumber: blockCommentStartLine,
        endColumn: 3,
      });
    }
    } catch {
      /* if check throws, markers stays empty → clears all existing markers */
    }

    /* ── set markers on model ── */
    const monacoMarkers = markers.map(m => ({
      message: m.message,
      severity: m.severity as 1 | 2 | 4 | 8,
      startLineNumber: m.startLineNumber,
      startColumn: m.startColumn,
      endLineNumber: m.endLineNumber,
      endColumn: m.endColumn,
      source: "syntax-check",
    }));
    monaco.editor.setModelMarkers(model, "custom-syntax", monacoMarkers);
  };

  /**
   * 封装configureEditor相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const configureEditor: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    monaco.editor.defineTheme("qoj-vscode-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "008000" },
        { token: "keyword", foreground: "0000FF" },
        { token: "number", foreground: "098658" },
        { token: "string", foreground: "A31515" },
        { token: "type", foreground: "267F99" },
      ],
      colors: {
        "editor.background": "#FFFFFF",
        "editor.foreground": "#1F2937",
        "editorLineNumber.foreground": "#9CA3AF",
        "editorLineNumber.activeForeground": "#374151",
        "editorCursor.foreground": "#111827",
        "editor.selectionBackground": "#ADD6FF",
        "editor.inactiveSelectionBackground": "#E5EBF1",
        "editorIndentGuide.background1": "#E5E7EB",
        "editorIndentGuide.activeBackground1": "#CBD5E1",
        "editor.lineHighlightBackground": "#F8FAFC",
      },
    });

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
    monaco.editor.setTheme(monacoThemeName);

    editor.onDidChangeModelContent(() => {
      runCustomSyntaxCheck();
    });

    runCustomSyntaxCheck();
    editor.focus();
  };

  useEffect(() => {
    monacoRef.current?.editor.setTheme(monacoThemeName);
  }, [monacoThemeName]);

  /**
   * 封装runDebug相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
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
    if (state.judgeSettings && !state.judgeSettings.enableSandbox) {
      setDebugOpen(true);
      setDebugAlert({
        type: "danger",
        title: "调试功能已关闭",
        detail: "管理员已暂时关闭代码调试功能。",
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

  /**
   * 封装selectSample相关逻辑。会更新 React 状态并触发重新渲染。
   */
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

  /**
   * 创建或提交编码Action。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
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

      setDebugAlert(formatSubmissionAlert(result));
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
      className="fixed inset-0 grid overflow-hidden bg-slate-100"
      style={{
        gridTemplateColumns: `minmax(0, ${leftPanePercent}fr) 6px minmax(0, ${100 - leftPanePercent}fr)`,
      }}
    >
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 text-slate-800">
          <div className="flex min-w-0 items-center gap-2">
            <Tag color="blue" size="large">
              <span className="inline-flex items-center gap-1 text-base font-semibold text-blue-800">
                <IconFile style={{ fontSize: 16 }} />
                {isContestMode ? "比赛题目" : "题目"}
              </span>
            </Tag>
            <h1 className="truncate text-base font-semibold leading-7">{problem.title}</h1>
          </div>
          {isContestMode && contestId && (
            <Button
              className="!bg-slate-100 !text-slate-700 hover:!bg-slate-200"
              onClick={() => navigate(`/contests/${contestId}`)}
            >
              返回比赛详情
            </Button>
          )}
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
              <section key={`${sample.caseNo}-${index}`} className="mt-6">
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
        className="z-20 cursor-col-resize bg-slate-200 hover:bg-primary"
        onMouseDown={startPaneResize}
        title="拖动调整题面和代码区域比例"
      />

      <section className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden ${editorTheme === "dark" ? "bg-[#20251f]" : "bg-white"}`}>
        <div className="flex h-14 min-w-0 shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-slate-200 bg-white px-4 text-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <label className="sr-only" htmlFor="practice-language">选择提交语言</label>
            <select
              id="practice-language"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-success"
              value={language}
              onChange={(event) => changeLanguage(event.target.value as PracticeLanguage)}
            >
              {languageOptions.map((item) => (
                <option key={item.label} value={item.label}>{item.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Button
                aria-label="减小文字大小"
                icon={<IconMinus />}
                size="small"
                className="!bg-slate-100 !text-slate-700 hover:!bg-slate-200"
                onClick={() => changeFontSize(-1)}
              />
              <span className="min-w-[56px] text-center">{fontSize}px</span>
              <Button
                aria-label="增大文字大小"
                icon={<IconPlus />}
                size="small"
                className="!bg-slate-100 !text-slate-700 hover:!bg-slate-200"
                onClick={() => changeFontSize(1)}
              />
              <Button
                className={editorTheme === "dark" ? "!bg-slate-800 !text-white hover:!bg-slate-700" : "!bg-slate-100 !text-slate-700 hover:!bg-slate-200"}
                onClick={() => setEditorTheme((theme) => (theme === "dark" ? "light" : "dark"))}
              >
                {editorTheme === "dark" ? "白色背景" : "黑色背景"}
              </Button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!isContestMode && (
              <Button
                className={`${agentOpen ? "!bg-blue-500 !text-white hover:!bg-blue-600" : "!bg-slate-100 !text-slate-700 hover:!bg-slate-200"} ${agentLoading ? 'opacity-70' : ''}`}
                icon={<IconBulb />}
                onClick={() => !agentLoading && setAgentOpen((open) => !open)}
              >
                {agentLoading ? "思考中..." : `AI 助手${agentQuota ? ` (${agentQuota.remaining})` : ''}`}
              </Button>
            )}
            <Button
              className={`!bg-slate-100 !text-slate-700 hover:!bg-slate-200 ${debugLoading ? 'opacity-70' : ''}`}
              icon={<IconCode />}
              onClick={() => !debugLoading && setDebugOpen((open) => !open)}
            >
              {debugLoading ? "调试中..." : "调试"}
            </Button>
            <Button
              type="primary"
              className={submitLoading ? 'opacity-70' : ''}
              icon={<IconSend />}
              onClick={() => !submitLoading && submitCodeAction()}
            >
              {submitLoading ? "提交中" : "提交"}
            </Button>
          </div>
        </div>

        <div
          className={`min-h-0 min-w-0 flex-1 overflow-hidden ${editorTheme === "dark" ? "bg-[#1e1e1e]" : "bg-white"}`}
          style={{ pointerEvents: paneResizing ? "none" : undefined }}
        >
          <div className="flex h-full min-h-0 min-w-0">
            <div className="min-h-0 min-w-0 flex-1">
              <Editor
                height="100%"
                language={monacoLanguages[language]}
                theme={monacoThemeName}
                value={code}
                onChange={(value) => updateCode(value ?? "")}
                onMount={configureEditor}
                loading={(
                  <div className={`grid h-full place-items-center ${editorTheme === "dark" ? "bg-[#1e1e1e] text-slate-300" : "bg-white text-slate-500"}`}>
                    加载编辑器...
                  </div>
                )}
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
                  lineNumbersMinChars: 3,
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
              <aside className={`flex h-full w-[460px] max-w-[52%] shrink-0 flex-col border-l ${isEditorDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-800"}`}>
                <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 ${isEditorDark ? "border-slate-800" : "border-slate-200"}`}>
                  <h2 className="text-sm font-semibold">AI 助手</h2>
                  <Button
                    aria-label="关闭 AI 助手"
                    icon={<IconClose />}
                    size="small"
                    type="text"
                    className={isEditorDark ? "!text-slate-200 hover:!bg-white/10" : "!text-slate-600 hover:!bg-slate-100"}
                    onClick={() => setAgentOpen(false)}
                  />
                </div>

                <div className={`grid shrink-0 grid-cols-2 gap-2 border-b p-3 ${isEditorDark ? "border-slate-800" : "border-slate-200"}`}>
                  <Button
                    size="small"
                    className={`min-w-0 ${isEditorDark ? "!bg-white/10 !text-slate-100 hover:!bg-white/15" : "!bg-slate-100 !text-slate-700 hover:!bg-slate-200"}`}
                    onClick={() => sendAgentMessage("请解释这道题的题意和核心思路，不要给完整代码。")}
                  >
                    解释题目
                  </Button>
                  <Button
                    size="small"
                    className={`min-w-0 ${isEditorDark ? "!bg-white/10 !text-slate-100 hover:!bg-white/15" : "!bg-slate-100 !text-slate-700 hover:!bg-slate-200"}`}
                    onClick={() => sendAgentMessage("请分析我当前代码中可能的问题，不要直接给完整 AC 代码。")}
                  >
                    分析代码
                  </Button>
                  <Button
                    size="small"
                    className={`min-w-0 ${isEditorDark ? "!bg-white/10 !text-slate-100 hover:!bg-white/15" : "!bg-slate-100 !text-slate-700 hover:!bg-slate-200"}`}
                    onClick={() => sendAgentMessage(`请根据下面的调试或提交信息给出排查方向：\n${latestDebugText()}`)}
                  >
                    解释报错
                  </Button>
                  <Button
                    size="small"
                    className={`min-w-0 ${isEditorDark ? "!bg-white/10 !text-slate-100 hover:!bg-white/15" : "!bg-slate-100 !text-slate-700 hover:!bg-slate-200"}`}
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
                          ? isEditorDark
                            ? "ml-6 border-blue-400/30 bg-blue-500/15 text-blue-50"
                            : "ml-6 border-blue-200 bg-blue-50 text-blue-900"
                          : isEditorDark
                            ? "mr-6 border-slate-700 bg-slate-900 text-slate-100"
                            : "mr-6 border-slate-200 bg-slate-50 text-slate-800",
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
                    <div className={`mr-6 rounded-md border px-3 py-2 text-sm ${isEditorDark ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      正在思考...
                    </div>
                  ) : null}
                </div>

                <div className={`shrink-0 border-t p-3 ${isEditorDark ? "border-slate-800" : "border-slate-200"}`}>
                  <Input.TextArea
                    className={`h-24 w-full resize-none text-sm leading-6 ${isEditorDark ? "!border-slate-700 !bg-slate-900 !text-slate-100 placeholder:!text-slate-500" : "!border-slate-200 !bg-white !text-slate-800 placeholder:!text-slate-400"}`}
                    placeholder="输入你的问题"
                    value={agentInput}
                    autoSize={false}
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
          <ConfigProvider
            theme={{
              algorithm: antTheme.defaultAlgorithm,
            }}
          >
            <div
              className="flex shrink-0 flex-col border-t border-slate-200 bg-white text-slate-800"
              style={{ height: debugHeight }}
            >
              <div
                className="h-2 cursor-row-resize bg-slate-200 hover:bg-blue-500"
                onMouseDown={startDebugResize}
              />
              <div className="flex min-h-0 w-full flex-1 flex-col">
                <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
                  <h2 className="font-semibold">调试面板</h2>
                  <div className="flex items-center gap-2">
                    <Select
                      size="small"
                      value={sampleSelectValue}
                      options={sampleSelectOptions}
                      style={{ width: 144 }}
                      onChange={selectSample}
                    />
                    <Button
                      loading={debugLoading}
                      disabled={debugLoading}
                      type="primary"
                      size="small"
                      onClick={runDebug}
                    >
                      {debugLoading ? "调试中" : "运行调试"}
                    </Button>
                    <Button
                      aria-label="关闭调试面板"
                      icon={<IconClose />}
                      size="small"
                      type="text"
                      className="!text-slate-600 hover:!bg-slate-100"
                      onClick={() => setDebugOpen(false)}
                    />
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
                  {showDebugFields ? (
                    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="flex min-h-0 flex-col gap-2 text-sm font-medium text-slate-700">
                        输入
                        <Input.TextArea
                          className={debugTextareaClassName}
                          placeholder="在这里输入自定义数据，支持换行"
                          value={debugInput}
                          autoSize={false}
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
                        <Input.TextArea
                          readOnly
                          className={debugTextareaClassName}
                          placeholder="运行结果会显示在这里"
                          value={debugOutput}
                          autoSize={false}
                        />
                      </label>
                    </div>
                  ) : null}
                  {debugAlert ? (
                    <Alert
                      className="shrink-0"
                      type={toAntAlertType(debugAlert.type)}
                      message={debugAlert.title}
                      description={debugAlert.detail ? (
                        <pre className="m-0 whitespace-pre-wrap font-mono text-xs leading-5">{debugAlert.detail}</pre>
                      ) : undefined}
                      showIcon
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </ConfigProvider>
        ) : null}
      </section>
    </div>
  );
}
