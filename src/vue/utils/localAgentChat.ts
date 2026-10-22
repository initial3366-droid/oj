import { readAuthToken } from '../../api/tokenStorage';

/** Chat bodies stay in this origin's IndexedDB, partitioned by authenticated account. */
export function chatOwner(): string {
  const token = readAuthToken('admin');
  try {
    const part = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part!.padEnd(Math.ceil(part!.length / 4) * 4, '=')), c => c.charCodeAt(0))));
    if (!data.sub) throw new Error();
    return `admin:${data.sub}`;
  } catch { throw new Error('登录已失效，请重新登录后使用本地聊天'); }
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('qoj-agent-local-v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地聊天存储，请检查浏览器隐私设置'));
  });
}
export async function localChatAction<T>(owner: string, action: 'list' | 'put' | 'delete', value?: { id: string } & Record<string, unknown>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sessions', action === 'list' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('sessions');
    const key = `${owner}:${value?.id}`;
    const request = action === 'list' ? store.getAll() : action === 'put' ? store.put({ key, owner, value: JSON.parse(JSON.stringify(value)) }) : store.delete(key);
    let result: unknown;
    request.onsuccess = () => { result = action === 'list' ? (request.result as Array<{ owner: string; value: unknown }>).filter((row: { owner: string }) => row.owner === owner).map((row: { value: unknown }) => row.value) : value; };
    transaction.oncomplete = () => { db.close(); resolve(result as T); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error('本地聊天保存失败，可能存储空间不足；请导出记录后重试')); };
  });
}
export function estimateChatTokens(text: string): number {
  let ascii = 0, other = 0;
  for (const character of text) character.codePointAt(0)! < 128 ? ascii++ : other++;
  return Math.ceil(ascii / 3 + other * 2);
}
