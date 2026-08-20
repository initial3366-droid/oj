/**
 * 写入剪贴板。HTTP 页面使用同步选区复制，避免依赖安全上下文。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  // Clipboard API 只能在安全上下文中可靠使用；失败时不再继续异步降级，避免丢失点击手势。
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  if (!document.body || typeof document.execCommand !== 'function') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);

  const activeElement = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  let copyEventFired = false;
  const handleCopy = (event: ClipboardEvent) => {
    copyEventFired = true;
    if (event.clipboardData) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
    }
  };

  let commandAccepted = false;
  document.addEventListener('copy', handleCopy);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    commandAccepted = document.execCommand('copy');
  } catch {
    commandAccepted = false;
  } finally {
    document.removeEventListener('copy', handleCopy);
    textarea.remove();

    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
    if (activeElement && activeElement !== document.body) {
      activeElement.focus({ preventScroll: true });
    }
  }

  return commandAccepted && copyEventFired;
}
