export type EditorGet = <T>(url: string) => Promise<T>;

export interface FolderOption {
  id: number;
  name: string;
  problemCount: number;
}

interface PageResult<T> {
  total: number;
  list: T[];
}

// Older deployments can map /options to a numeric ID route and return 500.
// Never fall back after authentication or permission failures.
function canUseLegacyEndpoint(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const { status, code } = error as { status?: number; code?: number };
  if (status === 401 || status === 403) return false;
  return [404, 405, 500].includes(status ?? 0) || code === 50000;
}

export async function fetchFolderOptions(get: EditorGet): Promise<FolderOption[]> {
  try {
    return await get<FolderOption[]>('/api/admin/v1/problem-folders/options');
  } catch (error) {
    if (!canUseLegacyEndpoint(error)) throw error;
    const folders = await get<Array<FolderOption & { problems?: unknown[] }>>('/api/admin/v1/problem-folders');
    return folders.map(folder => ({ id: folder.id, name: folder.name, problemCount: folder.problemCount ?? folder.problems?.length ?? 0 }));
  }
}

export async function fetchPracticeEditorDetail<T extends { id: number }>(get: EditorGet, id: number): Promise<T> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('题单参数无效');
  try {
    return await get<T>(`/api/admin/v1/practices/${id}`);
  } catch (error) {
    if (!canUseLegacyEndpoint(error)) throw error;
    // Compatibility with older servers; scan all pages, not just the first 200.
    for (let page = 1; ; page++) {
      const result = await get<PageResult<T>>(`/api/admin/v1/practices?page=${page}&pageSize=200`);
      const found = result.list.find(practice => practice.id === id);
      if (found) return found;
      if (!result.list.length || page * 200 >= result.total) break;
    }
    throw new Error('题单不存在或无权访问');
  }
}
