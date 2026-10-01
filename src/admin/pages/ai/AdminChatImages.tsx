import { useEffect, useRef, useState } from 'react';
import { Button, Spin } from '@arco-design/web-react';
import { IconClose, IconFile } from '@arco-design/web-react/icon';
import { adminDelete, adminGetBlob, adminPost } from '../../api/adminClient';

export const CHAT_IMAGE_API = '/api/admin/v1/agent/chat/images';
export const CHAT_FILE_API = '/api/admin/v1/agent/chat/files';
export const CHAT_FILE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,.zip,.pdf,.docx,.xlsx,.xls,.json,.txt,.md,.markdown,.html,.htm,.csv,.xml,.yaml,.yml,.log,.tex,.in,.out,.ans,.cpp,.cc,.c,.h,.hpp,.java,.py,.go,.js,.ts,.sql';
export type ChatImageData = { id: string; name: string; mimeType: string; size: number; width: number; height: number };
export type ChatFileData = { id: string; name: string; size: number; entryCount: number };
type Attachment = { key: string; file: File; src: string; status: 'uploading' | 'ready' | 'error'; image?: ChatImageData; document?: ChatFileData; error?: string };

const isImage = (file: File) => file.type.startsWith('image/') || /\.(?:jpe?g|png|gif|webp)$/i.test(file.name);

export function ChatImageThumbnail({ image, onOpen }: { image: ChatImageData; onOpen: (src: string, name: string) => void }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let canceled = false;
    let objectUrl = '';
    setError(false);
    void adminGetBlob(`${CHAT_IMAGE_API}/${encodeURIComponent(image.id)}`).then((blob) => {
      if (canceled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => { if (!canceled) setError(true); });
    return () => { canceled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image.id, attempt]);
  return (
    <button className="admin-ai-chat__image-thumbnail" type="button" aria-label={`查看图片：${image.name}`}
      onClick={() => src ? onOpen(src, image.name) : setAttempt((value) => value + 1)}>
      {src ? <img src={src} alt={image.name} /> : error ? <span>加载失败，点击重试</span> : <Spin size={18} />}
    </button>
  );
}

export function useChatAttachments(onError: (message: string) => void) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const ref = useRef<Attachment[]>([]);
  const mounted = useRef(true);
  const change = (next: Attachment[]) => { ref.current = next; if (mounted.current) setAttachments(next); };
  const deleteStored = (attachment: ChatImageData | ChatFileData) => {
    void adminDelete(`${'entryCount' in attachment ? CHAT_FILE_API : CHAT_IMAGE_API}/${encodeURIComponent(attachment.id)}`).catch((error: unknown) => {
      if (mounted.current) onError(`附件删除失败：${error instanceof Error ? error.message : '请稍后重试'}`);
    });
  };
  const clear = (deleteFiles = true) => {
    const previous = ref.current;
    change([]);
    for (const item of previous) {
      URL.revokeObjectURL(item.src);
      if (deleteFiles && item.image) deleteStored(item.image);
      if (deleteFiles && item.document) deleteStored(item.document);
    }
  };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clear(); };
  }, []);

  const upload = async (item: Attachment) => {
    change(ref.current.map((current) => current.key === item.key ? { ...current, status: 'uploading', error: undefined } : current));
    try {
      const body = new FormData();
      body.append('file', item.file);
      const imageFile = isImage(item.file);
      const stored = await adminPost<ChatImageData | ChatFileData>(imageFile ? CHAT_IMAGE_API : CHAT_FILE_API, body, true, 120000);
      if (!ref.current.some((current) => current.key === item.key)) { deleteStored(stored); return; }
      change(ref.current.map((current) => current.key === item.key ? { ...current, status: 'ready',
        ...(imageFile ? { image: stored as ChatImageData } : { document: stored as ChatFileData }) } : current));
    } catch (error) {
      if (!ref.current.some((current) => current.key === item.key)) return;
      const message = error instanceof Error ? error.message : '上传失败，请重试';
      change(ref.current.map((current) => current.key === item.key ? { ...current, status: 'error', error: message } : current));
    }
  };
  const addFiles = (files: File[]) => {
    onError('');
    for (const file of files) {
      if (ref.current.length >= 4) { onError('每条消息最多上传 4 个附件'); break; }
      const imageFile = isImage(file);
      if (imageFile && !['image/jpeg', 'image/png', 'image/gif', 'image/webp', ''].includes(file.type)) { onError('仅支持 JPEG、PNG、GIF、WebP 图片'); continue; }
      if (file.size > (imageFile ? 5 : 50) * 1024 * 1024) { onError(imageFile ? '单张图片不能超过 5 MB' : '单个文件不能超过 50 MB'); continue; }
      const key = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: Attachment = { key, file, src: imageFile ? URL.createObjectURL(file) : '', status: 'uploading' };
      change([...ref.current, item]);
      void upload(item);
    }
  };
  const remove = (key: string) => {
    const item = ref.current.find((current) => current.key === key);
    change(ref.current.filter((current) => current.key !== key));
    if (item) { URL.revokeObjectURL(item.src); if (item.image) deleteStored(item.image); if (item.document) deleteStored(item.document); }
  };
  const take = () => { const items = ref.current; change([]); return items; };
  const release = (items: Attachment[]) => items.forEach((item) => URL.revokeObjectURL(item.src));
  const restore = (items: Attachment[]) => {
    if (mounted.current && !ref.current.length) change(items);
    else release(items);
  };
  return { attachments, addFiles, remove, clear, take, release, restore, retry: upload };
}

