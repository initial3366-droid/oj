import { Tag } from '@douyinfe/semi-ui';
import { IconClock, IconPlay, IconStop } from '@douyinfe/semi-icons';

type ContestStatus = 'NOT_STARTED' | 'RUNNING' | 'ENDED' | string;

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
