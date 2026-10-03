import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Input, Modal, Spin, Typography } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconRobot, IconSend } from '@arco-design/web-react/icon';
import { adminDelete, adminGet, adminPost, adminPostStream, adminPut } from '../../api/adminClient';
import './AdminAiChatPage.css';
import { CHAT_FILE_ACCEPT, ChatFileCard, ChatImageThumbnail, DraftChatImages, useChatAttachments, type ChatFileData, type ChatImageData } from './AdminChatImages';
import { AdminChatFilePreview, type FilePreviewSource, type ImportSource } from './AdminChatFiles';
import { AdminChatImportModal, type ApprovedImport, type ImportResult } from './AdminChatImportModal';

const HISTORY_KEY = 'qoj.admin.ai-chat-history.v1';
const HISTORY_API = '/api/admin/v1/agent/chat/sessions';
const TextArea = Input.TextArea;
const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="admin-ai-chat__table-scroll" role="region" aria-label="聊天表格" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: number;
  completedAt?: number;
  durationMs?: number;
  generationStatus?: 'complete' | 'stopped' | 'error';
  timingEstimate?: boolean;
  continuationToken?: string;
  images?: ChatImageData[];
  files?: ChatFileData[];
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  version?: number;
  messages?: ChatMessage[];
  titleSource?: 'pending' | 'ai' | 'manual' | 'legacy';
  titleRevision?: number;
};

const suggestions = [
  '帮我梳理一次比赛发布前的检查清单',
  '如何排查判题任务一直停在队列里的问题？',
  '解释一下这个项目的管理员权限模型',
];

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadHistory(): ChatSession[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const validSessions = raw.filter((item): item is ChatSession => (
      item && typeof item.id === 'string' && typeof item.title === 'string' &&
      Array.isArray(item.messages) && typeof item.updatedAt === 'number'
    )).slice(0, 100);
    return validSessions.map((session) => {
      const messages = session.messages || [];
      const [userMessage, assistantMessage] = messages;
      const isSingleLegacyExchange = messages.length === 2 &&
        userMessage?.role === 'user' && assistantMessage?.role === 'assistant' &&
        assistantMessage.content.trim().length > 0 && assistantMessage.completedAt == null &&
        typeof session.createdAt === 'number';
      if (!isSingleLegacyExchange) return session;

      const durationMs = Math.max(0, session.updatedAt - session.createdAt);
      return {
        ...session,
        messages: [
          { ...userMessage, createdAt: userMessage.createdAt ?? session.createdAt },
          {
            ...assistantMessage,
            createdAt: assistantMessage.createdAt ?? session.createdAt,
            completedAt: session.updatedAt,
            durationMs,
            generationStatus: 'complete',
            timingEstimate: true,
          },
        ],
      };
    });
  } catch {
    return [];
  }
}

const pendingTitle = '未命名的对话';

function formatGroup(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return '今天';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return '更早';
}

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} 毫秒`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return remainingSeconds ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分钟`;
}

