import { Dropdown, Menu, Avatar, Space } from '@arco-design/web-react';
import { IconPoweroff, IconUser, IconSettings, IconIdcard } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { adminPath } from '../../utils/adminPath';

interface AdminHeaderProps {
  username: string;
  displayName: string;
  role: string;
  onLogout: () => void;
}

const roleNames: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  TEACHER: '教师',
  STUDENT: '学生',
  GUEST: '访客',
};

export function AdminHeader({ username, displayName, role, onLogout }: AdminHeaderProps) {
  const navigate = useNavigate();

  const droplist = (
    <Menu>
      <Menu.Item key="profile" onClick={() => navigate(adminPath('/profile'))}>
        <Space>
          <IconIdcard />
          <span>个人信息</span>
        </Space>
      </Menu.Item>
      <Menu.Item key="settings" onClick={() => navigate(adminPath('/settings/frontend'))}>
        <Space>
          <IconSettings />
          <span>系统设置</span>
        </Space>
      </Menu.Item>
      <div style={{ margin: '4px 12px', height: '1px', background: '#e5e6eb' }} />
      <Menu.Item key="logout" onClick={onLogout}>
        <Space>
          <IconPoweroff />
          <span>退出登录</span>
        </Space>
      </Menu.Item>
    </Menu>
  );

  return (
    <div
      style={{
        height: '60px',
        background: '#fff',
        borderBottom: '1px solid #e5e6eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}
    >
      <div style={{ fontSize: '16px', fontWeight: 500, color: '#1d2129' }}>
        后台管理
      </div>

      <Dropdown droplist={droplist} position="br">
        <Space style={{ cursor: 'pointer' }}>
          <Avatar size={32} style={{ backgroundColor: '#165dff' }}>
            {displayName.charAt(0)}
          </Avatar>
          <span style={{ fontSize: '14px', color: '#1d2129' }}>{displayName}</span>
        </Space>
      </Dropdown>
    </div>
  );
}
