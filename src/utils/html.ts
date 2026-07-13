const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
]);

const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'poster',
  'action',
  'formaction',
  'xlink:href',
]);

function isSafeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const url = new URL(trimmed, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isSafeStyle(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  return !normalized.includes('expression(')
    && !normalized.includes('javascript:')
    && !normalized.includes('vbscript:')
    && !normalized.includes('url(');
}

/**
 * 前端渲染公告 HTML 前的轻量白净化。
 *
 * 注意：后端公告是管理员输入，风险边界较小；这里仍去掉脚本标签、事件属性、
 * 危险协议和危险 inline style，避免最常见的 XSS 入口。
 */
export function sanitizeAnnouncementHtml(html: string) {
  if (!html) {
    return '';
  }
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = Array.from(doc.body.querySelectorAll('*'));

  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const attrName = attribute.name.toLowerCase();
      const attrValue = attribute.value;

      if (
        attrName.startsWith('on')
        || attrName === 'srcdoc'
        || attrName === 'srcset'
        || (attrName === 'style' && !isSafeStyle(attrValue))
        || (URL_ATTRIBUTES.has(attrName) && !isSafeUrl(attrValue))
      ) {
        element.removeAttribute(attribute.name);
      }
    }

    if (tagName === 'a') {
      element.setAttribute('rel', 'noopener noreferrer');
      if (element.getAttribute('href')) {
        element.setAttribute('target', '_blank');
      }
    }
  }

  return doc.body.innerHTML;
}

export function stripHtmlForPreview(html: string) {
  if (!html) {
    return '';
  }
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, '').trim();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
