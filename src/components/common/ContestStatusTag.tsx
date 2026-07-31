/**
 * 比赛状态Tag组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Tag } from '@douyinfe/semi-ui';
import { IconClock, IconPlay, IconStop } from '@douyinfe/semi-icons';

/**
 * 比赛状态类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type ContestStatus = 'NOT_STARTED' | 'RUNNING' | 'ENDED' | string;

/**
 * 比赛状态TagProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ContestStatusTagProps {
  status: ContestStatus;
  size?: 'small' | 'default' | 'large';
  showIcon?: boolean;
}

/**
 * 比赛状态标签组件
 * 未开始-蓝色、进行中-绿色、已结束-灰色
 */
export function ContestStatusTag({
  status,
  size = 'default',
  showIcon = true,
}: ContestStatusTagProps) {
  /**
   * 读取状态配置并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getStatusConfig = (stat: string) => {
    const normalized = stat.toUpperCase();

    if (normalized === 'NOT_STARTED' || normalized === 'UPCOMING') {
      return {
        color: 'blue' as const,
        text: '未开始',
        icon: <IconClock />,
      };
    }

    if (normalized === 'RUNNING' || normalized === 'ONGOING' || normalized === 'LIVE') {
      return {
        color: 'green' as const,
        text: '进行中',
        icon: <IconPlay />,
      };
    }

    if (normalized === 'ENDED' || normalized === 'FINISHED') {
      return {
        color: 'grey' as const,
        text: '已结束',
        icon: <IconStop />,
      };
    }

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
