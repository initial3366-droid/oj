/**
 * HtmlMathEditor组件。题目描述/输入格式/输出格式的编辑器：
 * 顶部为「HTML + LaTeX」格式工具栏（加粗、斜体、标题、段落、列表、代码块、公式、链接等），
 * 中部为 HTML 源码输入框，下方为实时预览（复用前台渲染组件 HtmlMath）。
 * 工具栏直接修改输入框现有内容（在光标处插入或包裹选中文本），作为受控组件接入 Arco 的 Form.Item。
 */
import { Button, Input, InputNumber, Message, Modal, Radio, Select, Space, Tooltip } from '@arco-design/web-react';
import { useRef, useState, type ChangeEvent } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const imageInsertToken = useRef(0);
  const [formulaModalVisible, setFormulaModalVisible] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState<number | undefined>();
  const [imageHeight, setImageHeight] = useState<number | undefined>();

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

  /** 选择本地图片后上传，成功则把 <img> 插入到光标处。 */
  async function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const uploadToken = ++imageInsertToken.current;
    setUploadingImage(true);
    try {
      const token = window.localStorage.getItem('qoj.accessToken');
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/v1/uploads/images', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.code !== 200 || !body?.data?.url) {
        throw new Error(body?.message || '图片上传失败');
      }
      if (uploadToken !== imageInsertToken.current) return;
      insertImgAtCursor(`<img src="${escapeAttr(body.data.url)}" alt="图片" style="max-width:100%" />`);
      setImageModalVisible(false);
    } catch (error) {
      if (uploadToken !== imageInsertToken.current) return;
      Message.error(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  }

  /** 转义 HTML 属性值，避免 src 中的引号/尖括号注入。 */
  function escapeAttr(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** 在光标处插入图片标签：实时读取最新值与光标位置，避免异步回调覆盖用户输入。 */
  function insertImgAtCursor(imgTag: string) {
    const current = valueRef.current;
    const textarea = getTextarea();
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    onChange?.(current.slice(0, start) + imgTag + current.slice(end));
    requestAnimationFrame(() => {
      const target = getTextarea();
      if (target) {
        target.focus();
        const caret = start + imgTag.length;
        target.setSelectionRange(caret, caret);
      }
    });
  }

  /** 用图片链接插入 <img>。宽度/高度独立生效：只填一项时，另一项保持图片原始尺寸（自然宽高）。 */
  function handleInsertImageUrl() {
    const url = imageUrl.trim();
    if (!url) {
      Message.warning('请输入图片链接');
      return;
    }
    const width = imageWidth != null && imageWidth > 0 ? imageWidth : null;
    const height = imageHeight != null && imageHeight > 0 ? imageHeight : null;
    const token = ++imageInsertToken.current;
    const safeUrl = escapeAttr(url);

    /** 清空弹窗并复位。 */
    const closeModal = () => {
      setImageModalVisible(false);
      setImageUrl('');
      setImageWidth(undefined);
      setImageHeight(undefined);
    };

    if (!width && !height) {
      insertImgAtCursor(`<img src="${safeUrl}" alt="图片" style="max-width:100%" />`);
      closeModal();
      return;
    }
    if (width && height) {
      insertImgAtCursor(
        `<img src="${safeUrl}" alt="图片" style="max-width:100%; width: ${width}px; height: ${height}px" width="${width}" height="${height}" />`,
      );
      closeModal();
      return;
    }

    // 只填了一个维度：加载图片取得自然尺寸，缺失维度用原始尺寸补齐（保持原宽/原高）。
    const probe = new Image();
    probe.onload = () => {
      if (token !== imageInsertToken.current) return;
      const naturalWidth = probe.naturalWidth;
      const naturalHeight = probe.naturalHeight;
      if (naturalWidth > 0 && naturalHeight > 0) {
        const finalWidth = width ?? naturalWidth;
        const finalHeight = height ?? naturalHeight;
        insertImgAtCursor(
          `<img src="${safeUrl}" alt="图片" style="max-width:100%; width: ${finalWidth}px; height: ${finalHeight}px" width="${finalWidth}" height="${finalHeight}" />`,
        );
      } else {
        // 无内在尺寸（如 SVG）：只写用户填写的维度，保持比例。
        let style = 'max-width:100%';
        let attrs = '';
        if (width) {
          style += `; width: ${width}px`;
          attrs += ` width="${width}"`;
        }
        if (height) {
          style += `; height: ${height}px`;
          attrs += ` height="${height}"`;
        }
        insertImgAtCursor(`<img src="${safeUrl}" alt="图片" style="${style}"${attrs} />`);
      }
      closeModal();
    };
    probe.onerror = () => {
      if (token !== imageInsertToken.current) return;
      Message.error('图片加载失败，请检查链接');
      closeModal();
    };
    probe.src = url;
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
          <Tooltip content="插入图片（上传本地图片或图片链接）">
            <Button size="small" onClick={() => setImageModalVisible(true)}>🖼 图片</Button>
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

      <Modal
        title="插入图片"
        visible={imageModalVisible}
        onCancel={() => {
          imageInsertToken.current += 1;
          setImageModalVisible(false);
          setImageUrl('');
          setImageWidth(undefined);
          setImageHeight(undefined);
        }}
        footer={null}
        style={{ width: 480 }}
      >
        <Radio.Group
          type="button"
          value={imageMode}
          onChange={(value) => setImageMode(value as 'upload' | 'url')}
          style={{ marginBottom: 16 }}
        >
          <Radio value="upload">上传本地图片</Radio>
          <Radio value="url">图片链接</Radio>
        </Radio.Group>
        {imageMode === 'upload' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(event) => void handleImageSelect(event)}
            />
            <Button
              type="primary"
              loading={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingImage ? '上传中…' : '选择本地图片上传'}
            </Button>
            <span style={{ fontSize: 12, color: '#86909c' }}>支持 JPG/PNG/GIF/WEBP/BMP，最大 5MB</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://example.com/image.png"
              onPressEnter={() => handleInsertImageUrl()}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <InputNumber
                value={imageWidth}
                onChange={setImageWidth}
                placeholder="宽度（可选，px）"
                min={1}
                style={{ width: '100%' }}
              />
              <InputNumber
                value={imageHeight}
                onChange={setImageHeight}
                placeholder="高度（可选，px）"
                min={1}
                style={{ width: '100%' }}
              />
            </div>
            <span style={{ fontSize: 12, color: '#86909c' }}>
              宽度与高度独立生效：只填一项时，另一项保持图片原始尺寸。
            </span>
            <Button type="primary" onClick={() => handleInsertImageUrl()}>
              插入图片
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
