import { Menu } from '@arco-design/web-react';
import {
  IconDashboard,
  IconUser,
  IconBook,
  IconFile,
  IconCalendar,
  IconCode,
  IconCommand,
  IconTrophy,
  IconUserGroup,
  IconSettings,
} from '@arco-design/web-react/icon';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminPath } from '../../utils/adminPath';

const MenuItem = Menu.Item;
const SubMenu = Menu.SubMenu;

interface AdminSiderProps {
  userRole: 'SUPER_ADMIN';
}

const PATHS = {
  dashboard: adminPath('/dashboard'),
  users: adminPath('/users'),
  students: adminPath('/users/students'),
  teachers: adminPath('/users/teachers'),
  problems: adminPath('/problems'),
  problemsNew: adminPath('/problems/new'),
  problemFolders: adminPath('/problem-folders'),
  practices: adminPath('/practices'),
  practicesNew: adminPath('/practices/new'),
  contests: adminPath('/contests'),
  contestsNew: adminPath('/contests/new'),
  contestsRankings: adminPath('/contests/rankings'),
  submissions: adminPath('/submissions'),
  submissionsStats: adminPath('/submissions/statistics'),
  judgeQueue: adminPath('/judge/queue'),
  judgeConfig: adminPath('/judge/config'),
  leaderboard: adminPath('/leaderboard'),
  classes: adminPath('/classes'),
  settingsFrontend: adminPath('/settings/frontend'),
  settingsRegister: adminPath('/settings/register'),
  settingsSystem: adminPath('/settings/system'),
  settingsAnnouncements: adminPath('/settings/announcements'),
};

export function AdminSider({ userRole }: AdminSiderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith(PATHS.classes + '/')) {
      setSelectedKeys([PATHS.classes]);
      return;
    }
    if (path.startsWith(PATHS.problemFolders + '/')) {
      setSelectedKeys([PATHS.problemFolders]);
      return;
    }
    setSelectedKeys([path]);
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    const openKeysMap: Record<string, string> = {
      [PATHS.users]: 'users-menu',
      [PATHS.problems]: 'problems-menu',
      [PATHS.problemFolders]: 'problems-menu',
      [PATHS.practices]: 'practices-menu',
      [PATHS.contests]: 'contests-menu',
      [PATHS.submissions]: 'submissions-menu',
      [adminPath('/judge')]: 'judge-menu',
      [PATHS.classes]: 'classes-menu',
      [adminPath('/settings')]: 'settings-menu',
    };

    for (const [prefix, key] of Object.entries(openKeysMap)) {
      if (path.includes(prefix)) {
        setOpenKeys([key]);
        break;
      }
    }
  }, []);

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  const isMenuVisible = (menuKey: string): boolean => {
    if (userRole === 'SUPER_ADMIN') return true;
    return false;
  };

  return (
    <Menu
      style={{ width: '100%', height: '100%', overflowY: 'hidden' }}
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onClickMenuItem={handleMenuClick}
      onClickSubMenu={(key, openKeys) => setOpenKeys(openKeys as string[])}
    >
      <MenuItem key={PATHS.dashboard}>
        <IconDashboard />
        Dashboard
      </MenuItem>

      {isMenuVisible('users-menu') && (
        <SubMenu key="users-menu" title={<><IconUser />用户管理</>}>
          <MenuItem key={PATHS.students}>学生列表</MenuItem>
          <MenuItem key={PATHS.teachers}>教师列表</MenuItem>
        </SubMenu>
      )}

      {isMenuVisible('problems-menu') && (
        <SubMenu key="problems-menu" title={<><IconBook />题目管理</>}>
          <MenuItem key={PATHS.problems}>题目列表</MenuItem>
          <MenuItem key={PATHS.problemsNew}>添加题目</MenuItem>
          <MenuItem key={PATHS.problemFolders}>题目文件夹</MenuItem>
        </SubMenu>
      )}

      {isMenuVisible('practices-menu') && (
        <SubMenu key="practices-menu" title={<><IconFile />题单管理</>}>
          <MenuItem key={PATHS.practices}>题单列表</MenuItem>
          <MenuItem key={PATHS.practicesNew}>创建题单</MenuItem>
        </SubMenu>
      )}

      {isMenuVisible('contests-menu') && (
        <SubMenu key="contests-menu" title={<><IconCalendar />比赛管理</>}>
          <MenuItem key={PATHS.contests}>比赛列表</MenuItem>
          <MenuItem key={PATHS.contestsNew}>创建比赛</MenuItem>
          <MenuItem key={PATHS.contestsRankings}>比赛排行</MenuItem>
        </SubMenu>
      )}

      {isMenuVisible('submissions-menu') && (
        <SubMenu key="submissions-menu" title={<><IconCode />提交管理</>}>
          <MenuItem key={PATHS.submissions}>提交列表</MenuItem>
          <MenuItem key={PATHS.submissionsStats}>提交统计</MenuItem>
        </SubMenu>
      )}

      {isMenuVisible('judge-menu') && (
        <SubMenu key="judge-menu" title={<><IconCommand />判题管理</>}>
          <MenuItem key={PATHS.judgeQueue}>判题队列</MenuItem>
          <MenuItem key={PATHS.judgeConfig}>判题配置</MenuItem>
        </SubMenu>
      )}

      {isMenuVisible('leaderboard') && (
        <MenuItem key={PATHS.leaderboard}>
          <IconTrophy />
          全站榜单
        </MenuItem>
      )}

      {isMenuVisible('organizations-menu') && (
        <MenuItem key={PATHS.classes}>
          <IconUserGroup />
          班级管理
        </MenuItem>
      )}

      {isMenuVisible('settings-menu') && (
        <SubMenu key="settings-menu" title={<><IconSettings />系统设置</>}>
          <MenuItem key={PATHS.settingsFrontend}>前端配置</MenuItem>
          <MenuItem key={PATHS.settingsRegister}>注册配置</MenuItem>
          <MenuItem key={PATHS.settingsSystem}>系统配置</MenuItem>
          <MenuItem key={PATHS.settingsAnnouncements}>公告管理</MenuItem>
        </SubMenu>
      )}
    </Menu>
  );
}
