/**
 * toast工具模块。提供无页面依赖的通用处理能力。
 */
// 简单的 Toast 工具，避免 Arco Design 在 React 18 中的兼容性问题
type ToastType = 'success' | 'error' | 'info';

/**
 * 封装showToast相关逻辑。会更新 React 状态并触发重新渲染。
 */
function showToast(message: string, type: ToastType) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? '#00b42a' : type === 'error' ? '#f53f3f' : '#165dff'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    font-size: 14px;
    animation: slideDown 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

export const toast = {
  success: (message: string) => showToast(message, 'success'),
  error: (message: string) => showToast(message, 'error'),
  info: (message: string) => showToast(message, 'info'),
};

// 添加动画样式
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
