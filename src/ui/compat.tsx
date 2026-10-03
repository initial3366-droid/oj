/** Frontend presentation primitives used while replacing Ant Design screens. */
import { Children, isValidElement, useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button as MotionButton } from '../components/motion/button/base';
import { Input as MotionInput } from '../components/motion/input';
import { AnimatedBadge } from '../components/motion/animated-badge';
import { Loader } from '../components/motion/loader';
import { MultiSelect, MultiSelectContent, MultiSelectEmpty, MultiSelectInput, MultiSelectItem, MultiSelectList, MultiSelectTrigger, MultiSelectValue } from '../components/motion/multi-select';
import { Select as MotionSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/motion/select';
import { ChevronLeft, ChevronRight, CircleHelp, X } from 'lucide-react';
import './compat.css';

type LooseProps = Record<string, any> & { children?: ReactNode; className?: string; style?: CSSProperties };

function tone(type?: string) {
  if (type === 'secondary') return 'var(--qoj-color-text-2)';
  if (type === 'success') return 'var(--qoj-color-success)';
  if (type === 'danger' || type === 'error') return 'var(--qoj-color-danger)';
  if (type === 'warning') return 'var(--qoj-color-warning)';
  return undefined;
}

const Text = ({ children, type, strong, code, ellipsis, copyable, className, style, ...rest }: LooseProps) => <span className={`qoj-text ${ellipsis ? 'qoj-text-ellipsis' : ''} ${className || ''}`} style={{ color: tone(type), fontWeight: strong ? 650 : undefined, ...style }} title={ellipsis && typeof children === 'string' ? children : undefined} {...rest}>{code ? <code>{children}</code> : children}{copyable && <button type="button" className="qoj-copy" onClick={() => navigator.clipboard.writeText(String(children))}>复制</button>}</span>;
const Paragraph = ({ children, type, ellipsis, className, style, ...rest }: LooseProps) => <p className={`qoj-paragraph ${ellipsis ? 'qoj-text-ellipsis' : ''} ${className || ''}`} style={{ color: tone(type), ...style }} {...rest}>{children}</p>;
const Title = ({ children, level = 1, type, ellipsis, className, style, ...rest }: LooseProps) => {
  const Heading = `h${Math.min(5, Math.max(1, level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  return <Heading className={`qoj-title ${ellipsis ? 'qoj-text-ellipsis' : ''} ${className || ''}`} style={{ color: tone(type), ...style }} {...rest}>{children}</Heading>;
};
const TextLink = ({ children, href, className, style, ...rest }: LooseProps) => <a href={href} className={`qoj-link ${className || ''}`} style={style} {...rest}>{children}</a>;
export const Typography = { Text, Paragraph, Title, Link: TextLink };

export const Button = ({ children, type = 'default', size = 'middle', danger, loading, icon, block, shape, htmlType, className, style, disabled, ...rest }: LooseProps) => <MotionButton
  {...rest as any}
  type={htmlType || 'button'}
  variant={type === 'primary' ? 'primary' : type === 'text' || type === 'link' ? 'ghost' : 'secondary'}
  size={shape === 'circle' || (!children && icon) ? 'icon' : size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'md'}
  disabled={disabled || loading}
  className={`qoj-button ${danger ? 'qoj-button-danger' : ''} ${block ? 'qoj-button-block' : ''} ${className || ''}`}
  style={style}
>{loading ? <Loader size={15} label="处理中" /> : icon}{children}</MotionButton>;

export const Tag = ({ children, color, icon, className, style }: LooseProps) => {
  const status = ['green', 'success', 'lime'].includes(color) ? 'success' : ['red', 'error', 'danger', 'volcano'].includes(color) ? 'danger' : ['orange', 'gold', 'warning'].includes(color) ? 'warning' : ['blue', 'cyan', 'processing', 'purple', 'geekblue'].includes(color) ? 'info' : 'neutral';
  return <AnimatedBadge status={status} size="sm" icon={icon} showIcon={Boolean(icon)} className={`qoj-badge ${className || ''}`} style={style}>{children}</AnimatedBadge>;
};

export const Card = ({ title, extra, children, className, style, styles, size, bordered = true }: LooseProps) => <section className={`qoj-card ${size === 'small' ? 'qoj-card-small' : ''} ${bordered ? '' : 'qoj-card-borderless'} ${className || ''}`} style={style}>{(title || extra) && <div className="qoj-card-head"><span>{title}</span>{extra}</div>}<div className="qoj-card-body" style={styles?.body}>{children}</div></section>;
export const Alert = ({ type = 'info', message, description, showIcon, banner, className, style, action }: LooseProps) => <div role="alert" className={`qoj-alert qoj-alert-${type} ${banner ? 'qoj-alert-banner' : ''} ${className || ''}`} style={style}>{showIcon && <CircleHelp size={16} />}<div><strong>{message}</strong>{description && <div>{description}</div>}</div>{action}</div>;
export const Spin = ({ size, tip, children, spinning = true }: LooseProps) => children ? <div className="qoj-spin-wrap">{children}{spinning && <div className="qoj-spin-overlay"><Loader size={size === 'large' ? 32 : 20} label={tip || '加载中'} />{tip}</div>}</div> : <Loader size={size === 'large' ? 32 : 20} label={tip || '加载中'} />;
export const Skeleton = ({ paragraph, title }: LooseProps) => <div className="qoj-skeleton">{title && <span />}{Array.from({ length: paragraph?.rows || 3 }, (_, i) => <span key={i} />)}</div>;
export const Empty = Object.assign(({ image, description, children }: LooseProps) => <div className="qoj-empty">{image && image !== 'simple' ? image : null}<span>{description || '暂无数据'}</span>{children}</div>, { PRESENTED_IMAGE_SIMPLE: 'simple' });
export const Divider = ({ children, style }: LooseProps) => <div className="qoj-divider" style={style}>{children}</div>;
export const Space = ({ children, size = 8, direction, align, wrap, style, className }: LooseProps) => <div className={`qoj-space ${className || ''}`} style={{ gap: Array.isArray(size) ? `${size[1]}px ${size[0]}px` : typeof size === 'number' ? size : 8, flexDirection: direction === 'vertical' ? 'column' : 'row', alignItems: align === 'center' ? 'center' : undefined, flexWrap: wrap ? 'wrap' : undefined, ...style }}>{children}</div>;
export const Flex = ({ children, vertical, gap, align, justify, style, className }: LooseProps) => <div className={`qoj-flex ${className || ''}`} style={{ flexDirection: vertical ? 'column' : 'row', gap, alignItems: align, justifyContent: justify, ...style }}>{children}</div>;
export const Avatar = ({ children, src, size = 32, style, className }: LooseProps) => <span className={`qoj-avatar ${className || ''}`} style={{ width: typeof size === 'number' ? size : 32, height: typeof size === 'number' ? size : 32, ...style }}>{src ? <img src={src} alt="" /> : children}</span>;
export const Tooltip = ({ children, title }: LooseProps) => <span title={typeof title === 'string' ? title : undefined}>{children}</span>;

type LegacyInputProps = LooseProps & { onChange?: (event: ChangeEvent<HTMLInputElement>) => void };
const BaseInput = ({ value, defaultValue, onChange, onClear, allowClear, prefix, suffix, size, className, style, status, ...rest }: LegacyInputProps) => <div className={`qoj-input-wrap ${className || ''}`} style={style}><MotionInput {...rest as any} value={value == null ? undefined : String(value)} defaultValue={defaultValue} onChange={(next) => onChange?.({ target: { value: next } } as ChangeEvent<HTMLInputElement>)} leftIcon={prefix} rightIcon={suffix} error={status === 'error'} className={size === 'large' ? 'qoj-input-large' : ''} />{allowClear && value && <button className="qoj-input-clear" type="button" aria-label="清除" onClick={() => { onChange?.({ target: { value: '' } } as ChangeEvent<HTMLInputElement>); onClear?.(); }}><X size={14} /></button>}</div>;
const TextArea = ({ value, defaultValue, onChange, autoSize, ...rest }: LooseProps & { onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void; onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void }) => <textarea {...rest as any} className={`qoj-textarea ${rest.className || ''}`} value={value} defaultValue={defaultValue} onChange={onChange} rows={rest.rows || (autoSize ? 4 : undefined)} />;
const Password = (props: LegacyInputProps) => <BaseInput {...props} type="password" />;
export const Input = Object.assign(BaseInput, { TextArea, Password });

type Option = { value: string | number; label: ReactNode; disabled?: boolean };
function SelectOption(_props: LooseProps) { return null; }
const BaseSelect = ({ value, defaultValue, onChange, options, children, mode, placeholder, allowClear, showSearch, style, className, disabled, notFoundContent }: LooseProps & { onChange?: (value: any) => void }) => {
  const items: Option[] = options || Children.toArray(children).filter(isValidElement).map((child: any) => ({ value: child.props.value, label: child.props.children, disabled: child.props.disabled }));
  const textItems = items.map((item) => ({ ...item, value: String(item.value) }));
  if (mode === 'multiple') return <div className={`qoj-select-wrap ${className || ''}`} style={style}><MultiSelect value={(value || []).map(String)} onValueChange={(values) => onChange?.(values.map((v) => items.find((item) => String(item.value) === v)?.value ?? v))} disabled={disabled}><MultiSelectTrigger><MultiSelectValue placeholder={placeholder} /><MultiSelectInput aria-label={placeholder || '搜索选项'} placeholder="" /></MultiSelectTrigger><MultiSelectContent><MultiSelectList ariaLabel={placeholder || '选项'}>{textItems.map((item) => <MultiSelectItem key={item.value} value={item.value} textValue={String(item.label)}>{item.label}</MultiSelectItem>)}<MultiSelectEmpty>{notFoundContent || '无匹配项'}</MultiSelectEmpty></MultiSelectList></MultiSelectContent></MultiSelect></div>;
  return <div className={`qoj-select-wrap ${className || ''}`} style={style}><MotionSelect value={value == null ? '' : String(value)} defaultValue={defaultValue == null ? undefined : String(defaultValue)} onValueChange={(next) => onChange?.(items.find((item) => String(item.value) === next)?.value ?? next)} disabled={disabled}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{allowClear && <SelectItem value="">全部</SelectItem>}{textItems.map((item) => <SelectItem key={item.value} value={item.value} disabled={item.disabled}>{item.label}</SelectItem>)}</SelectContent></MotionSelect></div>;
};
export const Select = Object.assign(BaseSelect, { Option: SelectOption });

export const Checkbox = ({ children, checked, onChange, disabled, className, style }: LooseProps & { onChange?: (event: ChangeEvent<HTMLInputElement>) => void }) => <label className={`qoj-checkbox ${className || ''}`} style={style}><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />{children}</label>;

export type TableColumnsType<T> = Array<{ key?: string; title?: ReactNode; dataIndex?: string | string[]; width?: number | string; align?: 'left' | 'center' | 'right'; render?: (value: any, record: T, index: number) => ReactNode; ellipsis?: any; sorter?: any; fixed?: any; onCell?: any; className?: string }>;
export function Table<T extends object>({ columns = [], dataSource = [], rowKey = 'id', loading, pagination, locale, onRow, scroll, className, style, rowClassName, size }: { columns?: TableColumnsType<T>; dataSource?: T[]; rowKey?: string | ((row: T) => string); loading?: boolean; pagination?: false | { current?: number; pageSize?: number; total?: number; onChange?: (page: number, pageSize: number) => void; onShowSizeChange?: (page: number, size: number) => void; showSizeChanger?: boolean; showTotal?: (total: number) => ReactNode; pageSizeOptions?: number[]; style?: CSSProperties }; locale?: { emptyText?: ReactNode }; onRow?: (row: T) => HTMLAttributes<HTMLTableRowElement>; scroll?: { x?: number | string }; className?: string; style?: CSSProperties; rowClassName?: string | ((row: T) => string); size?: string; [key: string]: any }) {
  const [internalPage, setInternalPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const pageSize = pagination === false ? dataSource.length || 10 : pagination?.pageSize || 10;
  const current = pagination === false ? 1 : pagination?.current || internalPage;
  const sorted = useMemo(() => {
    const column = columns.find((item) => (item.key || String(item.dataIndex)) === sortKey);
    if (!column?.sorter) return dataSource;
    return [...dataSource].sort((a, b) => (typeof column.sorter === 'function' ? column.sorter(a, b) : String((a as any)[String(column.dataIndex)]).localeCompare(String((b as any)[String(column.dataIndex)]))) * (sortAsc ? 1 : -1));
  }, [dataSource, columns, sortKey, sortAsc]);
  const rows = pagination === false || pagination?.current ? sorted : sorted.slice((current - 1) * pageSize, current * pageSize);
  const total = pagination === false ? sorted.length : pagination?.total ?? sorted.length;
  return <div className={`qoj-table-wrap ${className || ''}`} style={style}><table className={`qoj-table ${size === 'small' ? 'qoj-table-small' : ''}`} style={{ minWidth: scroll?.x }}><thead><tr>{columns.map((column, index) => <th key={column.key || String(column.dataIndex) || index} style={{ width: column.width, textAlign: column.align }} onClick={column.sorter ? () => { const key = column.key || String(column.dataIndex); setSortAsc(sortKey === key ? !sortAsc : true); setSortKey(key); } : undefined}>{column.title}{column.sorter && <span aria-hidden="true"> ↕</span>}</th>)}</tr></thead><tbody>{rows.map((record, rowIndex) => <tr key={typeof rowKey === 'function' ? rowKey(record) : String((record as any)[rowKey] ?? rowIndex)} className={typeof rowClassName === 'function' ? rowClassName(record) : rowClassName} {...onRow?.(record)}>{columns.map((column, columnIndex) => { const value = Array.isArray(column.dataIndex) ? column.dataIndex.reduce((object, key) => object?.[key], record as any) : column.dataIndex ? (record as any)[column.dataIndex] : undefined; return <td key={column.key || String(column.dataIndex) || columnIndex} style={{ textAlign: column.align, ...column.onCell?.(record)?.style }}>{column.render ? column.render(value, record, rowIndex) : value as ReactNode}</td>; })}</tr>)}</tbody></table>{loading && <div className="qoj-table-loading"><Loader size={24} label="加载表格" /></div>}{!loading && rows.length === 0 && <div className="qoj-empty">{locale?.emptyText || '暂无数据'}</div>}{pagination !== false && total > pageSize && <Pagination current={current} pageSize={pageSize} total={total} showSizeChanger={pagination?.showSizeChanger} pageSizeOptions={pagination?.pageSizeOptions} style={pagination?.style} onChange={(page: number, nextSize: number) => { setInternalPage(page); if (nextSize !== pageSize) pagination?.onShowSizeChange?.(page, nextSize); pagination?.onChange?.(page, nextSize); }} />}</div>;
}

export function Pagination({ current = 1, pageSize = 10, total = 0, onChange, pageSizeOptions, showSizeChanger, className, style }: LooseProps & { onChange?: (page: number, pageSize: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return <div className={`qoj-pagination ${className || ''}`} style={style}><Button aria-label="上一页" disabled={current <= 1} onClick={() => onChange?.(current - 1, pageSize)} icon={<ChevronLeft size={16} />} /><span>{current} / {pageCount}</span><Button aria-label="下一页" disabled={current >= pageCount} onClick={() => onChange?.(current + 1, pageSize)} icon={<ChevronRight size={16} />} />{showSizeChanger && <select aria-label="每页条数" value={pageSize} onChange={(event) => onChange?.(1, Number(event.target.value))}>{(pageSizeOptions || [10, 20, 50]).map((size: number) => <option key={size} value={size}>{size} / 页</option>)}</select>}</div>;
}

export const Modal = ({ open, title, children, onCancel, onOk, footer, okText = '确定', cancelText = '取消', okButtonProps, confirmLoading, width = 560, style, styles, className, closable = true, maskClosable = true }: LooseProps) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previous; };
  }, [open, onCancel]);
  if (!open) return null;
  return createPortal(<div className="qoj-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget && maskClosable) onCancel?.(); }}><section role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={`qoj-modal ${className || ''}`} style={{ width, maxWidth: 'calc(100vw - 24px)', ...style }}><header className="qoj-modal-head"><h2>{title}</h2>{closable && <button type="button" aria-label="关闭" onClick={onCancel}><X size={18} /></button>}</header><div className="qoj-modal-body" style={styles?.body}>{children}</div>{footer !== null && <footer className="qoj-modal-footer">{footer === undefined ? <><Button onClick={onCancel}>{cancelText}</Button><Button type="primary" disabled={okButtonProps?.disabled} loading={confirmLoading} onClick={onOk}>{okText}</Button></> : footer}</footer>}</section></div>, document.body);
};

export const Drawer = ({ open, title, children, onClose, placement = 'right', width = 320, styles }: LooseProps) => {
  useEffect(() => { if (!open) return; const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose?.(); }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, [open, onClose]);
  if (!open) return null;
  return createPortal(<div className="qoj-drawer-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside role="dialog" aria-modal="true" aria-label={title} className="qoj-drawer" style={{ width, [placement]: 0 }}><header><strong>{title}</strong><button type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button></header><div style={styles?.body}>{children}</div></aside></div>, document.body);
};

export const Tabs = ({ items = [], activeKey, defaultActiveKey, onChange, className, style }: LooseProps & { onChange?: (key: string) => void }) => {
  const [internal, setInternal] = useState(defaultActiveKey || items[0]?.key);
  const selected = activeKey ?? internal;
  return <div className={`qoj-tabs ${className || ''}`} style={style}><div className="qoj-tabs-list" role="tablist">{items.map((item: any) => <button key={item.key} type="button" role="tab" aria-selected={selected === item.key} className={selected === item.key ? 'is-active' : ''} onClick={() => { setInternal(item.key); onChange?.(item.key); }}>{item.label}</button>)}</div><div role="tabpanel" className="qoj-tabs-panel">{items.find((item: any) => item.key === selected)?.children}</div></div>;
};

export type MenuProps = { onClick?: (info: { key: string }) => void; items?: Array<{ key?: string; label?: ReactNode; icon?: ReactNode; type?: string; danger?: boolean }> };
export const Menu = ({ items = [], selectedKeys = [], onClick, mode, style, className }: LooseProps) => <nav className={`qoj-menu ${mode === 'horizontal' ? 'qoj-menu-horizontal' : ''} ${className || ''}`} style={style}>{items.map((item: any, index: number) => item.type === 'divider' ? <Divider key={index} /> : <button key={item.key || index} type="button" className={selectedKeys.includes(item.key) ? 'is-active' : ''} onClick={() => onClick?.({ key: item.key })}>{item.icon}{item.label}</button>)}</nav>;
export const Result = ({ status, title, subTitle, extra }: LooseProps) => <div className={`qoj-result qoj-result-${status}`}><h2>{title}</h2><p>{subTitle}</p>{extra}</div>;
export const ConfigProvider = ({ children, theme: uiTheme }: LooseProps) => <div className={uiTheme?.algorithm === 'dark' ? 'qoj-theme-dark' : undefined} style={{ display: 'contents' }}>{children}</div>;
export const theme = { defaultAlgorithm: 'light', darkAlgorithm: 'dark' };

export const Carousel = ({ children, autoplay, autoplaySpeed = 5000, arrows, dots = true, className, style }: LooseProps) => {
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  useEffect(() => { if (!autoplay || slides.length <= 1) return; const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), autoplaySpeed); return () => window.clearInterval(id); }, [autoplay, autoplaySpeed, slides.length]);
  return <div className={`qoj-carousel ${className || ''}`} style={style}>{slides[index]}{arrows && slides.length > 1 && <><button className="qoj-carousel-arrow is-prev" type="button" aria-label="上一张" onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}><ChevronLeft size={20} /></button><button className="qoj-carousel-arrow is-next" type="button" aria-label="下一张" onClick={() => setIndex((i) => (i + 1) % slides.length)}><ChevronRight size={20} /></button></>}{dots && slides.length > 1 && <div className="qoj-carousel-dots">{slides.map((_, i) => <button key={i} type="button" aria-label={`第 ${i + 1} 张`} aria-current={i === index} onClick={() => setIndex(i)} />)}</div>}</div>;
};

function toast(kind: string, content: ReactNode, duration = 3) {
  const node = document.createElement('div');
  node.className = `qoj-toast qoj-toast-${kind}`;
  node.textContent = String(content);
  document.body.appendChild(node);
  window.setTimeout(() => node.remove(), duration * 1000);
}
export const message = { success: (content: ReactNode, duration?: number) => toast('success', content, duration), error: (content: ReactNode, duration?: number) => toast('error', content, duration), info: (content: ReactNode, duration?: number) => toast('info', content, duration), warning: (content: ReactNode, duration?: number) => toast('warning', content, duration) };
