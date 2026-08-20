/**
 * 编码Block组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { copyTextToClipboard } from '../../utils/clipboard';

/**
 * 编码BlockProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: number | string;
  title?: string;
}

/**
 * 代码块组件
 * 用于展示示例输入输出等代码片段
 */
export function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = false,
  maxHeight,
  title,
}: CodeBlockProps) {
  /**
   * 处理Copy。包含异步流程并由调用方处理完成或失败状态。
   */
  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      message.success('已复制到剪贴板');
    } else {
      message.error('复制失败，请手动选择复制');
    }
  };

  const lines = code.split('\n');

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'var(--qoj-color-fill-0)',
        border: '1px solid var(--qoj-color-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {title && (
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
          <Typography.Text strong style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
          <CopyOutlined
            onClick={handleCopy}
            style={{
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--qoj-color-text-2)',
            }}
          />
        </div>
      )}
      <div
        style={{
          padding: '16px',
          maxHeight: maxHeight || 'none',
          overflow: 'auto',
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: 'JetBrains Mono, Fira Code, Menlo, Consolas, monospace',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--qoj-color-text-0)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {showLineNumbers ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        paddingRight: 16,
                        textAlign: 'right',
                        userSelect: 'none',
                        color: 'var(--qoj-color-text-2)',
                        minWidth: 40,
                        verticalAlign: 'top',
                      }}
                    >
                      {index + 1}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>{line || '\n'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            code
          )}
        </pre>
      </div>
      {!title && (
        <CopyOutlined
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--qoj-color-text-2)',
            backgroundColor: 'var(--qoj-color-fill-1)',
            padding: 6,
            borderRadius: 4,
          }}
        />
      )}
    </div>
  );
}
