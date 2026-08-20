/**
 * 页面Container组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { ReactNode } from 'react';
import { Breadcrumb, Typography } from 'antd';

const { Title } = Typography;

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
          <Breadcrumb
            items={breadcrumb.map((item) => ({ title: item.href ? <a href={item.href}>{item.text}</a> : item.text }))}
          />
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
                    <Title level={2} style={{ margin: 0 }}>
                      {title}
                    </Title>
                  )}
                  {subtitle && (
                    <Title level={5} type="secondary" style={{ margin: 0 }}>
                      {subtitle}
                    </Title>
                  )}
                </div>
              )}
              {description && (
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  {description}
                </Typography.Text>
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
