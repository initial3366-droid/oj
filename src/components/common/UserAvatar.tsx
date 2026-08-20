/**
 * 用户头像组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Avatar, Tooltip } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const AVATAR_SIZE_MAP: Record<string, number> = {
  'extra-extra-small': 24,
  'extra-small': 28,
  small: 32,
  default: 40,
  medium: 48,
  large: 56,
  'extra-large': 64,
};

const AVATAR_COLOR_MAP: Record<string, string> = {
  amber: '#fbbf24',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  indigo: '#6366f1',
  'light-blue': '#38bdf8',
  'light-green': '#a3e635',
  lime: '#84cc16',
  orange: '#f97316',
  pink: '#ec4899',
  purple: '#a855f7',
  red: '#ef4444',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  yellow: '#eab308',
};

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
      size={AVATAR_SIZE_MAP[size]}
      src={avatarUrl}
      alt={username}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: AVATAR_COLOR_MAP[getColorFromUsername(username)],
        ...style,
      }}
    >
      {!avatarUrl && (username.charAt(0).toUpperCase() || <UserOutlined />)}
    </Avatar>
  );

  if (showTooltip) {
    return (
      <Tooltip title={username} placement="top">
        {avatarElement}
      </Tooltip>
    );
  }

  return avatarElement;
}
