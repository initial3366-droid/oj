/**
 * FrontFooter组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Layout, Typography } from 'antd';
import { useEffect, useState } from 'react';

const { Footer } = Layout;
const { Text } = Typography;

/**
 * FooterSettings接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FooterSettings {
  footerText?: string;
  icpNumber?: string;
  mpsNumber?: string;
  footerLink1Text?: string;
  footerLink1Url?: string;
  footerLink2Text?: string;
  footerLink2Url?: string;
}

/**
 * 从公安备案号文本中提取纯数字 recordcode（例如“京公网安备 11010502012345号” → 11010502012345）。
 */
function mpsRecordCode(mpsNumber?: string) {
  return (mpsNumber || '').replace(/\D/g, '');
}

/**
 * 渲染FrontFooter组件，并协调其数据加载、状态和交互。
 */
export function FrontFooter() {
  const [settings, setSettings] = useState<FooterSettings>({
    footerText: 'QOJ 在线评测系统',
    icpNumber: '',
    mpsNumber: '',
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
          mpsNumber: body.data?.mpsNumber || '',
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
    <Footer className="front-footer">
      <style>{`
        .front-footer {
          margin-top: 48px;
          padding: 16px 24px;
          background: #ffffff;
          border-top: 1px solid #f0f0f0;
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
        .front-footer-mps,
        .front-footer-link {
          color: rgba(0, 0, 0, 0.45);
          font-size: 13px;
        }

        .front-footer-mps {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .front-footer-mps:hover {
          color: #1677ff;
        }

        .front-footer-icp {
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .front-footer-icp:hover {
          color: #1677ff;
        }

        .front-footer-link {
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .front-footer-link:hover {
          color: #1677ff;
        }

        .front-footer-separator {
          color: rgba(0, 0, 0, 0.25);
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
          {settings.icpNumber ? (
            <a
              className="front-footer-icp"
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {settings.icpNumber}
            </a>
          ) : null}
          {settings.mpsNumber ? <span className="front-footer-separator">|</span> : null}
          {settings.mpsNumber ? (
            <a
              className="front-footer-mps"
              href={`http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=${mpsRecordCode(settings.mpsNumber)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/gongan-beian.ico"
                alt="公安备案"
                width="16"
                height="16"
                style={{ flexShrink: 0 }}
              />
              <span>{settings.mpsNumber}</span>
            </a>
          ) : null}
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
    </Footer>
  );
}
