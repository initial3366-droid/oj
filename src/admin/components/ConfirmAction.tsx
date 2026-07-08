import { ReactNode } from 'react';
import { showConfirm } from '../../utils/confirm';

interface ConfirmActionProps {
  title?: string;
  content?: ReactNode;
  onOk: () => void | Promise<void>;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
  type?: 'warning' | 'info' | 'success' | 'error';
}

export function confirmAction({
  title = '确认操作',
  content = '您确定要执行此操作吗？',
  onOk,
  onCancel,
  okText = '确定',
  cancelText = '取消',
  type = 'warning',
}: ConfirmActionProps) {
  return showConfirm({
    title,
    content,
    okText,
    cancelText,
    onOk: async () => {
      await onOk();
    },
    onCancel,
    simple: false,
  });
}

// 快捷方法
export const ConfirmAction = {
  delete: (onOk: () => void | Promise<void>, title = '确认删除') => {
    return confirmAction({
      title,
      content: '删除后将无法恢复，确定要继续吗？',
      onOk,
      type: 'warning',
    });
  },

  submit: (onOk: () => void | Promise<void>, title = '确认提交') => {
    return confirmAction({
      title,
      content: '确定要提交吗？',
      onOk,
      type: 'info',
    });
  },

  reset: (onOk: () => void | Promise<void>, title = '确认重置') => {
    return confirmAction({
      title,
      content: '重置后所有未保存的修改将丢失，确定要继续吗？',
      onOk,
      type: 'warning',
    });
  },
};
