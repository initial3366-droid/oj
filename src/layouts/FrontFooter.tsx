/**
 * FrontFooter组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Typography } from '@douyinfe/semi-ui';
import { useEffect, useState } from 'react';

const { Text } = Typography;

/**
 * FooterSettings接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FooterSettings {
  footerText?: string;
  icpNumber?: string;
  footerLink1Text?: string;
  footerLink1Url?: string;
  footerLink2Text?: string;
  footerLink2Url?: string;
}

/**
 * 渲染FrontFooter组件，并协调其数据加载、状态和交互。
 */
export function FrontFooter() {
  const [settings, setSettings] = useState<FooterSettings>({
    footerText: 'QOJ 在线评测系统',
    icpNumber: '',
    footerLink1Text: '',
    footerLink1Url: '',
    footerLink2Text: '',
    footerLink2Url: '',
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/settings/frontend')
      .then((response) => response.json())
      .then((body) => {
        if (cancelled || body?.code !== 200) return;
        setSettings({
          footerText: body.data?.footerText || 'QOJ 在线评测系统',
          icpNumber: body.data?.icpNumber || '',
          footerLink1Text: body.data?.footerLink1Text || '',
          footerLink1Url: body.data?.footerLink1Url || '',
          footerLink2Text: body.data?.footerLink2Text || '',
          footerLink2Url: body.data?.footerLink2Url || '',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="front-footer">
      <style>{`
        .front-footer {
          margin-top: 48px;
          padding: 16px 24px;
          background: var(--semi-color-bg-2);
          border-top: 1px solid var(--semi-color-border);
        }

        .front-footer-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          min-height: 24px;
        }

        .front-footer-main {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .front-footer-links {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex: 0 0 auto;
        }

        .front-footer-text,
        .front-footer-icp,
        .front-footer-link {
          color: var(--semi-color-text-2);
          font-size: 13px;
        }

        .front-footer-link {
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .front-footer-link:hover {
          color: var(--semi-color-primary);
        }

        .front-footer-separator {
          color: var(--semi-color-text-3);
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .front-footer {
            padding: 14px 16px;
          }

          .front-footer-content,
          .front-footer-links {
            justify-content: center;
          }
        }
      `}</style>

      <div className="front-footer-content">
        <div className="front-footer-main">
          <Text className="front-footer-text">{settings.footerText}</Text>
          {settings.icpNumber ? <span className="front-footer-separator">|</span> : null}
          {settings.icpNumber ? <Text className="front-footer-icp">{settings.icpNumber}</Text> : null}
        </div>
        <div className="front-footer-links">
          {settings.footerLink1Text && settings.footerLink1Url ? (
            <a className="front-footer-link" href={settings.footerLink1Url}>
              {settings.footerLink1Text}
            </a>
          ) : null}
          {settings.footerLink2Text && settings.footerLink2Url ? (
            <a className="front-footer-link" href={settings.footerLink2Url}>
              {settings.footerLink2Text}
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
