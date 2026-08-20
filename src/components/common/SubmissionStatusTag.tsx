/**
 * 提交状态Tag组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Tag } from 'antd';
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  WarningOutlined,
} from '@ant-design/icons';

/**
 * 提交状态类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type SubmissionStatus =
  | 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE'
  | 'PENDING' | 'JUDGING' | 'SYSTEM_ERROR'
  | string;

/**
 * 提交状态TagProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
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
  /**
   * 读取状态配置并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getStatusConfig = (stat: string) => {
    const normalized = stat.toUpperCase();

    // AC - 通过
    if (normalized === 'AC' || normalized === 'ACCEPTED') {
      return {
        color: 'green' as const,
        text: 'Accepted',
        icon: <CheckOutlined />,
      };
    }

    // WA - 答案错误
    if (normalized === 'WA' || normalized === 'WRONG_ANSWER') {
      return {
        color: 'red' as const,
        text: 'Wrong Answer',
        icon: <CloseOutlined />,
      };
    }

    // TLE - 超时
    if (normalized === 'TLE' || normalized === 'TIME_LIMIT_EXCEEDED') {
      return {
        color: 'orange' as const,
        text: 'Time Limit Exceeded',
        icon: <ClockCircleOutlined />,
      };
    }

    // MLE - 内存超限
    if (normalized === 'MLE' || normalized === 'MEMORY_LIMIT_EXCEEDED') {
      return {
        color: 'orange' as const,
        text: 'Memory Limit Exceeded',
        icon: <WarningOutlined />,
      };
    }

    // RE - 运行错误
    if (normalized === 'RE' || normalized === 'RUNTIME_ERROR') {
      return {
        color: 'red' as const,
        text: 'Runtime Error',
        icon: <CloseOutlined />,
      };
    }

    // CE - 编译错误
    if (normalized === 'CE' || normalized === 'COMPILE_ERROR' || normalized === 'COMPILATION_ERROR') {
      return {
        color: 'red' as const,
        text: 'Compile Error',
        icon: <CloseOutlined />,
      };
    }

    // WAITING - 队列等待
    if (normalized === 'WAITING') {
      return {
        color: 'blue' as const,
        text: 'Waiting',
        icon: <ClockCircleOutlined />,
      };
    }

    // PENDING - 等待测评
    if (normalized === 'PENDING' || normalized === 'QUEUED') {
      return {
        color: 'blue' as const,
        text: 'Pending',
        icon: <ClockCircleOutlined />,
      };
    }

    // REJUDGE_PENDING - 等待重判
    if (normalized === 'REJUDGE_PENDING') {
      return {
        color: 'blue' as const,
        text: 'Rejudge Pending',
        icon: <ClockCircleOutlined />,
      };
    }

    // COMPILING - 编译中
    if (normalized === 'COMPILING') {
      return {
        color: 'blue' as const,
        text: 'Compiling',
        icon: <ClockCircleOutlined />,
      };
    }

    // JUDGING - 测评中
    if (normalized === 'JUDGING' || normalized === 'RUNNING') {
      return {
        color: 'blue' as const,
        text: normalized === 'RUNNING' ? 'Running' : 'Judging',
        icon: <ClockCircleOutlined />,
      };
    }

    // SYSTEM_ERROR - 系统错误
    if (normalized === 'SYSTEM_ERROR' || normalized === 'SE') {
      return {
        color: 'grey' as const,
        text: 'System Error',
        icon: <WarningOutlined />,
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
      color={config.color === 'grey' ? 'default' : config.color}
      icon={showIcon ? config.icon : undefined}
      style={{ fontWeight: 500, fontSize: size === 'small' ? 12 : undefined }}
    >
      {config.text}
    </Tag>
  );
}
