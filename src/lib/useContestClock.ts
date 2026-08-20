/**
 * 比赛倒计时与阶段派生 Hook。统一处理比赛阶段（未开始/进行中/已结束）
 * 与倒计时展示；边界回调由调用方按需处理，结束后停止定时器。
 */
import { useEffect, useRef, useState } from "react";

/**
 * 比赛阶段类型。与后端状态 NOT_STARTED/RUNNING/ENDED 对应。
 */
export type ContestPhase = "not-started" | "running" | "ended";

/**
 * useContestClockOptions接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface UseContestClockOptions {
  startTime: string;
  endTime: string;
  status: string;
  onStartBoundaryCross?: () => void;
  onEndBoundaryCross?: () => void;
}

/**
 * useContestClockResult接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface UseContestClockResult {
  phase: ContestPhase;
  countdownLabel: string;
  countdownValue: string;
}

/**
 * 从后端状态派生初始阶段。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function initialPhase(status: string): ContestPhase {
  if (status === "RUNNING") return "running";
  if (status === "ENDED") return "ended";
  return "not-started";
}

/**
 * 格式化剩余时间为倒计时文案。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (days > 0) {
    return `${days}天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 统一派生比赛阶段与倒计时。跨越开赛/结束边界时分别调用对应回调一次，
 * 结束后停止定时器。
 */
export function useContestClock({ startTime, endTime, status, onStartBoundaryCross, onEndBoundaryCross }: UseContestClockOptions): UseContestClockResult {
  const [phase, setPhase] = useState<ContestPhase>(() => initialPhase(status));
  const [remaining, setRemaining] = useState(0);
  const startBoundaryNotified = useRef(false);
  const endBoundaryNotified = useRef(false);
  const onStartBoundaryCrossRef = useRef(onStartBoundaryCross);
  const onEndBoundaryCrossRef = useRef(onEndBoundaryCross);
  onStartBoundaryCrossRef.current = onStartBoundaryCross;
  onEndBoundaryCrossRef.current = onEndBoundaryCross;

  // 外部 status 变化（例如边界刷新后）时同步阶段并重置边界标记。
  useEffect(() => {
    setPhase(initialPhase(status));
    startBoundaryNotified.current = false;
    endBoundaryNotified.current = false;
  }, [status]);

  useEffect(() => {
    if (phase === "ended") {
      return;
    }

    /**
     * 更新剩余时间并检测边界跨越。会更新 React 状态并触发重新渲染。
     */
    const tick = () => {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      if (phase === "not-started") {
        const diff = start - now;
        setRemaining(diff);
        if (diff <= 0 && !startBoundaryNotified.current) {
          startBoundaryNotified.current = true;
          setPhase("running");
          onStartBoundaryCrossRef.current?.();
        }
        return;
      }
      const diff = end - now;
      setRemaining(diff);
      if (diff <= 0 && !endBoundaryNotified.current) {
        endBoundaryNotified.current = true;
        setPhase("ended");
        onEndBoundaryCrossRef.current?.();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [phase, startTime, endTime]);

  if (phase === "ended") {
    return { phase, countdownLabel: "", countdownValue: "" };
  }
  return {
    phase,
    countdownLabel: phase === "not-started" ? "距离开始" : "距离结束",
    countdownValue: formatCountdown(remaining),
  };
}
