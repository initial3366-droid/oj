import { useEffect, useRef, useState } from 'react';
import { Button, Modal, Spin } from '@arco-design/web-react';
import { adminGet, adminGetBlob } from '../../api/adminClient';
import { CHAT_FILE_API, type ChatFileData } from './AdminChatImages';

export type ImportSource = { files: ChatFileData[]; instructions: string; planId?: string };
export type FilePreviewSource = ImportSource & { file: ChatFileData };
type Preview = { file: ChatFileData; entries: { path: string; size: number; kind: string; encoding: string; text: string; truncated: boolean }[]; warnings: string[] };

export function AdminChatFilePreview({ source, onClose }: { source: FilePreviewSource; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const promiseRef = useRef<{ id: string; attempt: number; promise: Promise<Preview> } | null>(null);
  useEffect(() => {
    let canceled = false;
    setError(''); setPreview(null);
    if (promiseRef.current?.id !== source.file.id || promiseRef.current.attempt !== attempt) {
      promiseRef.current = { id: source.file.id, attempt, promise: adminGet<Preview>(`${CHAT_FILE_API}/${encodeURIComponent(source.file.id)}`) };
    }
    void promiseRef.current.promise.then((data) => {
      if (canceled) return;
      setPreview(data);
      setSelected(data.entries.find((entry) => entry.kind === 'document')?.path || data.entries[0]?.path || '');
    }).catch((error: unknown) => { if (!canceled) setError(error instanceof Error ? error.message : '文件预览加载失败'); });
    return () => { canceled = true; };
  }, [source.file.id, attempt]);

  const entry = preview?.entries.find((item) => item.path === selected);
  const download = async () => {
    setDownloading(true);
    try {
      const blob = await adminGetBlob(`${CHAT_FILE_API}/${encodeURIComponent(source.file.id)}/download`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = source.file.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error instanceof Error ? error.message : '下载失败'); }
    finally { setDownloading(false); }
  };
  return (
    <Modal title={`文件预览：${source.file.name}`} visible onCancel={onClose} style={{ width: 'min(1000px, 94vw)' }} footer={<>
      <Button loading={downloading} onClick={() => { void download(); }}>下载原文件</Button>
    </>}>
      {error && <div className="admin-ai-chat__error" role="alert">{error}<Button size="mini" onClick={() => setAttempt((value) => value + 1)}>重试预览</Button></div>}
      {!preview && !error ? <div className="admin-ai-chat__thinking"><Spin />正在提取文件内容…</div> : preview && <>
        {!!preview.warnings.length && <div className="admin-ai-chat__file-warnings" role="status">{preview.warnings.map((warning, index) => <div key={index}>{warning}</div>)}</div>}
        <div className="admin-ai-chat__file-preview">
          <div className="admin-ai-chat__file-index" aria-label="文件清单">{preview.entries.map((item) => <button key={item.path} type="button"
            className={item.path === selected ? 'is-active' : ''} onClick={() => setSelected(item.path)}><strong>{item.path}</strong><small>{item.encoding} · {item.size} 字节</small></button>)}</div>
          <div className="admin-ai-chat__file-content"><strong>{entry?.path}</strong>
            <pre>{entry?.text || '此文件没有可显示的文字内容，原文件仍保留。'}</pre>
            {entry?.truncated && <p>这里显示前 2000 个字符；导入时读取原始测试数据。</p>}
          </div>
        </div>
      </>}
    </Modal>
  );
}
