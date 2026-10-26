type Portal = 'frontend' | 'admin';
type TokenKind = 'access' | 'refresh';

const keys = {
  frontend: { access: 'qoj.accessToken', refresh: 'qoj.refreshToken' },
  admin: { access: 'qoj.adminAccessToken', refresh: 'qoj.adminRefreshToken' },
};

function payload(token: string | null): { exp?: number; sessionExpiresAt?: number } {
  try {
    const part = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    return part ? JSON.parse(window.atob(part.padEnd(Math.ceil(part.length / 4) * 4, '='))) : {};
  } catch {
    return {};
  }
}

export function clearAuthTokens(portal: Portal) {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem(keys[portal].access);
    storage.removeItem(keys[portal].refresh);
  }
}

export function readAuthToken(portal: Portal, kind: TokenKind = 'access'): string | null {
  const hasSessionTokens = Boolean(window.sessionStorage.getItem(keys[portal].access)
    || window.sessionStorage.getItem(keys[portal].refresh));
  const storage = hasSessionTokens ? window.sessionStorage : window.localStorage;
  const access = payload(storage.getItem(keys[portal].access));
  const refresh = payload(storage.getItem(keys[portal].refresh));
  const expiresAt = refresh.sessionExpiresAt ?? access.sessionExpiresAt ?? refresh.exp ?? access.exp;
  if (typeof expiresAt === 'number' && expiresAt * 1000 <= Date.now()) {
    clearAuthTokens(portal);
    return null;
  }
  return storage.getItem(keys[portal][kind]);
}

/** 登录及令牌轮换统一持久存储，截止时间由后端令牌控制。密码不进入浏览器存储。 */
export function storeAuthTokens(portal: Portal, accessToken: string, refreshToken?: string, _rememberMe?: boolean) {
  const storage = window.localStorage;
  clearAuthTokens(portal);
  storage.setItem(keys[portal].access, accessToken);
  if (refreshToken) storage.setItem(keys[portal].refresh, refreshToken);
}
