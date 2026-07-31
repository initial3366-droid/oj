/**
 * HtmlMathEditor组件。题目描述/输入格式/输出格式的编辑器：
 * 顶部为「HTML + LaTeX」格式工具栏（加粗、斜体、标题、段落、列表、代码块、公式、链接等），
 * 中部为 HTML 源码输入框，下方为实时预览（复用前台渲染组件 HtmlMath）。
 * 工具栏直接修改输入框现有内容（在光标处插入或包裹选中文本），作为受控组件接入 Arco 的 Form.Item。
 */
import { Button, Input, Select, Space, Tooltip } from '@arco-design/web-react';
import { useRef, useState } from 'react';
import { HtmlMath } from '../../components/HtmlMath';
import { FormulaInsertModal } from './FormulaInsertModal';

const { TextArea } = Input;

/**
 * HtmlMathEditorProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface HtmlMathEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

/**
 * 渲染HtmlMathEditor组件，并协调其数据加载、状态和交互。
 */
export function HtmlMathEditor({ value = '', onChange, placeholder, rows = 10 }: HtmlMathEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [formulaModalVisible, setFormulaModalVisible] = useState(false);

  /** 取得底层原生 textarea 元素，以便读取/设置光标位置。 */
  function getTextarea(): HTMLTextAreaElement | null {
    return wrapperRef.current?.querySelector('textarea') ?? null;
  }

  /** 用新内容替换当前值，并在下一帧把光标恢复到 selStart~selEnd。 */
  function applyChange(next: string, selStart: number, selEnd: number) {
    onChange?.(next);
    requestAnimationFrame(() => {
      const textarea = getTextarea();
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(selStart, selEnd);
      }
    });
  }

  /** 用 before/after 包裹选中文本；未选中时插入包裹片段并把光标置于中间。 */
  function surround(before: string, after: string, placeholderText = '') {
    const textarea = getTextarea();
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    const caret = start + before.length + selected.length;
    applyChange(next, start + before.length, caret);
  }

  /** 在光标处（另起一段）插入一个块级片段。 */
  function insertBlock(snippet: string) {
    const textarea = getTextarea();
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const needsLeadingBreak = start > 0 && !/\n$/.test(value.slice(0, start));
    const prefix = needsLeadingBreak ? '\n' : '';
    const next = value.slice(0, start) + prefix + snippet + value.slice(end);
    const caret = start + prefix.length + snippet.length;
    applyChange(next, caret, caret);
  }

  /** 用所选块级标签包裹选中文本（段落/标题）。 */
  function applyBlockTag(tag: string) {
    if (!tag) return;
    const textarea = getTextarea();
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || '文本';
    const snippet = `<${tag}>${selected}</${tag}>`;
    const needsLeadingBreak = start > 0 && !/\n$/.test(value.slice(0, start));
    const prefix = needsLeadingBreak ? '\n' : '';
    const next = value.slice(0, start) + prefix + snippet + value.slice(end);
    const caret = start + prefix.length + snippet.length;
    applyChange(next, caret, caret);
  }

  /** 公式弹窗确认后：行内公式在光标处插入 $...$，独立公式作为块级插入 $$...$$。 */
  function handleInsertFormula(latex: string, display: boolean) {
    if (display) {
      insertBlock(`$$\n${latex}\n$$\n`);
    } else {
      const textarea = getTextarea();
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const snippet = `$${latex}$`;
      const next = value.slice(0, start) + snippet + value.slice(end);
      const caret = start + snippet.length;
      applyChange(next, caret, caret);
    }
  }

  return (
    <div ref={wrapperRef}>
      <div
        style={{
          border: '1px solid #e5e6eb',
          borderBottom: 'none',
          borderRadius: '4px 4px 0 0',
          padding: '6px 8px',
          background: '#f7f8fa',
        }}
      >
        <Space wrap size={4}>
          <Select
            size="small"
            placeholder="段落/标题"
            style={{ width: 104 }}
            value={undefined}
            onChange={(v) => applyBlockTag(v as string)}
            options={[
              { label: '段落', value: 'p' },
              { label: '标题 H1', value: 'h1' },
              { label: '标题 H2', value: 'h2' },
              { label: '标题 H3', value: 'h3' },
            ]}
          />
          <Tooltip content="加粗">
            <Button size="small" style={{ fontWeight: 700 }} onClick={() => surround('<strong>', '</strong>', '加粗')}>B</Button>
          </Tooltip>
          <Tooltip content="斜体">
            <Button size="small" style={{ fontStyle: 'italic' }} onClick={() => surround('<em>', '</em>', '斜体')}>I</Button>
          </Tooltip>
          <Tooltip content="下划线">
            <Button size="small" style={{ textDecoration: 'underline' }} onClick={() => surround('<u>', '</u>', '下划线')}>U</Button>
          </Tooltip>
          <Tooltip content="无序列表">
            <Button size="small" onClick={() => insertBlock('<ul>\n  <li>列表项</li>\n</ul>\n')}>• 列表</Button>
          </Tooltip>
          <Tooltip content="有序列表">
            <Button size="small" onClick={() => insertBlock('<ol>\n  <li>列表项</li>\n</ol>\n')}>1. 列表</Button>
          </Tooltip>
          <Tooltip content="行内代码">
            <Button size="small" onClick={() => surround('<code>', '</code>', 'code')}>{'</>'}</Button>
          </Tooltip>
          <Tooltip content="代码块">
            <Button size="small" onClick={() => insertBlock('<pre><code>\n代码\n</code></pre>\n')}>代码块</Button>
          </Tooltip>
          <Tooltip content="插入公式（含常见公式库）">
            <Button size="small" type="outline" onClick={() => setFormulaModalVisible(true)}>∑ 插入公式</Button>
          </Tooltip>
          <Tooltip content="链接">
            <Button size="small" onClick={() => surround('<a href="https://" target="_blank">', '</a>', '链接文字')}>链接</Button>
          </Tooltip>
        </Space>
      </div>
      <TextArea
        value={value}
        onChange={(next: string) => onChange?.(next)}
        placeholder={placeholder ?? '支持 HTML 标签与 LaTeX 公式（行内 $...$，独立 $$...$$）'}
        rows={rows}
        style={{ fontFamily: 'monospace', paddingBottom: '9px', borderRadius: '0 0 4px 4px' }}
      />
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '12px', color: '#86909c', marginBottom: '4px' }}>实时预览</div>
        <div
          style={{
            border: '1px solid #e5e6eb',
            borderRadius: '4px',
            padding: '12px 14px',
            minHeight: '48px',
            background: '#fff',
          }}
        >
          <HtmlMath value={value} emptyText="在上方输入 HTML 后可在这里查看渲染效果" />
        </div>
      </div>

      <FormulaInsertModal
        visible={formulaModalVisible}
        onClose={() => setFormulaModalVisible(false)}
        onInsert={handleInsertFormula}
      />
    </div>
  );
}
