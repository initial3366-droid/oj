/**
 * 状态Tag组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Tag } from '@arco-design/web-react';

/**
 * 状态TagProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface StatusTagProps {
  status: string;
  colorMap?: Record<string, string>;
}

const defaultColorMap: Record<string, string> = {
  // 通用状态
  success: 'green',
  pending: 'orange',
  error: 'red',
  warning: 'orange',
  info: 'blue',

  // 提交状态
  AC: 'green',
  WA: 'red',
  TLE: 'orange',
  MLE: 'orange',
  RE: 'red',
  CE: 'red',
  PE: 'orange',
  JUDGING: 'blue',

  // 比赛状态
  NOT_STARTED: 'blue',
  RUNNING: 'green',
  ENDED: 'gray',

  // 用户角色
  SUPER_ADMIN: 'red',
  STUDENT: 'green',
};

/**
 * 渲染状态Tag组件，并协调其数据加载、状态和交互。
 */
export function StatusTag({ status, colorMap }: StatusTagProps) {
  const finalColorMap = { ...defaultColorMap, ...colorMap };
  const color = finalColorMap[status] || 'gray';

  return <Tag color={color}>{status}</Tag>;
}
