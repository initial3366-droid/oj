import { Avatar, Tooltip } from '@douyinfe/semi-ui';
import { IconUser } from '@douyinfe/semi-icons';

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
