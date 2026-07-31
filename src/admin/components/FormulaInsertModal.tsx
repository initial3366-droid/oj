/**
 * FormulaInsertModal组件。公式插入弹窗：内置算法竞赛常见 LaTeX 公式库（分类），
 * 点击公式即插入到可编辑的 LaTeX 输入框，弹窗内实时预览渲染效果，
 * 支持行内（$...$）/独立（$$...$$）两种插入模式，确认后回填到题面描述/输入/输出编辑器。
 */
import { Modal, Input, Radio } from '@arco-design/web-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';

const { TextArea } = Input;

/**
 * FormulaInsertModalProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FormulaInsertModalProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (latex: string, display: boolean) => void;
}

/**
 * FormulaItem接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FormulaItem {
  latex: string;
  tip?: string;
}

/**
 * FormulaGroup接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FormulaGroup {
  name: string;
  items: FormulaItem[];
}

// 参考 https://www.cnblogs.com/1024th/p/11623258.html 整理的算法竞赛常见公式。
const FORMULA_GROUPS: FormulaGroup[] = [
  {
    name: '上下标',
    items: [
      { latex: 'a^{2}', tip: '上标' },
      { latex: 'a_{i}', tip: '下标' },
      { latex: 'a_{i}^{2}', tip: '上下标' },
      { latex: 'a_{i,j}', tip: '多重下标' },
      { latex: 'x^{2^{n}}', tip: '嵌套上标' },
    ],
  },
  {
    name: '分数与根号',
    items: [
      { latex: '\\frac{a}{b}' },
      { latex: '\\dfrac{a}{b}', tip: '大分数' },
      { latex: '\\sqrt{x}' },
      { latex: '\\sqrt[n]{x}', tip: 'n 次根' },
      { latex: '\\frac{n(n+1)}{2}', tip: '等差求和' },
    ],
  },
  {
    name: '求和/积/极限/积分',
    items: [
      { latex: '\\sum_{i=1}^{n} a_i' },
      { latex: '\\prod_{i=1}^{n} a_i' },
      { latex: '\\lim_{n \\to \\infty} a_n' },
      { latex: '\\int_{a}^{b} f(x)\\,\\mathrm{d}x' },
      { latex: '\\bigcup_{i=1}^{n} S_i' },
      { latex: '\\bigcap_{i=1}^{n} S_i' },
    ],
  },
  {
    name: '取整/取模/组合',
    items: [
      { latex: '\\left\\lfloor \\dfrac{a}{b} \\right\\rfloor', tip: '下取整' },
      { latex: '\\left\\lceil \\dfrac{a}{b} \\right\\rceil', tip: '上取整' },
      { latex: 'a \\bmod b', tip: '取模' },
      { latex: 'a \\equiv b \\pmod{m}', tip: '同余' },
      { latex: '\\binom{n}{k}', tip: '组合数' },
      { latex: '\\gcd(a, b)' },
      { latex: '\\operatorname{lcm}(a, b)' },
    ],
  },
  {
    name: '括号',
    items: [
      { latex: '\\left( x \\right)' },
      { latex: '\\left[ x \\right]' },
      { latex: '\\left\\{ x \\right\\}' },
      { latex: '\\left| x \\right|', tip: '绝对值' },
      { latex: '\\left\\langle x \\right\\rangle' },
    ],
  },
  {
    name: '比较/运算符',
    items: [
      { latex: '\\le' }, { latex: '\\ge' }, { latex: '\\ne' },
      { latex: '\\equiv' }, { latex: '\\approx' }, { latex: '\\sim' },
      { latex: '\\times' }, { latex: '\\cdot' }, { latex: '\\div' },
      { latex: '\\pm' }, { latex: '\\mp' }, { latex: '\\oplus' },
    ],
  },
  {
    name: '集合/逻辑',
    items: [
      { latex: '\\in' }, { latex: '\\notin' }, { latex: '\\subseteq' },
      { latex: '\\cup' }, { latex: '\\cap' }, { latex: '\\emptyset' },
      { latex: '\\forall' }, { latex: '\\exists' }, { latex: '\\land' },
      { latex: '\\lor' }, { latex: '\\Rightarrow' }, { latex: '\\Leftrightarrow' },
    ],
  },
  {
    name: '希腊字母',
    items: [
      { latex: '\\alpha' }, { latex: '\\beta' }, { latex: '\\gamma' },
      { latex: '\\delta' }, { latex: '\\theta' }, { latex: '\\lambda' },
      { latex: '\\mu' }, { latex: '\\pi' }, { latex: '\\sigma' },
      { latex: '\\phi' }, { latex: '\\omega' }, { latex: '\\Delta' },
      { latex: '\\Sigma' }, { latex: '\\Omega' },
    ],
  },
  {
    name: '箭头/装饰/省略号',
    items: [
      { latex: '\\to' }, { latex: '\\gets' }, { latex: '\\mapsto' },
      { latex: '\\overline{x}' }, { latex: '\\vec{x}' }, { latex: '\\hat{x}' },
      { latex: '\\overrightarrow{AB}' }, { latex: '\\cdots' },
      { latex: '\\ldots' }, { latex: '\\vdots' }, { latex: '\\ddots' },
    ],
  },
  {
    name: '矩阵/分段',
    items: [
      { latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', tip: '圆括号矩阵' },
      { latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', tip: '方括号矩阵' },
      { latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', tip: '行列式' },
      { latex: 'f(n) = \\begin{cases} 1, & n = 0 \\\\ n \\cdot f(n-1), & n > 0 \\end{cases}', tip: '分段函数' },
    ],
  },
  {
    name: '竞赛常用',
    items: [
      { latex: 'O(n \\log n)', tip: '复杂度' },
      { latex: '1 \\le n \\le 10^{5}', tip: '数据范围' },
      { latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
      { latex: 'a \\equiv b \\pmod{10^9 + 7}' },
      { latex: '\\dfrac{n!}{k!(n-k)!}' },
    ],
  },
  {
    name: '区间/数据范围',
    items: [
      { latex: '1 \\le n \\le 10^{5}', tip: 'n 的范围' },
      { latex: '1 \\le m \\le 10^{5}', tip: 'm 的范围' },
      { latex: '1 \\le n, m \\le 10^{5}', tip: 'n、m 同范围' },
      { latex: '1 \\le a_i \\le 10^{9}', tip: '元素范围' },
      { latex: '-10^{9} \\le a_i \\le 10^{9}', tip: '含负数范围' },
      { latex: '0 \\le x \\le 2^{31} - 1', tip: 'int 范围' },
      { latex: '[l, r]', tip: '闭区间' },
      { latex: '(l, r)', tip: '开区间' },
      { latex: '[l, r)', tip: '左闭右开' },
      { latex: '1 \\le l \\le r \\le n', tip: '区间约束' },
      { latex: 'x \\in [a, b]', tip: '属于区间' },
      { latex: '\\sum n \\le 10^{6}', tip: '总和范围' },
    ],
  },
  {
    name: '变量',
    items: [
      { latex: 'n' },
      { latex: 'm' },
      { latex: 'n \\times m', tip: 'n 乘 m' },
      { latex: 'a_i' },
      { latex: 'a_{i,j}' },
    ],
  },
];

/** 把 LaTeX 渲染为 KaTeX HTML；失败时返回原文，避免抛错中断渲染。 */
function renderKatexHtml(latex: string, display: boolean) {
  try {
    return katex.renderToString(latex, { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return latex;
  }
}

/** 渲染单个公式按钮（用 KaTeX 显示公式外观）。 */
function FormulaButton({ item, onPick }: { item: FormulaItem; onPick: (latex: string) => void }) {
  const html = useMemo(() => renderKatexHtml(item.latex, false), [item.latex]);
  return (
    <button
      type="button"
      title={item.tip ? `${item.tip}：${item.latex}` : item.latex}
      onClick={() => onPick(item.latex)}
      style={{
        border: '1px solid #e5e6eb',
        borderRadius: '4px',
        background: '#fff',
        padding: '6px 10px',
        cursor: 'pointer',
        minWidth: '40px',
        minHeight: '36px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * 渲染FormulaInsertModal组件，并协调其数据加载、状态和交互。
 */
export function FormulaInsertModal({ visible, onClose, onInsert }: FormulaInsertModalProps) {
  const [latex, setLatex] = useState('');
  const [display, setDisplay] = useState(false);
  const textareaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      setLatex('');
      setDisplay(false);
    }
  }, [visible]);

  /** 点击公式库中的公式：在光标处插入其 LaTeX 源码。 */
  function pickFormula(snippet: string) {
    const textarea = textareaRef.current?.querySelector('textarea');
    const start = textarea?.selectionStart ?? latex.length;
    const end = textarea?.selectionEnd ?? latex.length;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const caret = start + snippet.length;
        textarea.setSelectionRange(caret, caret);
      }
    });
  }

  /** 确认插入：把编辑好的 LaTeX 交给调用方（附带行内/独立模式）。 */
  function handleInsert() {
    const trimmed = latex.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    onInsert(trimmed, display);
    setLatex('');
    onClose();
  }

  const previewHtml = useMemo(
    () => (latex.trim() ? renderKatexHtml(latex.trim(), display) : ''),
    [latex, display],
  );

  return (
    <Modal
      title="插入公式"
      visible={visible}
      onCancel={onClose}
      onOk={handleInsert}
      style={{ width: '90vw', maxWidth: '1100px' }}
      okText="插入"
      cancelText="取消"
    >
      <div style={{ display: 'flex', gap: '16px' }}>
        {/* 左侧：公式库 */}
        <div style={{ flex: '1 1 55%', maxHeight: '460px', overflowY: 'auto', paddingRight: '4px' }}>
          {FORMULA_GROUPS.map((group) => (
            <div key={group.name} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4e5969', marginBottom: '6px' }}>
                {group.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {group.items.map((item, index) => (
                  <FormulaButton key={`${group.name}-${index}`} item={item} onPick={pickFormula} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 右侧：编辑 + 预览 */}
        <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px' }}>
            <Radio.Group
              type="button"
              size="small"
              value={display ? 'display' : 'inline'}
              onChange={(v) => setDisplay(v === 'display')}
            >
              <Radio value="inline">行内公式 $...$</Radio>
              <Radio value="display">独立公式 $$...$$</Radio>
            </Radio.Group>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>LaTeX 源码</div>
          <div ref={textareaRef}>
            <TextArea
              value={latex}
              onChange={setLatex}
              placeholder={'点击左侧公式插入，或直接输入 LaTeX，例如：\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}'}
              rows={6}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#333', margin: '12px 0 6px' }}>实时预览</div>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '16px',
              minHeight: '80px',
              background: '#fafafa',
              overflowX: 'auto',
            }}
          >
            {previewHtml
              ? <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
              : <span style={{ color: '#c9cdd4' }}>预览区域</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
        💡 提示：点击左侧公式库快速插入，右侧可编辑 LaTeX 源码并实时预览。确认后将按所选模式插入题面。
      </div>
    </Modal>
  );
}
