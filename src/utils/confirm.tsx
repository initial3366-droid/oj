import { Modal } from '@arco-design/web-react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

interface ConfirmOptions {
  title?: string;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
  okButtonProps?: Record<string, unknown>;
  simple?: boolean;
}

/**
 * React 19 兼容的确认弹窗。
 * Arco Design 的 Modal.confirm 内部使用已被 React 19 移除的 ReactDOM.render，
 * 此工具函数使用 createRoot 替代，功能完全一致。
 */
export function showConfirm(options: ConfirmOptions) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    // 延迟 unmount 让 Modal 的关闭动画播放完
    setTimeout(() => {
      root.unmount();
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    }, 300);
  };

  const handleOk = async () => {
    try {
      await options.onOk?.();
      cleanup();
    } catch {
      cleanup();
    }
  };

  const handleCancel = () => {
    options.onCancel?.();
    cleanup();
  };

  root.render(
    <Modal
      visible
      title={options.title}
      okText={options.okText}
      cancelText={options.cancelText}
      okButtonProps={options.okButtonProps}
      simple={options.simple}
      onOk={handleOk}
      onCancel={handleCancel}
      afterOpen={() => {}}
    >
      {options.content}
    </Modal>
  );
}
