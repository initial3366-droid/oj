/**
 * 公告Content组件。封装可复用的界面结构、展示规则及交互行为。
 */
import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import '../styles/announcement.css';

const SAFE_INLINE_STYLE_PROPERTIES = [
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'white-space',
] as const;

const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|@import|javascript:|var\s*\(/i;

/**
 * Sanitizes administrator-authored announcement HTML before it reaches React.
 * Inline styles are reduced to text-only formatting so an announcement cannot
 * cover the page, load remote CSS assets, or imitate application controls.
 */
export function sanitizeAnnouncementHtml(value: string) {
  const sanitized = DOMPurify.sanitize(value ?? '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['srcset'],
  });
  const template = document.createElement('template');
  template.innerHTML = String(sanitized);

  template.content.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const parsed = document.createElement('span');
    parsed.setAttribute('style', element.getAttribute('style') ?? '');
    const allowed: string[] = [];
    SAFE_INLINE_STYLE_PROPERTIES.forEach((property) => {
      const propertyValue = parsed.style.getPropertyValue(property).trim();
      if (propertyValue && !UNSAFE_STYLE_VALUE.test(propertyValue)) {
        allowed.push(`${property}: ${propertyValue}`);
      }
    });
    if (allowed.length > 0) {
      element.setAttribute('style', allowed.join('; '));
    } else {
      element.removeAttribute('style');
    }
  });

  template.content.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    link.setAttribute('rel', 'noopener noreferrer');
    if (link.target === '_blank') {
      link.setAttribute('target', '_blank');
    } else {
      link.removeAttribute('target');
    }
  });
  return template.innerHTML;
}

/** Produces a readable list preview without leaking raw HTML tags. */
export function announcementPlainText(value: string) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = sanitizeAnnouncementHtml(value);
  return (wrapper.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 公告ContentProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface AnnouncementContentProps {
  content: string;
  className?: string;
  emptyText?: string;
}

/**
 * 渲染公告Content组件，并协调其数据加载、状态和交互。
 */
export function AnnouncementContent({ content, className = '', emptyText = '' }: AnnouncementContentProps) {
  /**
   * 封装html相关逻辑。对原始数据进行派生或聚合。
   */
  const html = useMemo(() => sanitizeAnnouncementHtml(content), [content]);
  if (!html) {
    return <div className={`announcement-html announcement-html-empty ${className}`.trim()}>{emptyText}</div>;
  }
  return (
    <div
      className={`announcement-html ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
