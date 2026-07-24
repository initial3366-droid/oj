/**
 * 编码InsertModal组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Modal, Input, Select } from '@arco-design/web-react';
import { useState } from 'react';
import { HtmlMath } from '../../components/HtmlMath';

const { TextArea } = Input;
const Option = Select.Option;

/** 转义代码中的 HTML 特殊字符，使其在 <pre><code> 中原样显示。 */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 把代码包装为 HTML 代码块（<pre><code class="language-xxx">...</code></pre>）。 */
function buildCodeBlock(code: string, language: string) {
  const classAttr = language ? ` class="language-${language}"` : '';
  return `<pre><code${classAttr}>${escapeHtml(code)}</code></pre>`;
}

/**
 * 编码InsertModalProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface CodeInsertModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
}

/**
 * 渲染编码InsertModal组件，并协调其数据加载、状态和交互。
 */
export function CodeInsertModal({ visible, onClose, onInsert }: CodeInsertModalProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp');

  /**
   * 处理Insert。会更新 React 状态并触发重新渲染。
   */
  function handleInsert() {
    onInsert(buildCodeBlock(code, language));
    setCode('');
  }

  /**
   * 处理Cancel。会更新 React 状态并触发重新渲染。
   */
  function handleCancel() {
    setCode('');
    onClose();
  }

  const codeBlock = buildCodeBlock(code, language);

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
            <HtmlMath value={codeBlock} emptyText="预览区域" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
        💡 提示：左侧输入代码，右侧实时预览代码块渲染效果
      </div>
    </Modal>
  );
}
