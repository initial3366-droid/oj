/**
 * 前端全局类型定义。
 *
 * 核心类型：
 * - Problem：题目（含难度、标签、样例、AC率等）
 * - Contest：比赛（ACM/OI、进行中/未开始/已结束）
 * - CarouselSlide：首页轮播图
 * - OjState：全局状态聚合（用户、题目、比赛、榜单、提交）
 * - UserProfile：登录用户信息
 * - RatingUser：排行榜用户
 */
export type Difficulty = "入门" | "简单" | "中等" | "困难" | "地狱";
export type ContestType = "ACM" | "OI";
export type ContestStatus = "未开始" | "进行中" | "已结束";

export interface Problem {
  id: string;
  title: string;
  summary: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  samples: Array<{
    caseNo: number;
    input: string;
    output: string;
    explanation?: string;
  }>;
  difficulty: Difficulty;
  tags: string[];
  timeLimit: number;
  memoryLimit: number;
  acRate: number;
  owner: string;
  ownerName?: string;
  testCaseCount?: number;
  createdAt?: string;
  updatedAt?: string;
  attemptStatus?: string | null;
  score: number;
}

export interface Contest {
  id: string;
  title: string;
  type: ContestType;
  status: ContestStatus;
  startsAt: string;
  endsAt: string;
  audience: string;
  registration: "公开报名" | "密码报名" | "邀请码";
  participants: number;
}

export interface RatingUser {
  id: string;
  name: string;
  className?: string;
  acCount: number;
  streak: number;
}

export interface CarouselSlide {
  id: string;
  title: string;
  imageUrl: string;
}

export interface SubmissionSummary {
  id: string;
  problemTitle: string;
  status: "AC" | "WA" | "TLE" | "CE";
  language: string;
  submittedAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  name: string;
  studentNo: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "SUPER_ADMIN";
  totalSolved: number;
  totalSubmissions: number;
  favoriteLanguage: string;
  classId?: number | null;
  className?: string | null;
}

export interface JudgeSettings {
  /** 判题总开关；关闭后无法提交记录和调试运行 */
  enabled: boolean;
  /** 判题模式 */
  mode?: 'domjudge' | 'docker' | 'unsafe-local';
  /** 比赛判题模式 */
  contestMode?: 'domjudge' | 'docker' | 'unsafe-local';
  /** 是否允许不安全本地判题 */
  enableUnsafeLocalJudge?: boolean;
  /** 是否允许沙箱调试运行 */
  enableSandbox?: boolean;
  /** 单轮最大并发判题数（上限为后端线程池大小） */
  maxConcurrent: number;
  /** 线程池大小，仅用于前端展示取值上限 */
  threadPoolSize: number;
  queueBatchSize?: number;
  pollIntervalMs?: number;
  domjudgeBaseUrl?: string;
  hasDomjudgeApiKey?: boolean;
  domjudgeContestId?: string;
  domjudgePollIntervalMs?: number;
}

export interface OjState {
  problems: Problem[];
  contests: Contest[];
  ratings: RatingUser[];
  carouselSlides: CarouselSlide[];
  submissions: SubmissionSummary[];
  activeUser: UserProfile | null;
  /** 判题配置（来自 /api/v1/settings/judge），未加载到时默认开关开启 */
  judgeSettings?: JudgeSettings;
}
