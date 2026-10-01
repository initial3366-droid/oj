import { adminPostEventStream } from '../admin/api/adminClient';

export type AgentGenerateRequest = {
  title?: string;
  rating: string;
  background?: string;
  description: string;
  knowledgePoints: string[];
  testCaseCount: number;
};

export type AgentProblem = {
  title: string;
  rating: string;
  knowledgePoints: string[];
  statementHtml: string;
  statementLatex: string;
  inputFormatHtml: string;
  inputFormatLatex: string;
  outputFormatHtml: string;
  outputFormatLatex: string;
  samples: Array<{ input: string; output: string; explanation?: string }>;
};

export type AgentWorkspace = { slug: string; title: string; problem: AgentProblem; files: Array<{ path: string; content: string }> };

const base = (import.meta.env.VITE_AGENT_BASE_URL || '/agent').replace(/\/$/, '');

export async function generateProblem(
  payload: AgentGenerateRequest,
  onProgress: (event: { stage: string; message: string; percent: number }) => void,
  signal?: AbortSignal,
): Promise<AgentWorkspace> {
  let result: AgentWorkspace | null = null;
  await adminPostEventStream(`${base}/v1/problem/generate`, payload, (event, data) => {
    if (event === 'progress') {
      onProgress({
        stage: typeof data.stage === 'string' ? data.stage : 'working',
        message: typeof data.message === 'string' ? data.message : '',
        percent: typeof data.percent === 'number' ? data.percent : 0,
      });
    }
    if (event === 'complete') {
      result = data as unknown as AgentWorkspace;
      return true;
    }
    if (event === 'error') throw new Error(typeof data.message === 'string' ? data.message : 'Agent 生成失败');
  }, signal);
  if (!result) throw new Error('Agent 未返回生成结果'); return result;
}
