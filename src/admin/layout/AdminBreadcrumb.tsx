import { Breadcrumb } from '@arco-design/web-react';
import { useLocation, Link } from 'react-router-dom';
import { adminPath } from '../../utils/adminPath';

const routeMap: Record<string, string> = {
  [adminPath('')]: '首页',
  [adminPath('/dashboard')]: 'Dashboard',
  [adminPath('/users')]: '用户管理',
  [adminPath('/users/students')]: '学生列表',
  [adminPath('/problems')]: '题目管理',
  [adminPath('/problems/new')]: '添加题目',
  [adminPath('/problem-folders')]: '题目文件夹',
  [adminPath('/practices')]: '题单管理',
  [adminPath('/practices/new')]: '创建题单',
  [adminPath('/contests')]: '比赛管理',
  [adminPath('/contests/new')]: '创建比赛',
  [adminPath('/contests/rankings')]: '比赛排行',
  [adminPath('/submissions')]: '提交管理',
  [adminPath('/submissions/statistics')]: '提交统计',
  [adminPath('/submission-queue')]: '提交队列',
  [adminPath('/judge/queue')]: '判题队列',
  [adminPath('/judge/config')]: '判题配置',
  [adminPath('/leaderboard')]: '全站榜单',
  [adminPath('/settings/frontend')]: '前端配置',
  [adminPath('/settings/register')]: '注册配置',
  [adminPath('/settings/system')]: '系统配置',
  [adminPath('/settings/announcements')]: '公告管理',
  [adminPath('/profile')]: '个人信息',
};

export function AdminBreadcrumb() {
  const location = useLocation();
  const pathSnippets = location.pathname.split('/').filter((i) => i);

  const breadcrumbItems = pathSnippets.map((_, index) => {
    const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
    const routeName = routeMap[url] || pathSnippets[index];

    return (
      <Breadcrumb.Item key={url}>
        {index === pathSnippets.length - 1 ? (
          <span>{routeName}</span>
        ) : (
          <Link to={url} style={{ color: '#4e5969', textDecoration: 'none' }}>
            {routeName}
          </Link>
        )}
      </Breadcrumb.Item>
    );
  });

  return (
    <Breadcrumb style={{ marginBottom: '16px' }}>
      {breadcrumbItems}
    </Breadcrumb>
  );
}
