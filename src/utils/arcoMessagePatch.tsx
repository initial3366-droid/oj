/**
 * React 19 兼容补丁：覆盖 Arco Design Message 的静态方法。
 *
 * Arco Design 2.x 的 Message.success / error / info / warning / loading
 * 内部通过 ReactDOM.render 创建消息实例，而 React 19 已移除该方法，
 * 导致运行时报错 "MT.render is not a function"。
 *
 * 本模块使用 createRoot 重新实现这些静态方法，在 main.tsx 中尽早 import
 * 即可全局生效，无需修改业务代码中的 Message.xxx() 调用。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Message } from '@arco-design/web-react';

/**
 * 消息类型类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type MessageType = 'info' | 'success' | 'error' | 'warning' | 'loading';

/**
 * 消息配置接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface MessageConfig {
  content?: React.ReactNode;
  duration?: number;
  closable?: boolean;
  id?: string;
  position?: string;
  onClose?: () => void;
}

const DEFAULT_DURATION = 3000;

/**
 * 封装show消息相关逻辑。会更新 React 状态并触发重新渲染。
 */
function showMessage(type: MessageType, config: string | MessageConfig) {
  const opts: MessageConfig =
    typeof config === 'string' ? { content: config } : config;

  const duration = opts.duration ?? DEFAULT_DURATION;
  const content = opts.content ?? '';

  // 创建独立容器
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;top:0;left:0;width:100%;pointer-events:none;z-index:1003;display:flex;justify-content:center;padding-top:16px;';
  document.body.appendChild(div);

  const root = createRoot(div);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let unmounted = false;

  /**
   * 封装close相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const close = () => {
    if (unmounted) return;
    unmounted = true;
    if (timer) clearTimeout(timer);
    // 淡出动画
    div.style.transition = 'opacity 0.2s';
    div.style.opacity = '0';
    setTimeout(() => {
      try {
        root.unmount();
      } catch {
        // ignore
      }
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 200);
  };

  // 图标映射 — 使用 Arco 内置的 icon 组件
  const iconMap: Record<string, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
  };

  const colorMap: Record<string, string> = {
    success: '#00b42a',
    error: '#f53f3f',
    warning: '#ff7d00',
    info: '#165dff',
    loading: '#165dff',
  };

  root.render(
    React.createElement(
      'div',
      {
        style: {
          pointerEvents: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 16px',
          borderRadius: 4,
          backgroundColor: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: 14,
          lineHeight: '22px',
          color: '#1d2129',
          maxWidth: 480,
          animation: 'arcoMessageSlideIn 0.2s ease-out',
        },
      },
      React.createElement(
        'span',
        { style: { color: colorMap[type] || '#165dff', fontSize: 16, flexShrink: 0 } },
        iconMap[type] || ''
      ),
      React.createElement(
        'span',
        { style: { flex: 1 } },
        content
      ),
      opts.closable !== false
        ? React.createElement(
            'span',
            {
              onClick: close,
              style: {
                cursor: 'pointer',
                color: '#86909c',
                fontSize: 12,
                marginLeft: 8,
                flexShrink: 0,
              },
            },
            '✕'
          )
        : null
    )
  );

  // 注入动画 keyframes（只注入一次）
  if (!document.getElementById('arco-message-patch-keyframes')) {
    const style = document.createElement('style');
    style.id = 'arco-message-patch-keyframes';
    style.textContent = `
      @keyframes arcoMessageSlideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  if (duration > 0) {
    timer = setTimeout(close, duration);
  }

  return close;
}

// 覆盖 Arco 的静态方法
const methods: MessageType[] = ['info', 'success', 'error', 'warning', 'loading'];
methods.forEach((type) => {
  (Message as unknown as Record<string, unknown>)[type] = (config: string | MessageConfig) =>
    showMessage(type, config);
});

export {};
