import { Modal, Input } from '@arco-design/web-react';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const { TextArea } = Input;

interface MarkdownInsertModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
  title?: string;
  initialValue?: string;
}

export function MarkdownInsertModal({
  visible,
  onClose,
  onInsert,
  title = '插入 Markdown 内容',
  initialValue = '',
}: MarkdownInsertModalProps) {
  const [content, setContent] = useState(initialValue);

  // 当弹窗打开时，重置内容为初始值
  useEffect(() => {
    if (visible) {
      setContent(initialValue);
    }
  }, [visible, initialValue]);

  function handleInsert() {
    console.log('MarkdownInsertModal - Inserting content:', content);
    onInsert(content);
    setContent(''); // 插入成功后清空
    onClose();
  }

  function handleCancel() {
    setContent(''); // 取消时清空
    onClose();
  }

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={handleCancel}
      onOk={handleInsert}
      style={{ width: '90vw', maxWidth: '1400px' }}
      okText="插入"
      cancelText="取消"
    >
      <div style={{ display: 'flex', gap: '16px', height: '500px' }}>
        {/* 左侧编辑区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            源代码
          </div>
          <TextArea
            value={content}
            onChange={setContent}
            placeholder="输入 Markdown 内容，支持 LaTeX 数学公式&#10;&#10;示例：&#10;# 标题&#10;**粗体** *斜体*&#10;行内公式：$x^2 + y^2 = z^2$&#10;独立公式：$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$"
            style={{
              fontFamily: 'monospace',
              flex: 1,
              resize: 'none',
            }}
          />
        </div>

        {/* 右侧预览区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            实时预览
          </div>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '16px',
              flex: 1,
              overflowY: 'auto',
              background: '#fafafa',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {content || '*预览区域*'}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
        💡 提示：左侧输入 Markdown 格式文本，右侧实时预览渲染效果。支持 LaTeX 数学公式（行内：$formula$，独立：$$formula$$）
      </div>
    </Modal>
  );
}
