/**
 * NotFound页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Button } from '../components/motion/button/base';
import { ArrowLeft } from 'lucide-react';

/**
 * 渲染NotFound页面，并协调其数据加载、状态和交互。
 */
export function NotFoundPage() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--qoj-color-fill-0)',
        padding: 24,
      }}
    >
      <div
        style={{ maxWidth: 448, padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, border: '1px solid var(--qoj-color-border)', borderRadius: 24, background: '#fff', boxShadow: '0 18px 60px rgba(20, 46, 91, .07)' }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
          }}
        >
          404
        </span>
        <h1 style={{ margin: 0, fontSize: 28 }}>
          页面不存在
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--qoj-color-text-2)' }}>
          每个主要界面都已经拥有独立 URL，请从首页重新进入。
        </p>
        <Button
          onClick={() => {
            window.location.href = '/';
          }}
        >
          <ArrowLeft size={16} /> 回到首页
        </Button>
      </div>
    </div>
  );
}
