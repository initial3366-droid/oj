import { Tag } from '@arco-design/web-react';

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
  GUEST: 'gray',
};

export function StatusTag({ status, colorMap }: StatusTagProps) {
  const finalColorMap = { ...defaultColorMap, ...colorMap };
  const color = finalColorMap[status] || 'gray';

  return <Tag color={color}>{status}</Tag>;
}
