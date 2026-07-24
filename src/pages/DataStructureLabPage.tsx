import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Card, Input, Select, Tag, Typography } from '@douyinfe/semi-ui';
import {
  IconBranch,
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconFile,
  IconLayers,
  IconList,
  IconOrderedList,
  IconPause,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStackBarChartStroked,
  IconTreeTriangleDown,
  IconUpload,
} from '@douyinfe/semi-icons';
import { PageContainer } from '../components/common';
import { LAB_CATEGORIES, STRUCTURE_CATALOG, getStructureDefinition } from './data-structure-lab/catalog';
import { createInitialFrame, executeOperation, MAX_HISTORY_FRAMES } from './data-structure-lab/engine';
import { StructureVisual } from './data-structure-lab/StructureVisual';
import type { LabCategory, LabFrame, OperationDefinition, StructureDefinition } from './data-structure-lab/types';
import './DataStructureLabPage.css';

const DEFAULT_CATEGORY: LabCategory = 'linear';

function iconFor(iconKey: string): ReactNode {
  switch (iconKey) {
    case 'linked': return <IconBranch />;
    case 'stack': return <IconStackBarChartStroked />;
    case 'queue': return <IconOrderedList />;
    case 'hash': return <IconSearch />;
    case 'tree': return <IconTreeTriangleDown />;
    case 'heap': return <IconLayers />;
    case 'graph': return <IconBranch />;
    case 'text': return <IconFile />;
    case 'matrix': return <IconList />;
    case 'bits': return <IconCode />;
    case 'filter': return <IconSearch />;
    case 'sketch': return <IconLayers />;
    default: return <IconList />;
  }
}

function defaultFields(operation: OperationDefinition) {
  return Object.fromEntries((operation.fields ?? []).map((field) => {
    if (field.key === 'value') return [field.key, '72'];
    if (field.key === 'index') return [field.key, '2'];
    if (field.key === 'key') return [field.key, '42'];
    if (field.key === 'text') return [field.key, 'DATA'];
    if (field.key === 'start') return [field.key, field.type === 'number' ? '1' : 'A'];
    if (field.key === 'end') return [field.key, field.type === 'number' ? '4' : 'B'];
    if (field.key === 'row') return [field.key, '1'];
    if (field.key === 'column') return [field.key, '1'];
    return [field.key, ''];
  }));
}

function randomInput(definition: StructureDefinition) {
  if (definition.visualFamily === 'text' || definition.visualFamily === 'trie' || definition.visualFamily === 'sketch' || definition.visualFamily === 'filter') return 'DATA, TREE, ALGORITHM';
  if (definition.visualFamily === 'graph' || definition.visualFamily === 'dsu') return definition.visualFamily === 'graph' ? 'A, B, C, D, E, F' : '0, 1, 2, 3, 4, 5';
  if (definition.visualFamily === 'matrix') return Array.from({ length: 9 }, () => Math.floor(Math.random() * 90) + 10).join(', ');
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 90) + 10).join(', ');
}

function frameStatusLabel(frame: LabFrame) {
  if (frame.status === 'warning') return '需要注意';
  if (frame.status === 'neutral') return '观察中';
  return '已完成';
}