/** 会话和消息由后端持久化；仅在首次加载时迁移旧浏览器记录。 */
export function AdminAiChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [messageLoadAttempt, setMessageLoadAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const composingRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [error, setError] = useState('');
  const imageManager = useChatAttachments(setError);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null);
  const openImage = (src: string, name: string) => setImagePreview({ src, name });
  const [filePreview, setFilePreview] = useState<FilePreviewSource | null>(null);
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const openImport = (source: ImportSource) => { setFilePreview(null); setImportSource(source); };
  const imagesReady = imageManager.attachments.every((item) => item.status === 'ready');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [generatingTitleIds, setGeneratingTitleIds] = useState<Set<string>>(new Set());
  const [textareaMaxHeight, setTextareaMaxHeight] = useState(() => Math.floor((window.innerHeight - 82) / 2));
  const abortRef = useRef<AbortController | null>(null);
  const stopPromiseRef = useRef<Promise<ChatSession> | null>(null);
  const [stopFailure, setStopFailure] = useState<{ sessionId: string; messageId: string } | null>(null);
  const generatingMessageRef = useRef<{ sessionId: string; messageId: string } | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const chatCardRef = useRef<HTMLElement>(null);
  const sessionsRef = useRef<ChatSession[]>([]);
  const loadPromiseRef = useRef<Promise<ChatSession[]> | null>(null);
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const deletedIdsRef = useRef(new Set<string>());
  const titleRequestsRef = useRef(new Set<string>());
  const renameIdRef = useRef<string | null>(null);

  const changeSessions = (update: (current: ChatSession[]) => ChatSession[]) => {
    const next = update(sessionsRef.current);
    sessionsRef.current = next;
    setSessions(next);
  };

  const replaceSession = (session: ChatSession) => {
    changeSessions((current) => current.map((item) => item.id !== session.id ? item
      : (item.titleRevision ?? 0) > (session.titleRevision ?? 0)
        ? { ...session, title: item.title, titleSource: item.titleSource, titleRevision: item.titleRevision }
        : session));
  };

  const applyTitle = (session: ChatSession) => {
    if (deletedIdsRef.current.has(session.id)) return;
    changeSessions((current) => current.map((item) => item.id === session.id && (item.titleRevision ?? 0) <= (session.titleRevision ?? 0)
      ? { ...item, title: session.title, titleSource: session.titleSource, titleRevision: session.titleRevision }
      : item));
  };

  const enqueueWrite = <T,>(write: () => Promise<T>) => {
    const result = writeQueueRef.current.then(write);
    writeQueueRef.current = result.catch(() => undefined);
    return result;
  };

  const activeSession = sessions.find((session) => session.id === activeId);
  const groupedSessions = useMemo(() => {
    const groups: Record<string, ChatSession[]> = { 今天: [], 昨天: [], 更早: [] };
    [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).forEach((session) => {
      groups[formatGroup(session.updatedAt)].push(session);
    });
    return groups;
  }, [sessions]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError('');
    if (!loadPromiseRef.current) {
      loadPromiseRef.current = (async () => {
        // Imports are create-only, so a retry cannot overwrite a newer server conversation.
        const legacy = loadHistory();
        for (const session of legacy) {
          await adminPut<ChatSession>(`${HISTORY_API}/${encodeURIComponent(session.id)}`, {
            ...session, createdAt: session.createdAt ?? session.updatedAt, version: undefined,
          });
        }
        if (legacy.length) window.localStorage.removeItem(HISTORY_KEY);
        return adminGet<ChatSession[]>(HISTORY_API);
      })();
    }
    void loadPromiseRef.current.then((history) => {
      if (cancelled) return;
      changeSessions(() => history);
      setActiveId(history[0]?.id || null);
    }).catch((requestError: unknown) => {
      if (!cancelled) setHistoryError(requestError instanceof Error ? requestError.message : '聊天历史加载失败');
    }).finally(() => {
      if (!cancelled) setLoadingHistory(false);
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    if (!activeId || sessionsRef.current.find((session) => session.id === activeId)?.messages) {
      setLoadingMessages(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingMessages(true);
    void adminGet<ChatSession>(`${HISTORY_API}/${encodeURIComponent(activeId)}`).then((session) => {
      if (!cancelled) replaceSession(session);
    }).catch((requestError: unknown) => {
      if (!cancelled) setError(requestError instanceof Error ? requestError.message : '聊天记录加载失败');
    }).finally(() => {
      if (!cancelled) setLoadingMessages(false);
    });
    return () => { cancelled = true; };
  }, [activeId, loadAttempt, messageLoadAttempt]);

  useEffect(() => {
    const card = chatCardRef.current;
    if (!card) return undefined;
    const updateLimit = () => {
      setTextareaMaxHeight(Math.max(140, Math.floor(card.clientHeight / 2)));
    };
    const observer = new ResizeObserver(updateLimit);
    observer.observe(card);
    window.addEventListener('resize', updateLimit);
    updateLimit();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLimit);
    };
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: generating ? 'smooth' : 'auto', block: 'end' });
  }, [activeSession?.messages, generating]);

  useEffect(() => {
    if (!generating) return undefined;
    setCurrentTime(Date.now());
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateMessage = (sessionId: string, messageId: string, update: (content: string) => string) => {
    changeSessions((current) => current.map((session) => session.id !== sessionId ? session : ({
      ...session,
      updatedAt: Date.now(),
      messages: session.messages?.map((message) => message.id === messageId
        ? { ...message, content: update(message.content) }
        : message),
    })));
  };

  const finishMessage = (sessionId: string, messageId: string, status: NonNullable<ChatMessage['generationStatus']>) => {
    const completedAt = Date.now();
    changeSessions((current) => current.map((session) => session.id !== sessionId ? session : ({
      ...session,
      updatedAt: completedAt,
      messages: session.messages?.map((message) => message.id === messageId
        ? {
          ...message,
          completedAt,
          durationMs: Math.max(0, completedAt - (message.createdAt ?? completedAt)),
          generationStatus: status,
          continuationToken: status === 'complete' ? undefined : message.continuationToken,
        }
        : message),
    })));
  };

  const requestBackendStop = (target: { sessionId: string; messageId: string }) => {
    // Initial history save must finish first; cancellation uses stable IDs, even before the run event arrives.
    const promise = writeQueueRef.current.then(() => adminPost<ChatSession>('/api/admin/v1/agent/chat/stop', {
      sessionId: target.sessionId, assistantMessageId: target.messageId,
      content: sessionsRef.current.find((session) => session.id === target.sessionId)?.messages?.find((message) => message.id === target.messageId)?.content,
    }));
    stopPromiseRef.current = promise;
    void promise.then((persisted) => {
      if (!deletedIdsRef.current.has(target.sessionId)) replaceSession(persisted);
      setStopFailure(null);
    }).catch((stopError: unknown) => {
      if (deletedIdsRef.current.has(target.sessionId)) return;
      setStopFailure(target);
      setError(`无法确认后台已停止：${stopError instanceof Error ? stopError.message : '停止请求失败'}，请重试停止。`);
    });
    return promise;
  };

  const stopGeneration = () => {
    const target = generatingMessageRef.current;
    // Stop the local loop immediately, including the gap between automatic continuation requests.
    abortRef.current?.abort();
    if (target) void requestBackendStop(target);
  };

  const retryStop = async () => {
    if (!stopFailure) return;
    try { await requestBackendStop(stopFailure); setError(''); }
    catch { /* requestBackendStop keeps the concrete error and retry target visible. */ }
  };

  const startNewChat = () => {
    if (abortRef.current) stopGeneration();
    setActiveId(null);
    setDraft('');
    imageManager.clear();
    setError('');
  };

  const selectChat = (id: string) => {
    if (id === activeId && activeSession?.messages) return;
    imageManager.clear();
    if (id !== activeId && abortRef.current) stopGeneration();
    setActiveId(id);
    // Load the current server version when switching back from another conversation.
    changeSessions((current) => current.map((session) => session.id === id ? { ...session, messages: undefined } : session));
    setMessageLoadAttempt((attempt) => attempt + 1);
    setError('');
  };

  const deleteChat = async (id: string) => {
    if (generatingMessageRef.current?.sessionId === id) stopGeneration();
    deletedIdsRef.current.add(id);
    try {
      await enqueueWrite(() => adminDelete(`${HISTORY_API}/${encodeURIComponent(id)}`));
      changeSessions((current) => current.filter((session) => session.id !== id));
      if (activeId === id) setActiveId(null);
      if (renameIdRef.current === id) closeRename();
    } catch (requestError) {
      deletedIdsRef.current.delete(id);
      setError(requestError instanceof Error ? requestError.message : '删除聊天失败');
    }
  };

  const closeRename = () => {
    renameIdRef.current = null;
    setRenameId(null);
    setNameError('');
  };

  const openRename = (session: ChatSession) => {
    renameIdRef.current = session.id;
    setRenameId(session.id);
    setNameDraft(session.title);
    setNameError('');
  };

  const generateName = async (id: string) => {
    if (sessionsRef.current.find((session) => session.id === id)?.titleSource !== 'pending') return;
    if (titleRequestsRef.current.has(id) || deletedIdsRef.current.has(id)) return;
    titleRequestsRef.current.add(id);
    setGeneratingTitleIds(new Set(titleRequestsRef.current));
    try {
      const session = await adminPost<ChatSession>(`${HISTORY_API}/${encodeURIComponent(id)}/title/generate`, { onlyIfPending: true }, true, 60000);
      applyTitle(session);
    } catch (requestError) {
      if (!deletedIdsRef.current.has(id)) {
        const message = `AI 命名失败：${requestError instanceof Error ? requestError.message : '请重试'}`;
        setError(message);
      }
    } finally {
      titleRequestsRef.current.delete(id);
      setGeneratingTitleIds(new Set(titleRequestsRef.current));
    }
  };

  const saveName = async () => {
    const id = renameIdRef.current;
    if (!id || savingName) return;
    const title = nameDraft.trim().replace(/\s+/g, ' ');
    const length = Array.from(title).length;
    if (length < 5 || length > 20) {
      setNameError('聊天名称必须为 5～20 个字');
      return;
    }
    setSavingName(true);
    setNameError('');
    try {
      const session = await enqueueWrite(() => adminPut<ChatSession>(`${HISTORY_API}/${encodeURIComponent(id)}/title`, { title }));
      applyTitle(session);
      if (renameIdRef.current === id) closeRename();
    } catch (requestError) {
      if (renameIdRef.current === id) setNameError(requestError instanceof Error ? requestError.message : '聊天名称保存失败');
    } finally {
      setSavingName(false);
    }
  };

  const sendMessage = async (messageText = draft, approvedImport?: ApprovedImport, resumeMessage?: ChatMessage): Promise<ImportResult | undefined> => {
    const text = messageText.trim();
    if ((!resumeMessage && ((!text && !imageManager.attachments.length) || !imagesReady)) || abortRef.current || loadingHistory || loadingMessages || historyError || stopFailure) return;
    setError('');

    const existingSession = sessionsRef.current.find((session) => session.id === activeId);
    if (existingSession && !existingSession.messages) return;
    const sessionId = existingSession?.id || createId();
    const now = Date.now();
    const sentAttachments = resumeMessage ? [] : imageManager.take();
    const images = sentAttachments.flatMap((item) => item.image ? [item.image] : []);
    const files = sentAttachments.flatMap((item) => item.document ? [item.document] : []);
    const userMessage: ChatMessage = { id: createId(), role: 'user', content: text, createdAt: now, images, files };
    const assistantMessage: ChatMessage = resumeMessage
      ? { ...resumeMessage, generationStatus: undefined, completedAt: undefined, durationMs: undefined }
      : { id: createId(), role: 'assistant', content: '', createdAt: now };
    const nextMessages = resumeMessage
      ? (existingSession?.messages || []).map((item) => item.id === resumeMessage.id ? assistantMessage : item)
      : [...(existingSession?.messages || []), userMessage, assistantMessage];
    const session: ChatSession = existingSession
      ? { ...existingSession, updatedAt: now, messages: nextMessages }
      : { id: sessionId, title: pendingTitle, titleSource: 'pending', titleRevision: 0, createdAt: now, updatedAt: now, messages: nextMessages };

    changeSessions((current) => [session, ...current.filter((item) => item.id !== sessionId)]);
    setActiveId(sessionId);
    if (!resumeMessage) setDraft('');
    setGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;
    stopPromiseRef.current = null;
    generatingMessageRef.current = { sessionId, messageId: assistantMessage.id };
    const conversation = (resumeMessage
      ? (existingSession?.messages || []).slice(0, (existingSession?.messages || []).findIndex((item) => item.id === resumeMessage.id))
      : [...(existingSession?.messages || []), userMessage])
      .filter((item) => item.content.trim() || item.images?.length || item.files?.length)
      .map(({ role, content, images, files }) => ({ role, content, images, files }));

    let generationStatus: NonNullable<ChatMessage['generationStatus']> = 'complete';
    let saved = false;
    let importResult: ImportResult | undefined;
    let operationError: Error | undefined;
    try {
      const persisted = resumeMessage ? session : await enqueueWrite(() => adminPut<ChatSession>(`${HISTORY_API}/${encodeURIComponent(sessionId)}`, session));
      saved = true;
      if (deletedIdsRef.current.has(sessionId)) return;
      replaceSession(persisted);
      // Name the conversation from its first prompt as soon as that prompt is stored.
      // Naming proceeds independently of reply completion, errors or cancellation.
      if (persisted.titleSource === 'pending') void generateName(sessionId);
      if (controller.signal.aborted) {
        generationStatus = 'stopped';
        return;
      }
      let continuationToken = resumeMessage?.continuationToken;
      for (let segment = 0; segment < 8; segment++) {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        continuationToken = await adminPostStream('/api/admin/v1/agent/chat/stream', {
          messages: conversation, sessionId, assistantMessageId: assistantMessage.id, approvedImport, continuationToken,
          resumeStopped: !!resumeMessage && segment === 0,
        }, (chunk) => {
          updateMessage(sessionId, assistantMessage.id, (content) => content + chunk);
        }, controller.signal, (event, payload) => {
          if (event === 'stopped') controller.abort();
          if (event === 'tool' && payload.phase === 'run' && typeof payload.continuationToken === 'string') {
            changeSessions((current) => current.map((item) => item.id !== sessionId ? item : ({ ...item,
              messages: item.messages?.map((message) => message.id === assistantMessage.id
                ? { ...message, continuationToken: payload.continuationToken as string } : message),
            })));
          }
          if (event === 'tool' && payload.phase === 'observation' && payload.name === 'commit_import' && payload.success) {
            importResult = payload.result as ImportResult;
          }
        });
        if (!continuationToken) break;
        if (segment === 7) {
          generationStatus = 'stopped';
          setError('已保存任务进度，点击“继续处理”可接着执行。');
        }
      }
    } catch (requestError) {
      generationStatus = controller.signal.aborted ? 'stopped' : 'error';
      operationError = requestError instanceof Error ? requestError : new Error('AI 回复失败');
      if (!controller.signal.aborted) {
        const message = requestError instanceof Error ? requestError.message : 'AI 回复失败，请稍后重试';
        updateMessage(sessionId, assistantMessage.id, (content) => content || `回复失败：${message}`);
        setError(saved ? message : `聊天记录保存失败：${message}`);
        if (!saved) { setDraft(text); imageManager.restore(sentAttachments); }
      }
    } finally {
      if (saved) imageManager.release(sentAttachments);
      else if (controller.signal.aborted) imageManager.restore(sentAttachments);
      const stopRequest = stopPromiseRef.current;
      let stopConfirmed = !stopRequest;
      if (stopRequest) {
        try { await stopRequest; stopConfirmed = true; } catch { stopConfirmed = false; }
      }
      finishMessage(sessionId, assistantMessage.id, generationStatus);
      if (saved) {
        try {
          await enqueueWrite(async () => {
            if (deletedIdsRef.current.has(sessionId)) return;
            const snapshot = sessionsRef.current.find((item) => item.id === sessionId);
            if (!snapshot) return;
            if (stopRequest) {
              // Cancellation status/version come from the backend, never a stale browser snapshot.
              const latest = await adminGet<ChatSession>(`${HISTORY_API}/${encodeURIComponent(sessionId)}`);
              if (!deletedIdsRef.current.has(sessionId)) replaceSession(latest);
              return;
            }
            let persisted: ChatSession;
            try {
              persisted = await adminPut<ChatSession>(`${HISTORY_API}/${encodeURIComponent(sessionId)}`, snapshot);
            } catch (saveError) {
              // Streaming checkpoints advance the server version; never overwrite a newer reply.
              if (!(saveError instanceof Error) || !saveError.message.includes('聊天记录已更新')) throw saveError;
              persisted = await adminGet<ChatSession>(`${HISTORY_API}/${encodeURIComponent(sessionId)}`);
              const last = persisted.messages?.[persisted.messages.length - 1];
              if (last?.id === assistantMessage.id && !last.generationStatus) {
                const finished = snapshot.messages?.find((item) => item.id === assistantMessage.id);
                if (finished) {
                  persisted = await adminPut<ChatSession>(`${HISTORY_API}/${encodeURIComponent(sessionId)}`, {
                    ...persisted,
                    messages: persisted.messages?.map((item) => item.id === finished.id
                      ? { ...finished, content: item.content.length > finished.content.length ? item.content : finished.content }
                      : item),
                  });
                }
              }
            }
            if (!deletedIdsRef.current.has(sessionId)) replaceSession(persisted);
          });
        } catch (saveError) {
          if (stopConfirmed && !deletedIdsRef.current.has(sessionId)) setError(`聊天记录保存失败：${saveError instanceof Error ? saveError.message : '请稍后重试'}`);
        }
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
        generatingMessageRef.current = null;
        setGenerating(false);
      }
    }
    if (approvedImport && operationError) throw operationError;
    return importResult;
  };

  return (
    <main className="admin-ai-chat" ref={chatCardRef}>
      <aside className="admin-ai-chat__history" aria-label="聊天历史">
        <div className="admin-ai-chat__history-top">
          <div className="admin-ai-chat__brand"><span className="admin-ai-chat__brand-mark"><IconRobot /></span><span>QOJ AI</span></div>
          <Button className="admin-ai-chat__new" icon={<IconPlus />} onClick={startNewChat} disabled={loadingHistory || !!historyError}>新聊天</Button>
        </div>
        <div className="admin-ai-chat__history-list">
          {loadingHistory ? (
            <div className="admin-ai-chat__history-empty"><Spin size={16} /> 正在加载聊天历史…</div>
          ) : historyError ? (
            <div className="admin-ai-chat__history-empty" role="alert">
              <div>聊天历史加载失败：{historyError}</div>
              <Button size="small" onClick={() => { loadPromiseRef.current = null; setLoadAttempt((attempt) => attempt + 1); }}>重试</Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="admin-ai-chat__history-empty">新建对话后，会显示在这里</div>
          ) : Object.entries(groupedSessions).map(([group, items]) => items.length > 0 && (
            <section className="admin-ai-chat__group" key={group}>
              <div className="admin-ai-chat__group-title">{group}</div>
              {items.map((session) => (
                <div className={`admin-ai-chat__history-item ${session.id === activeId ? 'is-active' : ''}`} key={session.id}>
                  <button className="admin-ai-chat__history-select" onClick={() => selectChat(session.id)} title={session.title}>
                    <span>{session.title}</span>
                  </button>
                  {generatingTitleIds.has(session.id) && <span className="admin-ai-chat__title-loading" title="AI 正在生成名称" aria-label="AI 正在生成名称"><Spin size={12} /></span>}
                  <button className="admin-ai-chat__history-rename" aria-label={`重命名聊天：${session.title}`} title="重命名聊天" onClick={() => openRename(session)}>
                    <IconEdit />
                  </button>
                  <button className="admin-ai-chat__history-delete" aria-label={`删除聊天：${session.title}`} onClick={() => { void deleteChat(session.id); }}>
                    <IconDelete />
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="admin-ai-chat__history-foot">对话历史按管理员账号保存</div>
      </aside>

      <section className="admin-ai-chat__conversation">
        <header className="admin-ai-chat__topbar">
          <div>
            <div className="admin-ai-chat__top-title">{activeSession?.title || '新聊天'}</div>
            <div className="admin-ai-chat__model-label">AI 管理助手</div>
          </div>
        </header>

        <div className={`admin-ai-chat__messages ${activeSession?.messages?.length ? 'has-messages' : ''}`}>
          {loadingMessages || loadingHistory ? (
            <div className="admin-ai-chat__thinking"><Spin size={16} />正在加载聊天记录…</div>
          ) : activeSession?.messages?.length ? (
            <div className="admin-ai-chat__message-list">
              {activeSession.messages.map((message) => (
                <article className={`admin-ai-chat__message admin-ai-chat__message--${message.role}`} key={message.id}>
                  {message.role === 'assistant' && <div className="admin-ai-chat__avatar"><IconRobot /></div>}
                  <div className="admin-ai-chat__message-body">
                    {message.role === 'user'
                      ? <>
                        {!!message.images?.length && <div className="admin-ai-chat__message-images">{message.images.map((image) => <ChatImageThumbnail key={image.id} image={image} onOpen={openImage} />)}</div>}
                        {!!message.files?.length && <div className="admin-ai-chat__message-files">{message.files.map((file) => <ChatFileCard key={file.id} file={file}
                          onOpen={() => setFilePreview({ file, files: message.files || [], instructions: message.content })} />)}
                        </div>}
                        {message.content && <div className="admin-ai-chat__user-bubble">{message.content}</div>}
                      </>
                      : message.content
                        ? <div className="admin-ai-chat__markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...markdownComponents,
                          a: ({ href, children }) => {
                            const match = href?.match(/^\/qoj-import\/([A-Za-z0-9-]{1,80})$/);
                            return match ? <Button size="small" type="primary" disabled={generating}
                              onClick={() => openImport({ files: [], instructions: '', planId: match[1] })}>查看并确认导入方案</Button>
                              : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                          },
                        }}>{message.content}</ReactMarkdown></div>
                        : message.generationStatus === 'stopped'
                          ? <div className="admin-ai-chat__thinking">生成已停止。</div>
                        : generating && activeId === activeSession.id
                          ? <div className="admin-ai-chat__thinking"><Spin size={16} />正在思考…</div>
                          : <div className="admin-ai-chat__thinking">回复尚未完成，请稍后刷新。</div>}
                    {generating && activeId === activeSession.id && message.role === 'assistant' && message.content.length > 0 && generatingMessageRef.current?.messageId === message.id && <span className="admin-ai-chat__cursor" />}
                    {message.role === 'assistant' && message.continuationToken && message.generationStatus !== 'complete' && !generating && !stopFailure
                      && message.id === activeSession.messages?.[activeSession.messages.length - 1]?.id && <Button size="small" onClick={() => { void sendMessage('', undefined, message); }}>继续处理</Button>}
                    {message.role === 'assistant' && message.completedAt != null && message.durationMs != null ? (
                      <div className="admin-ai-chat__message-meta">
                        <span>耗时{message.timingEstimate ? '约' : ''} {formatDuration(message.durationMs)}</span>
                        <span>{message.generationStatus === 'stopped' ? '已停止 · 停止时间' : message.generationStatus === 'error' ? '失败时间' : '完成时间'}{message.timingEstimate ? '约' : ''} {formatMessageTime(message.completedAt)}</span>
                      </div>
                    ) : generating && activeId === activeSession.id && generatingMessageRef.current?.messageId === message.id ? (
                      <div className="admin-ai-chat__message-meta">
                        <span>{message.createdAt == null ? '已耗时约' : '已耗时'} {formatDuration(Math.max(0, currentTime - (message.createdAt ?? activeSession.createdAt)))}</span>
                        <span>当前时间 {formatMessageTime(currentTime)}</span>
                      </div>
                    ) : message.role === 'assistant' && message.content.trim() ? (
                      <div className="admin-ai-chat__message-meta">历史记录 · 耗时未记录</div>
                    ) : null}
                  </div>
                </article>
              ))}
              <div ref={endOfMessagesRef} />
            </div>
          ) : (
            <div className="admin-ai-chat__welcome">
              <div className="admin-ai-chat__welcome-icon"><IconRobot /></div>
              <Typography.Title heading={3}>有什么可以帮忙的？</Typography.Title>
              <Typography.Text type="secondary">直接聊天即可查询题库与比赛、创建未发布题目。上传附件后告诉我需要分析或导入，我会继续处理并展示结果。</Typography.Text>
              <div className="admin-ai-chat__suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} onClick={() => { void sendMessage(suggestion); }}>
                    <span>{suggestion}</span><span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="admin-ai-chat__composer-area">
          {error && <div className="admin-ai-chat__error" role="status">
            {error}
            {stopFailure && <Button size="mini" onClick={() => { void retryStop(); }}>重试停止</Button>}
            {activeSession && !activeSession.messages && <Button size="mini" onClick={() => { setError(''); setMessageLoadAttempt((attempt) => attempt + 1); }}>重试加载</Button>}
          </div>}
          <DraftChatImages manager={imageManager} onOpen={openImage}
            onOpenFile={(file) => setFilePreview({ file, files: imageManager.attachments.flatMap((item) => item.document ? [item.document] : []), instructions: draft })} />
          <div className="admin-ai-chat__composer">
            <input ref={uploadInputRef} type="file" accept={CHAT_FILE_ACCEPT} multiple hidden
              onChange={(event) => { imageManager.addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
            <Button className="admin-ai-chat__upload" shape="circle" icon={<IconPlus />} aria-label="上传附件"
              title="上传图片或文件：图片 5 MB，其他文件 50 MB，每条最多 4 个附件；支持粘贴"
              disabled={generating || !!stopFailure || loadingHistory || loadingMessages || !!historyError || imageManager.attachments.length >= 4}
              onClick={() => uploadInputRef.current?.click()} />
            <TextArea
              value={draft}
              onChange={setDraft}
              onCompositionStartCapture={() => { composingRef.current = true; }}
              onCompositionEndCapture={() => { composingRef.current = false; }}
              onBlur={() => { composingRef.current = false; }}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.items).filter((item) => item.kind === 'file')
                  .flatMap((item) => { const file = item.getAsFile(); return file ? [file] : []; });
                if (files.length) {
                  event.preventDefault();
                  imageManager.addFiles(files);
                  const text = event.clipboardData.getData('text/plain');
                  if (text) setDraft((current) => current + text);
                }
              }}
              onKeyDown={(event) => {
                // Some browsers end composition before the candidate-confirming Enter (keyCode 229).
                if (composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="向 AI 助手发送消息…"
              autoSize={{ minRows: 1, maxRows: Math.max(1, Math.floor((textareaMaxHeight - 12) / 22)) }}
              style={{ maxHeight: `${textareaMaxHeight}px`, overflowY: 'auto' }}
              maxLength={12000}
              disabled={generating || !!stopFailure || loadingHistory || loadingMessages || !!historyError || (!!activeSession && !activeSession.messages)}
              aria-label="输入消息"
            />
            {generating ? (
              <Button className="admin-ai-chat__stop" shape="circle" aria-label="停止生成" onClick={() => stopGeneration()}>
                <span className="admin-ai-chat__stop-icon" />
              </Button>
            ) : (
              <Button
                className="admin-ai-chat__send"
                type="primary"
                shape="circle"
                icon={<IconSend />}
                aria-label="发送消息"
                disabled={!!stopFailure || (!draft.trim() && !imageManager.attachments.length) || !imagesReady || loadingHistory || loadingMessages || !!historyError || (!!activeSession && !activeSession.messages)}
                onClick={() => { void sendMessage(); }}
              />
            )}
          </div>
          <div className="admin-ai-chat__hint">Enter 发送 · Shift + Enter 换行 · AI 生成内容请核对后使用</div>
        </footer>
      </section>
      {filePreview && <AdminChatFilePreview source={filePreview} onClose={() => setFilePreview(null)} />}
      {importSource && <AdminChatImportModal source={importSource} onClose={() => setImportSource(null)} onApprove={async (approval) => {
        const result = await sendMessage('确认导入我已在审核界面核对的题目和测试点，保存为未发布题目。', approval);
        if (!result) throw new Error('Agent 未完成导入，请重试；已完成的导入不会重复创建题目。');
        return result;
      }} />}
      <Modal title={imagePreview?.name || '查看图片'} visible={!!imagePreview} footer={null} onCancel={() => setImagePreview(null)} style={{ width: 'min(900px, 92vw)' }}>
        {imagePreview && <img className="admin-ai-chat__image-full" src={imagePreview.src} alt={imagePreview.name} />}
      </Modal>
      <Modal
        title="重命名聊天"
        visible={renameId !== null}
        onCancel={closeRename}
        onOk={() => { void saveName(); }}
        confirmLoading={savingName}
        okText="保存名称"
        cancelText="取消"
        focusLock
      >
        <Input
          value={nameDraft}
          onChange={(value) => { setNameDraft(value); setNameError(''); }}
          onPressEnter={() => { void saveName(); }}
          aria-label="聊天名称"
          placeholder="请输入 5～20 个字的聊天名称"
          disabled={savingName}
          error={!!nameError}
        />
        <div className="admin-ai-chat__name-tools">
          <span>{Array.from(nameDraft.trim().replace(/\s+/g, ' ')).length}/20 字 · 至少 5 个字</span>
        </div>
        {nameError && <div className="admin-ai-chat__error" role="alert">{nameError}</div>}
      </Modal>
    </main>
  );
}
