import { Input } from '@arco-design/web-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const { TextArea } = Input;

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          style={{
            padding: '4px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {showPreview ? '编辑' : '预览'}
        </button>
      </div>
      {showPreview ? (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '12px',
            minHeight: '200px',
            background: '#fff',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {value || ''}
          </ReactMarkdown>
        </div>
      ) : (
        <TextArea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
      )}
    </div>
  );
}
