/** Frontend navigation. All route and account actions remain local to this component. */
import { useEffect, useState } from 'react';
import { Menu as MenuIcon, LogOut, Settings, UserRound, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/motion/button/base';
import { useOjData } from '../data/OjDataProvider';
import { logout as logoutFrontend } from '../api/auth';
import './FrontHeader.css';

const navItems = [
  { key: 'home', label: '首页', path: '/' },
  { key: 'problems', label: '题库', path: '/problems' },
  { key: 'practice', label: '题单', path: '/practice' },
  { key: 'contests', label: '比赛', path: '/contests' },
  { key: 'submission-queue', label: '提交队列', path: '/submission-queue' },
  { key: 'leaderboard', label: '排行榜', path: '/leaderboard' },
];

export function FrontHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useOjData();
  const [siteTitle, setSiteTitle] = useState('QOJ 在线评测系统');
  const [siteLogo, setSiteLogo] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const isLoggedIn = state.activeUser !== null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/settings/frontend')
      .then((response) => response.json())
      .then((body) => {
        if (cancelled || body?.code !== 200) return;
        setSiteTitle(body.data?.siteTitle || 'QOJ 在线评测系统');
        setSiteLogo(body.data?.siteLogo || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const activeKey = location.pathname === '/' ? 'home' : navItems.find((item) => item.path !== '/' && location.pathname.startsWith(item.path))?.key;
  const handleLogout = async () => {
    await logoutFrontend().catch(() => undefined);
    setUserMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <header className="front-header">
      <div className="front-header-inner">
        <Button variant="ghost" className="front-brand" onClick={() => navigate('/')} aria-label={siteTitle}>
          <span className="front-brand-mark">
            {siteLogo ? <img src={siteLogo} alt="" onError={() => setSiteLogo('')} /> : 'OJ'}
          </span>
          <span className="front-brand-title">{siteTitle}</span>
        </Button>

        <nav className="front-header-nav" aria-label="主导航">
          {navItems.map((item) => (
            <Button key={item.key} variant="ghost" size="sm" className={`front-header-link${activeKey === item.key ? ' is-active' : ''}`} aria-current={activeKey === item.key ? 'page' : undefined} onClick={() => navigate(item.path)}>
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="front-header-actions">
          <Button variant="ghost" size="icon" className="front-header-menu-toggle" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={19} /> : <MenuIcon size={19} />}
          </Button>
          {isLoggedIn ? (
            <div className="front-header-user-wrap">
              <Button variant="ghost" className="front-header-user" aria-label="用户菜单" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((open) => !open)}>
                <span className="front-header-avatar">
                  {state.activeUser?.avatarUrl ? <img src={state.activeUser.avatarUrl} alt="" /> : (state.activeUser?.displayName || state.activeUser?.username || 'U').slice(0, 2).toUpperCase()}
                </span>
                <span className="front-header-username">{state.activeUser?.displayName || state.activeUser?.username || '用户'}</span>
              </Button>
              {userMenuOpen && <div className="front-header-user-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); navigate('/user-center'); }}><UserRound size={16} />个人中心</button>
                <button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); navigate('/user-center?tab=settings'); }}><Settings size={16} />设置</button>
                <button type="button" role="menuitem" onClick={() => { void handleLogout(); }}><LogOut size={16} />退出登录</button>
              </div>}
            </div>
          ) : (
            <div className="front-header-auth">
              <Button variant="ghost" className={`front-header-login${location.pathname === '/login' ? ' is-active' : ''}`} onClick={() => navigate('/login')}>登录</Button>
              <Button variant="primary" className="front-header-register" onClick={() => navigate('/register')}>注册</Button>
            </div>
          )}
        </div>
      </div>
      {menuOpen && <nav className="front-header-mobile-nav" aria-label="手机导航">
        {navItems.map((item) => <Button key={item.key} variant="ghost" className={activeKey === item.key ? 'is-active' : ''} aria-current={activeKey === item.key ? 'page' : undefined} onClick={() => { setMenuOpen(false); navigate(item.path); }}>{item.label}</Button>)}
      </nav>}
    </header>
  );
}
