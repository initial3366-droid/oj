import { ReactNode } from 'react';
import { Typography, Breadcrumb } from '@douyinfe/semi-ui';

const { Title } = Typography;

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
          padding: ${noPadding ? '0' : '0'};
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
          <Breadcrumb>
            {breadcrumb.map((item, index) => (
              <Breadcrumb.Item
                key={index}
                href={item.href}
              >
                {item.text}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </div>
      )}

      {/* 页面头部 */}
      {(title || extra) && (
        <div className="page-container-header">
          <div className="page-container-title-row">
            <div className="page-container-title-content">
              {title && (
                <Title heading={2} style={{ margin: 0 }}>
                  {title}
                </Title>
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