export function DraftChatImages({ manager, onOpen, onOpenFile }: { manager: ReturnType<typeof useChatAttachments>; onOpen: (src: string, name: string) => void; onOpenFile: (file: ChatFileData) => void }) {
  if (!manager.attachments.length) return null;
  return (
    <div className="admin-ai-chat__attachment-area">
    <div className="admin-ai-chat__attachments" aria-label="待发送附件">
      {manager.attachments.map((item) => (
        <div className={`admin-ai-chat__attachment ${!item.src ? 'is-file' : ''}`} key={item.key}>
          <button className={item.src ? 'admin-ai-chat__image-thumbnail' : 'admin-ai-chat__file-card'} type="button"
            aria-label={`${item.src ? '预览图片' : '预览文件'}：${item.file.name}`} disabled={!item.src && !item.document}
            onClick={() => item.src ? onOpen(item.src, item.file.name) : item.document && onOpenFile(item.document)}>
            {item.src ? <img src={item.src} alt={item.file.name} /> : <><IconFile /><span><strong>{item.file.name}</strong><small>{item.document ? `已提取 ${item.document.entryCount} 个文件` : '准备解析'}</small></span></>}
          </button>
          <button className="admin-ai-chat__image-remove" type="button" aria-label={`${item.src ? '删除图片' : '删除文件'}：${item.file.name}`} onClick={() => manager.remove(item.key)}><IconClose /></button>
          {item.status === 'uploading' && <span className="admin-ai-chat__image-status"><Spin size={14} />上传中</span>}
          {item.status === 'error' && <div className="admin-ai-chat__image-failure" role="alert"><span>{item.error}</span><Button size="mini" onClick={() => { void manager.retry(item); }}>重试上传</Button></div>}
        </div>
      ))}
    </div>

    </div>
  );
}

export function ChatFileCard({ file, onOpen }: { file: ChatFileData; onOpen: (file: ChatFileData) => void }) {
  return <button type="button" className="admin-ai-chat__file-card" aria-label={`查看文件：${file.name}`} onClick={() => onOpen(file)}>
    <IconFile /><span><strong>{file.name}</strong><small>{file.entryCount} 个文件 · {(file.size / 1024).toFixed(1)} KB</small></span>
  </button>;
}
