import { Modal, Input, Select } from '@arco-design/web-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const { TextArea } = Input;
const Option = Select.Option;

interface CodeInsertModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
}

export function CodeInsertModal({ visible, onClose, onInsert }: CodeInsertModalProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp');

  function handleInsert() {
    const codeBlock = language ? `\`\`\`${language}\n${code}\n\`\`\`` : `\`\`\`\n${code}\n\`\`\``;
    onInsert(codeBlock);
    setCode('');
  }

  function handleCancel() {
    setCode('');
    onClose();
  }

  const codeBlock = language ? `\`\`\`${language}\n${code}\n\`\`\`` : `\`\`\`\n${code}\n\`\`\``;

  return (
    <Modal
      title="插入代码块"
      visible={visible}
      onCancel={handleCancel}
      onOk={handleInsert}
      style={{ width: '90vw', maxWidth: '1400px' }}
      okText="插入"
      cancelText="取消"
    >
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>语言</div>
        <Select value={language} onChange={setLanguage} style={{ width: '200px' }}>
          <Option value="cpp">C++</Option>
          <Option value="c">C</Option>
          <Option value="java">Java</Option>
          <Option value="python">Python</Option>
          <Option value="javascript">JavaScript</Option>
          <Option value="go">Go</Option>
          <Option value="rust">Rust</Option>
          <Option value="">无语言</Option>
        </Select>
      </div>

      <div style={{ display: 'flex', gap: '16px', height: '400px' }}>
        {/* 左侧编辑区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            代码
          </div>
          <TextArea
            value={code}
            onChange={setCode}
            placeholder="输入代码"
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
              {codeBlock}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
        💡 提示：左侧输入代码，右侧实时预览代码块渲染效果
      </div>
    </Modal>
  );
}
