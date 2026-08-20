/**
 * 编码Viewer组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Typography, Select, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useState } from 'react';
import '../../utils/monacoSetup';
import { copyTextToClipboard } from '../../utils/clipboard';

/**
 * 编码ViewerProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface CodeViewerProps {
  code: string;
  language: string;
  title?: string;
  showLanguageSelect?: boolean;
  height?: number | string;
  readOnly?: boolean;
}

const LANGUAGE_MAP: Record<string, string> = {
  cpp: 'C++',
  c: 'C',
  java: 'Java',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
};

/**
 * 代码查看器组件
 * 使用 Monaco Editor 展示提交代码
 */
export function CodeViewer({
  code,
  language,
  title,
  showLanguageSelect = false,
  height = 500,
  readOnly = true,
}: CodeViewerProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  /**
   * 处理Copy。包含异步流程并由调用方处理完成或失败状态。
   */
  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      message.success('已复制到剪贴板');
    } else {
      message.error('复制失败，请手动选择代码复制');
    }
  };

  const languageOptions = Object.entries(LANGUAGE_MAP).map(([key, value]) => ({
    label: value,
    value: key,
  }));

  return (
    <div
      style={{
        border: '1px solid var(--qoj-color-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: 'var(--qoj-color-fill-1)',
          borderBottom: '1px solid var(--qoj-color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {title && (
            <Typography.Text strong style={{ fontSize: 14 }}>
              {title}
            </Typography.Text>
          )}
          {showLanguageSelect && (
            <Select
              value={selectedLanguage}
              onChange={(value) => setSelectedLanguage(value as string)}
              style={{ width: 120 }}
              size="small"
              options={languageOptions}
            />
          )}
          {!showLanguageSelect && (
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              {LANGUAGE_MAP[language] || language}
            </Typography.Text>
          )}
        </div>
        <CopyOutlined
          onClick={handleCopy}
          style={{
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--qoj-color-text-2)',
          }}
        />
      </div>
      <div className="monaco-container">
        <Editor
          height={height}
          language={selectedLanguage}
          value={code}
          theme="vs-light"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, Menlo, Consolas, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
