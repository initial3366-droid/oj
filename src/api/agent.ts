import { apiGet, apiPost } from "./client";

export interface AgentChatPayload {
  message: string;
  problemId: number;
  contestId?: number;
  contestProblemId?: number;
  language?: string;
  code?: string;
  submissionId?: number;
}

export interface AgentChatResponse {
  reply: string;
  model: string;
  requestId: string;
}

export async function chatWithAgent(payload: AgentChatPayload): Promise<AgentChatResponse> {
  return apiPost<AgentChatResponse>("/api/v1/agent/chat", payload, true, { timeoutMs: 120000 });
}

export interface AgentQuota {
  dailyLimit: number;
  used: number;
  remaining: number;
}

export async function fetchAgentQuota(): Promise<AgentQuota> {
  return apiGet<AgentQuota>("/api/v1/agent/quota", true);
}
