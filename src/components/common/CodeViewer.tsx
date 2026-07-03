import { Typography, Select } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { Toast } from '@douyinfe/semi-ui';
import Editor from '@monaco-editor/react';
import { useState } from 'react';

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      Toast.success('已复制到剪贴板');
    } catch (err) {
      Toast.error('复制失败');
    }
  };

  const languageOptions = Object.entries(LANGUAGE_MAP).map(([key, value]) => ({
    label: value,
    value: key,
  }));

  return (
    <div
      style={{
        border: '1px solid var(--semi-color-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: 'var(--semi-color-fill-1)',
          borderBottom: '1px solid var(--semi-color-border)',
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
              optionList={languageOptions}
            />
          )}
          {!showLanguageSelect && (
            <Typography.Text type="tertiary" style={{ fontSize: 14 }}>
              {LANGUAGE_MAP[language] || language}
            </Typography.Text>
          )}
        </div>
        <IconCopy
          onClick={handleCopy}
          style={{
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--semi-color-text-2)',
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
