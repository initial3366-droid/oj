/**
 * 用户头像组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Avatar, Tooltip } from '@douyinfe/semi-ui';
import { IconUser } from '@douyinfe/semi-icons';

/**
 * 用户头像Props接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface UserAvatarProps {
  username: string;
  avatarUrl?: string;
  size?: 'extra-extra-small' | 'extra-small' | 'small' | 'default' | 'medium' | 'large' | 'extra-large';
  showTooltip?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * 用户头像组件
 * 统一的用户头像展示
 */
export function UserAvatar({
  username,
  avatarUrl,
  size = 'default',
  showTooltip = true,
  onClick,
  style,
}: UserAvatarProps) {
  /**
   * 读取ColorFromUsername并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getColorFromUsername = (name: string) => {
    const colors: Array<'amber' | 'blue' | 'cyan' | 'green' | 'indigo' | 'light-blue' | 'light-green' | 'lime' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'violet' | 'yellow'> = [
      'amber',
      'blue',
      'cyan',
      'green',
      'indigo',
      'light-blue',
      'light-green',
      'lime',
      'orange',
      'pink',
      'purple',
      'red',
      'teal',
      'violet',
      'yellow',
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const avatarElement = (
    <Avatar
      size={size}
      src={avatarUrl}
      alt={username}
      color={getColorFromUsername(username)}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {!avatarUrl && (username.charAt(0).toUpperCase() || <IconUser />)}
    </Avatar>
  );

  if (showTooltip) {
    return (
      <Tooltip content={username} position="top">
        {avatarElement}
      </Tooltip>
    );
  }

  return avatarElement;
}
