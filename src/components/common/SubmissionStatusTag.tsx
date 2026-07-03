import { Tag } from '@douyinfe/semi-ui';
import { IconTick, IconClock, IconClose, IconAlertTriangle } from '@douyinfe/semi-icons';

type SubmissionStatus =
  | 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE'
  | 'PENDING' | 'JUDGING' | 'SYSTEM_ERROR'
  | string;

interface SubmissionStatusTagProps {
  status: SubmissionStatus;
  size?: 'small' | 'default' | 'large';
  showIcon?: boolean;
}

/**
 * 提交状态标签组件
 * AC-绿色、WA/RE/CE-红色、TLE/MLE-橙色、WAITING/PENDING/JUDGING-蓝色
 */
export function SubmissionStatusTag({
  status,
  size = 'default',
  showIcon = true,
}: SubmissionStatusTagProps) {
  const getStatusConfig = (stat: string) => {
    const normalized = stat.toUpperCase();

    // AC - 通过
    if (normalized === 'AC' || normalized === 'ACCEPTED') {
      return {
        color: 'green' as const,
        text: 'AC',
        icon: <IconTick />,
      };
    }

    // WA - 答案错误
    if (normalized === 'WA' || normalized === 'WRONG_ANSWER') {
      return {
        color: 'red' as const,
        text: 'WA',
        icon: <IconClose />,
      };
    }

    // TLE - 超时
    if (normalized === 'TLE' || normalized === 'TIME_LIMIT_EXCEEDED') {
      return {
        color: 'orange' as const,
        text: 'TLE',
        icon: <IconClock />,
      };
    }

    // MLE - 内存超限
    if (normalized === 'MLE' || normalized === 'MEMORY_LIMIT_EXCEEDED') {
      return {
        color: 'orange' as const,
        text: 'MLE',
        icon: <IconAlertTriangle />,
      };
    }

    // RE - 运行错误
    if (normalized === 'RE' || normalized === 'RUNTIME_ERROR') {
      return {
        color: 'red' as const,
        text: 'RE',
        icon: <IconClose />,
      };
    }

    // CE - 编译错误
    if (normalized === 'CE' || normalized === 'COMPILE_ERROR' || normalized === 'COMPILATION_ERROR') {
      return {
        color: 'red' as const,
        text: 'CE',
        icon: <IconClose />,
      };
    }

    // WAITING - 队列等待
    if (normalized === 'WAITING') {
      return {
        color: 'blue' as const,
        text: '队列中',
        icon: <IconClock />,
      };
    }

    // PENDING - 等待测评
    if (normalized === 'PENDING' || normalized === 'QUEUED') {
      return {
        color: 'blue' as const,
        text: '等待测评',
        icon: <IconClock />,
      };
    }

    // REJUDGE_PENDING - 等待重判
    if (normalized === 'REJUDGE_PENDING') {
      return {
        color: 'blue' as const,
        text: '等待重判',
        icon: <IconClock />,
      };
    }

    // COMPILING - 编译中
    if (normalized === 'COMPILING') {
      return {
        color: 'blue' as const,
        text: '编译中',
        icon: <IconClock />,
      };
    }

    // JUDGING - 测评中
    if (normalized === 'JUDGING' || normalized === 'RUNNING') {
      return {
        color: 'blue' as const,
        text: '测评中',
        icon: <IconClock />,
      };
    }

    // SYSTEM_ERROR - 系统错误
    if (normalized === 'SYSTEM_ERROR' || normalized === 'SE') {
      return {
        color: 'grey' as const,
        text: '系统错误',
        icon: <IconAlertTriangle />,
      };
    }

    // 默认
    return {
      color: 'grey' as const,
      text: status,
      icon: null,
    };
  };

  const config = getStatusConfig(status);

  return (
    <Tag
      color={config.color}
      size={size}
      prefixIcon={showIcon ? config.icon : undefined}
      style={{ fontWeight: 500 }}
    >
      {config.text}
    </Tag>
  );
}
