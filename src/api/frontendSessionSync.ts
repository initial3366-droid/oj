import { clearAuthTokens, readAuthToken, storeAuthTokens } from './tokenStorage';

type Tokens = { accessToken: string; refreshToken: string };
type Snapshot = Tokens & { family: string; revision: number };
const REVISION_KEY = 'qoj.frontendSessionRevision';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qoj.frontend-session') : null;

function family(token: string | null): string | null {
  try {
    const value = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    return value ? JSON.parse(atob(value.padEnd(Math.ceil(value.length / 4) * 4, '='))).familyId ?? null : null;
  } catch { return null; }
}
function snapshot(): Snapshot | null {
  if (!sessionStorage.getItem('qoj.accessToken')) return null;
  const accessToken = readAuthToken('frontend');
  const refreshToken = readAuthToken('frontend', 'refresh');
  const id = family(refreshToken);
  return accessToken && refreshToken && id
    ? { accessToken, refreshToken, family: id, revision: Number(sessionStorage.getItem(REVISION_KEY)) || 0 }
    : null;
}
function receive(value: Snapshot) {
  const current = snapshot();
  if (!value || !current || value.family !== current.family || value.revision <= current.revision
    || typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string'
    || family(value.refreshToken) !== current.family) return;
  storeAuthTokens('frontend', value.accessToken, value.refreshToken, false);
  sessionStorage.setItem(REVISION_KEY, String(value.revision));
}
channel?.addEventListener('message', ({ data }) => {
  if (data?.type === 'snapshot') receive(data.value);
  if (data?.type === 'clear' && snapshot()?.family === data.family) {
    clearAuthTokens('frontend');
    window.dispatchEvent(new Event('qoj:auth-cleared'));
  }
  if (data?.type === 'request') {
    const current = snapshot();
    if (current?.family === data.family) channel.postMessage({ type: 'snapshot', value: current });
  }
});

export function publishFrontendSessionClear() {
  const current = snapshot();
  if (current) channel?.postMessage({ type: 'clear', family: current.family });
}

/** Refresh under the cross-tab lock only after reconciling session-only tabs. */
export async function synchronizeFrontendSession() {
  const current = snapshot();
  if (!channel || !current) return;
  channel.postMessage({ type: 'request', family: current.family });
  await new Promise(resolve => window.setTimeout(resolve, 100));
}
export function publishFrontendSessionRotation(tokens: Tokens) {
  const revision = (Number(sessionStorage.getItem(REVISION_KEY)) || 0) + 1;
  storeAuthTokens('frontend', tokens.accessToken, tokens.refreshToken);
  if (!sessionStorage.getItem('qoj.accessToken')) return;
  sessionStorage.setItem(REVISION_KEY, String(revision));
  const current = snapshot();
  if (current) channel?.postMessage({ type: 'snapshot', value: current });
}

/** A same-origin blank tab receives session-only credentials before navigation.
 * The opener is detached before any application content loads. */
export function openFrontendPage(path: string) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('只能打开本站页面');
  const sessionOnly = Boolean(sessionStorage.getItem('qoj.accessToken') || sessionStorage.getItem('qoj.refreshToken'));
  const canCoordinateRefresh = Boolean(channel && navigator.locks);
  const access = readAuthToken('frontend');
  const refresh = canCoordinateRefresh ? readAuthToken('frontend', 'refresh') : null;
  const tab = window.open('about:blank', '_blank');
  if (!tab) { window.alert('浏览器阻止了新标签页，请允许本站弹出窗口后重试。'); return; }
  try {
    for (const key of ['qoj.accessToken', 'qoj.refreshToken']) {
      tab.sessionStorage.removeItem(key);
    }
    if (sessionOnly && access) tab.sessionStorage.setItem('qoj.accessToken', access);
    // Browsers without cross-tab locks must not rotate the same refresh token independently.
    if (sessionOnly && refresh) tab.sessionStorage.setItem('qoj.refreshToken', refresh);
    tab.sessionStorage.setItem(REVISION_KEY, sessionStorage.getItem(REVISION_KEY) || '0');
    tab.opener = null;
    tab.location.replace(url.href);
  } catch {
    tab.opener = null;
    tab.location.replace(url.href);
  }
}