export function DataStructureLabPage() {
  const [categoryKey, setCategoryKey] = useState<LabCategory>(DEFAULT_CATEGORY);
  const [searchText, setSearchText] = useState('');
  const [structureKey, setStructureKey] = useState('array');
  const [inputText, setInputText] = useState(getStructureDefinition('array').defaultInput);
  const [loadedInput, setLoadedInput] = useState(getStructureDefinition('array').defaultInput);
  const [operationKey, setOperationKey] = useState(getStructureDefinition('array').operations[0].key);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(defaultFields(getStructureDefinition('array').operations[0]));
  const [history, setHistory] = useState<LabFrame[]>([createInitialFrame(getStructureDefinition('array'), getStructureDefinition('array').defaultInput)]);
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimer = useRef<number | null>(null);

  const definition = getStructureDefinition(structureKey);
  const currentFrame = history[stepIndex] ?? history[0];
  const currentOperation = definition.operations.find((operation) => operation.key === operationKey) ?? definition.operations[0];

  const visibleStructures = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    return STRUCTURE_CATALOG.filter((item) => {
      if (!normalized) return item.category === categoryKey;
      return `${item.name} ${item.englishName} ${item.group}`.toLowerCase().includes(normalized);
    });
  }, [categoryKey, searchText]);

  const groupedVisibleStructures = useMemo(() => {
    const groups = new Map<string, StructureDefinition[]>();
    visibleStructures.forEach((item) => groups.set(item.group, [...(groups.get(item.group) ?? []), item]));
    return Array.from(groups.entries());
  }, [visibleStructures]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (stepIndex >= history.length - 1) {
      setIsPlaying(false);
      return undefined;
    }
    playbackTimer.current = window.setTimeout(() => {
      setStepIndex((current) => Math.min(current + 1, history.length - 1));
    }, 720);
    return () => {
      if (playbackTimer.current !== null) window.clearTimeout(playbackTimer.current);
    };
  }, [history.length, isPlaying, stepIndex]);

  useEffect(() => () => {
    if (playbackTimer.current !== null) window.clearTimeout(playbackTimer.current);
  }, []);

  const resetWithInput = (nextInput: string, nextDefinition = definition) => {
    setInputText(nextInput);
    setLoadedInput(nextInput);
    setHistory([createInitialFrame(nextDefinition, nextInput)]);
    setStepIndex(0);
    setErrorMessage('');
    setIsPlaying(false);
  };

  const handleStructureChange = (nextKey: string) => {
    const nextDefinition = getStructureDefinition(nextKey);
    setStructureKey(nextKey);
    setCategoryKey(nextDefinition.category);
    setOperationKey(nextDefinition.operations[0].key);
    setFieldValues(defaultFields(nextDefinition.operations[0]));
    resetWithInput(nextDefinition.defaultInput, nextDefinition);
  };

  const handleCategoryChange = (nextCategory: LabCategory) => {
    const firstStructure = STRUCTURE_CATALOG.find((item) => item.category === nextCategory);
    setCategoryKey(nextCategory);
    setSearchText('');
    if (firstStructure) handleStructureChange(firstStructure.key);
  };

  const handleOperationChange = (nextKey: string) => {
    const nextOperation = definition.operations.find((operation) => operation.key === nextKey) ?? definition.operations[0];
    setOperationKey(nextKey);
    setFieldValues(defaultFields(nextOperation));
    setErrorMessage('');
  };

  const handleLoadInput = () => {
    if (!inputText.trim()) {
      setErrorMessage('请先输入一组数据。');
      return;
    }
    resetWithInput(inputText);
  };

  const handleExecute = () => {
    const frames = executeOperation(definition, currentFrame, operationKey, fieldValues);
    if (frames.length === 0) {
      setErrorMessage('当前操作没有产生可展示的步骤。');
      return;
    }
    const nextHistory = [...history.slice(0, stepIndex + 1), ...frames];
    const boundedHistory = nextHistory.length > MAX_HISTORY_FRAMES
      ? [nextHistory[0], ...nextHistory.slice(-(MAX_HISTORY_FRAMES - 1))]
      : nextHistory;
    setHistory(boundedHistory);
    setStepIndex(boundedHistory.length - 1);
    setErrorMessage('');
    setIsPlaying(false);
  };

  const handleRandomInput = () => resetWithInput(randomInput(definition));

  return (
    <main className="data-structure-lab-standalone">
      <PageContainer title="数据结构实验室" subtitle="Data Structure Lab" description="选择一种结构，输入数据并逐步观察每一次操作带来的状态变化。">
        <div className="data-structure-lab">
          <section className="lab-learning-guide" aria-label="实验步骤">
            <div className="lab-guide-title"><strong>学习路径</strong><span>先选择结构，再执行操作，最后回放每一个中间状态。</span></div>
            <div className="lab-guide-steps"><span><b>1</b>选择结构</span><i>→</i><span><b>2</b>准备数据</span><i>→</i><span><b>3</b>执行操作</span><i>→</i><span><b>4</b>回放动画</span></div>
          </section>

          <section className="lab-catalog-section" aria-labelledby="lab-catalog-heading">
            <div className="lab-section-heading">
              <div><Typography.Title heading={4} id="lab-catalog-heading" style={{ margin: 0 }}>数据结构目录</Typography.Title><Typography.Text type="tertiary">共 {STRUCTURE_CATALOG.length} 种结构，按知识类别组织。</Typography.Text></div>
              <Input prefix={<IconSearch />} value={searchText} onChange={setSearchText} placeholder="搜索结构名称" showClear onClear={() => setSearchText('')} style={{ width: 240 }} />
            </div>
            <div className="lab-category-tabs" role="tablist" aria-label="数据结构类别">
              {LAB_CATEGORIES.map((category) => <button type="button" role="tab" aria-selected={categoryKey === category.key} className={`lab-category-tab ${categoryKey === category.key ? 'is-selected' : ''}`} key={category.key} onClick={() => handleCategoryChange(category.key)}><strong>{category.label}</strong><small>{category.description}</small><em>{STRUCTURE_CATALOG.filter((item) => item.category === category.key).length}</em></button>)}
            </div>
            <div className="lab-catalog-groups">
              {groupedVisibleStructures.map(([group, items]) => <div className="lab-catalog-group" key={group}><div className="lab-catalog-group-title"><span>{group}</span><small>{items.length} 种</small></div><div className="lab-structure-grid">{items.map((item) => <button type="button" className={`lab-structure-option ${structureKey === item.key ? 'is-selected' : ''}`} aria-pressed={structureKey === item.key} key={item.key} onClick={() => handleStructureChange(item.key)}><span className="lab-structure-icon" aria-hidden="true">{iconFor(item.iconKey)}</span><span className="lab-structure-copy"><strong>{item.name}</strong><small>{item.englishName}</small><em>{item.description}</em></span></button>)}</div></div>)}
              {groupedVisibleStructures.length === 0 ? <div className="lab-catalog-empty">没有找到匹配的数据结构，请换一个关键词。</div> : null}
            </div>
          </section>

          <div className="lab-workspace">
            <Card className="lab-control-card" title="实验设置" bordered>
              <div className="lab-control-group"><label className="lab-control-label" htmlFor="lab-initial-data">输入数据</label><Input id="lab-initial-data" value={inputText} onChange={setInputText} placeholder={definition.inputHint} showClear onClear={() => setInputText('')} /><Typography.Text type="tertiary" size="small">{definition.inputHint}</Typography.Text><div className="lab-inline-actions"><Button theme="solid" type="primary" icon={<IconUpload />} onClick={handleLoadInput}>加载数据</Button><Button theme="borderless" type="tertiary" icon={<IconRefresh />} onClick={handleRandomInput}>随机生成</Button></div></div>
              <div className="lab-control-divider" />
              <div className="lab-control-group"><div className="lab-control-label">选择操作</div><Select value={operationKey} onChange={(value) => handleOperationChange(String(value))} optionList={definition.operations.map((operation) => ({ value: operation.key, label: operation.label }))} style={{ width: '100%' }} /><Typography.Text type="tertiary" size="small">{currentOperation.description}</Typography.Text>{(currentOperation.fields ?? []).map((field) => <div className="lab-field-row" key={field.key}><label className="lab-field-label" htmlFor={`lab-field-${field.key}`}>{field.label}</label><Input id={`lab-field-${field.key}`} type={field.type} value={fieldValues[field.key] ?? ''} onChange={(value) => setFieldValues((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} /></div>)}{errorMessage ? <div className="lab-error-message" role="alert">{errorMessage}</div> : null}<Button className="lab-execute-button" theme="solid" type="primary" block icon={<IconPlay />} onClick={handleExecute}>执行操作</Button></div>
              <div className="lab-control-divider" />
              <div className="lab-control-summary"><span>当前结构</span><strong>{definition.name}</strong></div><div className="lab-complexity-row"><span>复杂度提示</span><code>{definition.complexity}</code></div>
            </Card>

            <Card className="lab-stage-card" title={<div className="lab-stage-title"><span>{definition.name} · 结构状态</span><Tag color={currentFrame.status === 'warning' ? 'orange' : 'green'} size="small">{frameStatusLabel(currentFrame)}</Tag></div>} bordered>
              <div className="lab-stage-meta"><span>{definition.beginnerNote}</span><span>动画第 {stepIndex} / {history.length - 1} 步</span></div>
              <div className="lab-visual-stage"><StructureVisual definition={definition} frame={currentFrame} /></div>
              <div className={`lab-stage-detail is-${currentFrame.status}`}><span className="lab-detail-marker" aria-hidden="true" /><div><strong>{currentFrame.operationLabel}</strong><p>{currentFrame.detail}</p></div></div>
              <div className="lab-stage-controls" aria-label="步骤控制"><Button theme="borderless" type="tertiary" icon={<IconRefresh />} onClick={() => resetWithInput(loadedInput)}>重置实验</Button><div className="lab-step-actions"><Button theme="light" type="tertiary" icon={<IconChevronLeft />} disabled={stepIndex === 0} aria-label="上一步" onClick={() => { setIsPlaying(false); setStepIndex((current) => Math.max(0, current - 1)); }} /><Button theme="light" type="tertiary" icon={isPlaying ? <IconPause /> : <IconPlay />} disabled={!isPlaying && stepIndex >= history.length - 1} aria-label={isPlaying ? '暂停播放' : '自动播放'} onClick={() => setIsPlaying((current) => !current)}>{isPlaying ? '暂停' : '自动播放'}</Button><Button theme="light" type="tertiary" icon={<IconChevronRight />} disabled={stepIndex >= history.length - 1} aria-label="下一步" onClick={() => { setIsPlaying(false); setStepIndex((current) => Math.min(history.length - 1, current + 1)); }} /></div></div>
            </Card>

            <Card className="lab-history-card" title={<div className="lab-history-title"><span>动画时间线</span><Tag size="small">{history.length - 1} 个步骤</Tag></div>} bordered>
              <div className="lab-history-list" aria-label="动画时间线">{history.map((frame, index) => <button type="button" className={`lab-history-item ${index === stepIndex ? 'is-current' : ''}`} aria-current={index === stepIndex ? 'step' : undefined} key={`${frame.operationLabel}-${index}`} onClick={() => { setIsPlaying(false); setStepIndex(index); }}><span className="lab-history-index">{index}</span><span className="lab-history-content"><strong>{frame.operationLabel}</strong><small>{frame.detail}</small></span></button>)}</div><div className="lab-history-tip"><IconLayers aria-hidden="true" /><span>点击某一步，回看这个时刻的结构状态；自动播放会按顺序重放所有步骤。</span></div>
            </Card>
          </div>

          <section className="lab-learning-strip" aria-label="当前结构学习重点"><div className="lab-learning-icon" aria-hidden="true">{iconFor(definition.iconKey)}</div><div><Typography.Text strong>{definition.name}：新生学习重点</Typography.Text><Typography.Text type="tertiary">{definition.learn}</Typography.Text></div><div className="lab-learning-points"><span><IconPlus aria-hidden="true" /> 先观察结构</span><span><IconPlay aria-hidden="true" /> 再执行操作</span><span><IconLayers aria-hidden="true" /> 最后回放动画</span></div></section>
        </div>
      </PageContainer>
    </main>
  );
}
