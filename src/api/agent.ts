/**
 * agent接口封装。集中处理请求参数、响应类型与后端 API 调用边界。
 */
import { apiGet, apiPost } from "./client";

/**
 * AgentChat请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AgentChatPayload {
  message: string;
  problemId: number;
  contestId?: number;
  contestProblemId?: number;
  language?: string;
  code?: string;
  submissionId?: number;
}

/**
 * AgentChat响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AgentChatResponse {
  reply: string;
  model: string;
  requestId: string;
}

/**
 * 封装chatWithAgent相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function chatWithAgent(payload: AgentChatPayload): Promise<AgentChatResponse> {
  return apiPost<AgentChatResponse>("/api/v1/agent/chat", payload, true, { timeoutMs: 120000 });
}

/**
 * AgentQuota接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AgentQuota {
  dailyLimit: number;
  used: number;
  remaining: number;
}

/**
 * 读取AgentQuota并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAgentQuota(): Promise<AgentQuota> {
  return apiGet<AgentQuota>("/api/v1/agent/quota", true);
}
