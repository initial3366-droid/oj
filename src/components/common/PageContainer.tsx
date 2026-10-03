/**
 * 页面Container组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { ReactNode } from 'react';

/**
 * 页面ContainerProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PageContainerProps {
  title?: string;
  subtitle?: string;
  description?: string;
  extra?: ReactNode;
  breadcrumb?: Array<{ text: string; href?: string }>;
  children: ReactNode;
  maxWidth?: number | string;
  noPadding?: boolean;
}

/**
 * 页面容器组件
 * 提供统一的页面标题、描述、面包屑导航
 */
export function PageContainer({
  title,
  subtitle,
  description,
  extra,
  breadcrumb,
  children,
  maxWidth = '100%',
  noPadding = false,
}: PageContainerProps) {
  return (
    <div className="page-container">
      <style>{`
        .page-container {
          width: 100%;
          max-width: ${typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth};
          margin: 0 auto;
        }

        .page-container-header {
          margin-bottom: 24px;
        }

        .page-container-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 8px;
        }

        .page-container-title-content {
          flex: 1;
          min-width: 0;
        }

        .page-container-extra {
          flex-shrink: 0;
        }

        .page-container-content {
          padding: 0;
        }

        @media (max-width: 768px) {
          .page-container-title-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .page-container-extra {
            width: 100%;
          }
        }
      `}</style>

      {/* 面包屑 */}
      {breadcrumb && breadcrumb.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <nav aria-label="面包屑导航" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--qoj-color-text-2)', fontSize: 13 }}>
            {breadcrumb.map((item, index) => (
              <span key={`${item.text}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {index > 0 && <span aria-hidden="true">/</span>}
                {item.href ? <a href={item.href}>{item.text}</a> : <span aria-current={index === breadcrumb.length - 1 ? 'page' : undefined}>{item.text}</span>}
              </span>
            ))}
          </nav>
        </div>
      )}

      {/* 页面头部 */}
      {(title || subtitle || description || extra) && (
        <div className="page-container-header">
          <div className="page-container-title-row">
            <div className="page-container-title-content">
              {(title || subtitle) && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  {title && (
                    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <span style={{ color: 'var(--qoj-color-text-2)', fontSize: 14 }}>
                      {subtitle}
                    </span>
                  )}
                </div>
              )}
              {description && (
                <span style={{ display: 'block', marginTop: 8, color: 'var(--qoj-color-text-2)' }}>
                  {description}
                </span>
              )}
            </div>
            {extra && (
              <div className="page-container-extra">
                {extra}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 页面内容 */}
      <div className="page-container-content">
        {children}
      </div>
    </div>
  );
}
