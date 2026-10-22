import { apiGet, apiPost } from './client';
import { adminGet } from '../admin/api/adminClient';
import { wsClient, adminWsClient } from '../utils/websocket';
import { adminPath } from '../utils/adminPath';

export interface ContestMessage {
  id: number;
  participantId: number | null;
  kind: 'QUESTION' | 'REPLY' | 'BROADCAST';
  authorName: string;
  content: string;
  createdAt: string;
}
export interface ContestMessageFeed {
  contestTitle: string;
  userId: number;
  readThroughId: number;
  messages: ContestMessage[];
  hasMore: boolean;
}
export function getContestMessages(id: number, afterId: number, management = false) {
  const canonicalPath = `/api/${management ? 'admin/' : ''}v1/contests/${id}/messages?afterId=${afterId}`;
  const path = management ? adminPath(canonicalPath) : canonicalPath;
  return management ? adminGet<ContestMessageFeed>(path) : apiGet<ContestMessageFeed>(path, true);
}
export function sendContestMessage(id: number, content: string, requestId: string, kind: 'QUESTION' | 'REPLY' | 'BROADCAST', participantId?: number) {
  return (kind === 'QUESTION' ? wsClient : adminWsClient).sendContestMessage(id, kind, content, requestId, participantId);
}
export function readContestMessages(id: number, throughId: number) {
  return apiPost(`/api/v1/contests/${id}/messages/read`, { throughId }, true);
}

// randomUUID requires a secure context; school LAN deployments may use HTTP.
export function createContestMessageRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
