/**
 * 全局状态管理（Context + localStorage 持久化）。
 *
 * 数据流：
 * 1. 初始化：从 localStorage 读取缓存 → 如果无缓存则用默认空状态
 * 2. 挂载时：调用 hydrateStateFromApi() 从后端拉取最新数据并合并
 * 3. 合并后：写回 localStorage 保证下次加载时数据一致
 * 4. 手动更新：updateState() 同时更新 React state 和 localStorage
 *
 * 提供的上下文值：
 * - state：全局 OjState（用户、题目、比赛、榜单、轮播图等）
 * - dailyProblem：根据 dailyMode/dailyProblemId 计算的每日一题
 * - 各种 updater 函数（setDailyMode、upsertSlide 等）
 */
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { hydrateStateFromApi } from "./apiClient";
import type {
  CarouselSlide,
  Contest,
  OjState,
} from "./types";

const STORAGE_KEY = "qoj.frontend.state.v1";

const defaultOjState: OjState = {
  activeUser: null,
  problems: [],
  contests: [],
  ratings: [],
  submissions: [],
  carouselSlides: [],
  judgeSettings: { enabled: true, enableSandbox: false },
};

/**
 * OjDataContext值接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface OjDataContextValue {
  state: OjState;
  updateState: (updater: (current: OjState) => OjState) => void;
  upsertSlide: (slide: CarouselSlide) => void;
  removeSlide: (slideId: string) => void;
  upsertContest: (contest: Contest) => void;
  removeContest: (contestId: string) => void;
}

const OjDataContext = createContext<OjDataContextValue | null>(null);

/**
 * 创建或提交标识。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/**
 * 读取InitialState并返回给调用方。会读写浏览器本地会话信息。
 */
function getInitialState(): OjState {
  if (typeof window === "undefined") {
    return defaultOjState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaultOjState;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return defaultOjState;
  }
}

/**
 * 渲染OjDataProvider组件，并协调其数据加载、状态和交互。
 */
export function OjDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OjState>(getInitialState);

  useEffect(() => {
    let cancelled = false;
    hydrateStateFromApi(state).then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    /**
     * 重置有效用户。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
     */
    const clearActiveUser = () => {
      setState((current) => {
        const next = { ...current, activeUser: null };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("qoj:auth-cleared", clearActiveUser);
    return () => window.removeEventListener("qoj:auth-cleared", clearActiveUser);
  }, []);

  /**
   * 更新State。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
   */
  const updateState = (updater: (current: OjState) => OjState) => {
    setState((current) => {
      const next = updater(current);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  /**
   * 封装值相关逻辑。对原始数据进行派生或聚合。
   */
  const value = useMemo<OjDataContextValue>(() => {
    return {
      state,
      updateState,
      upsertSlide: (slide) =>
        updateState((current) => {
          const normalized = {
            ...slide,
            id: slide.id || createId("slide"),
          };
          const exists = current.carouselSlides.some(
            (item) => item.id === normalized.id,
          );
          return {
            ...current,
            carouselSlides: exists
              ? current.carouselSlides.map((item) =>
                  item.id === normalized.id ? normalized : item,
                )
              : [...current.carouselSlides, normalized],
          };
        }),
      removeSlide: (slideId) =>
        updateState((current) => ({
          ...current,
          carouselSlides: current.carouselSlides.filter(
            (slide) => slide.id !== slideId,
          ),
        })),
      upsertContest: (contest) =>
        updateState((current) => {
          const normalized = {
            ...contest,
            id: contest.id || createId("contest"),
          };
          const exists = current.contests.some((item) => item.id === normalized.id);
          return {
            ...current,
            contests: exists
              ? current.contests.map((item) =>
                  item.id === normalized.id ? normalized : item,
                )
              : [...current.contests, normalized],
          };
        }),
      removeContest: (contestId) =>
        updateState((current) => ({
          ...current,
          contests: current.contests.filter((contest) => contest.id !== contestId),
        })),
    };
  }, [state]);

  return <OjDataContext.Provider value={value}>{children}</OjDataContext.Provider>;
}

/**
 * 封装OjData相关逻辑。失败时向调用方传播异常。
 */
export function useOjData() {
  const context = useContext(OjDataContext);
  if (!context) {
    throw new Error("useOjData must be used within OjDataProvider");
  }
  return context;
}
