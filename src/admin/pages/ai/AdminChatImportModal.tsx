import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Input, InputNumber, Modal, Select, Spin } from '@arco-design/web-react';
import { adminGet, adminPost } from '../../api/adminClient';
import { adminPath } from '../../../utils/adminPath';
import type { ChatFileData } from './AdminChatImages';
import type { ImportSource } from './AdminChatFiles';
import { HtmlMathEditor } from '../../components/HtmlMathEditor';

const IMPORT_API = '/api/admin/v1/agent/chat/imports';
type Reference = { fileId: string; path: string; excerpt?: string | null };
type CaseMapping = { caseNo: number; input: Reference; output: Reference | null };
type Basic = { title: string; statement: string; inputFormat: string; outputFormat: string; timeLimit: number; memoryLimit: number; difficulty: number; tags: string[]; samples: { input: string; output: string; explanation?: string }[]; checkerSource?: string | null };
type Candidate = { key: string; basic: Basic; testCases: CaseMapping[]; caseOptions: { reference: Reference; size: number; kind: string }[]; sources: Reference[]; warnings: string[] };
export type Imported = { id: number; title: string; testCaseCount: number; status: string };
export type ImportResult = { id: string; problems: Imported[] };
export type ApprovedImport = { planId: string; request: { selections: { key: string; basic: Basic; testCases: CaseMapping[] }[]; folderId: number | null } };
type Plan = { id: string; files: ChatFileData[]; candidates: Candidate[]; warnings: string[]; imported: Imported[] };
const refKey = (value: Reference) => JSON.stringify(value);
const refLabel = (value: Reference) => value.excerpt != null ? `${value.path} · 原文片段：${value.excerpt.trim().slice(0, 80)}` : value.path;

export function AdminChatImportModal({ source, onClose, onApprove }: { source: ImportSource; onClose: () => void; onApprove?: (approval: ApprovedImport) => Promise<ImportResult> }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Imported[]>([]);
  const [folders, setFolders] = useState<{ id: number; name: string; canEdit: boolean }[]>([]);
  const [folderId, setFolderId] = useState<number | undefined>();
  const [folderError, setFolderError] = useState('');
  const promiseRef = useRef<{ attempt: number; promise: Promise<Plan> } | null>(null);
  useEffect(() => {
    let canceled = false;
    setPlan(null); setError('');
    if (promiseRef.current?.attempt !== attempt) {
      promiseRef.current = { attempt, promise: source.planId ? adminGet<Plan>(`${IMPORT_API}/${encodeURIComponent(source.planId)}`) : adminPost<Plan>(`${IMPORT_API}/preview`, {
        fileIds: source.files.map((file) => file.id), useAi: true, instructions: source.instructions,
      }, true, 150000) };
    }
    void promiseRef.current.promise.then((data) => {
      if (canceled) return;
      setPlan(data); setCandidates(data.candidates); setSelected(data.candidates.map((candidate) => candidate.key)); setResult(data.imported || []);
      setSamples(Object.fromEntries(data.candidates.map((candidate) => [candidate.key, JSON.stringify(candidate.basic.samples || [], null, 2)])));
    }).catch((error: unknown) => { if (!canceled) setError(error instanceof Error ? error.message : 'AI 文件解析失败'); });
    return () => { canceled = true; };
  }, [attempt, source]);
  useEffect(() => {
    let canceled = false;
    void adminGet<typeof folders>('/api/admin/v1/problem-folders').then((items) => { if (!canceled) setFolders(items.filter((folder) => folder.canEdit)); })
      .catch((error: unknown) => { if (!canceled) setFolderError(error instanceof Error ? error.message : '文件夹加载失败'); });
    return () => { canceled = true; };
  }, []);
  const updateBasic = <K extends keyof Basic,>(key: string, field: K, value: Basic[K]) => setCandidates((items) => items.map((item) => item.key === key ? { ...item, basic: { ...item.basic, [field]: value } } : item));
  const importReady = selected.length > 0 && candidates.filter((item) => selected.includes(item.key)).every((item) => (
    item.basic.title.trim() && item.basic.statement.trim() && item.testCases.length <= 200 &&
    item.testCases.every((test) => test.output || item.basic.checkerSource?.trim())
  ));
  const commit = async () => {
    if (!plan || saving || result.length || !importReady) return;
    setError('');
    let selections;
    try {
      selections = candidates.filter((item) => selected.includes(item.key)).map((item) => {
        const parsed: unknown = JSON.parse(samples[item.key] || '[]');
        if (!Array.isArray(parsed)) throw new Error(`“${item.basic.title}”的样例应为 JSON 数组`);
        return { key: item.key, basic: { ...item.basic, samples: parsed as Basic['samples'] }, testCases: item.testCases };
      });
    } catch (error) { setError(error instanceof Error ? error.message : '样例 JSON 格式错误'); return; }
    setSaving(true);
    try {
      const request = { selections, folderId: folderId ?? null };
      const saved = source.planId && onApprove ? await onApprove({ planId: plan.id, request })
        : await adminPost<ImportResult>(`${IMPORT_API}/${encodeURIComponent(plan.id)}/commit`, request, true, 120000);
      setResult(saved.problems);
    } catch (error) { setError(error instanceof Error ? error.message : '题目导入失败，修改内容仍保留'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="AI 文件解析与题库导入" visible onCancel={() => { if (!saving) onClose(); }} maskClosable={!saving} escToExit={!saving}
      style={{ width: 'min(1060px, 96vw)' }} footer={result.length ? <Button type="primary" onClick={onClose}>完成</Button> : <>
        <Button disabled={saving} onClick={onClose}>取消</Button>
        <Button type="primary" loading={saving} disabled={!plan || !importReady} onClick={() => { void commit(); }}>确认导入 {selected.length} 道题（未发布）</Button>
      </>}>
      {error && <div className="admin-ai-chat__error" role="alert">{error}{!plan && <Button size="mini" onClick={() => setAttempt((value) => value + 1)}>重试 AI 解析</Button>}</div>}
      {!plan && !error && <div className="admin-ai-chat__thinking"><Spin />AI 正在理解文件、识别题目分组和测试数据配对…</div>}
      {result.length > 0 ? <div className="admin-ai-chat__import-success" role="status">
        <p>已导入 {result.length} 道题，均为未发布状态。</p>
        {result.map((item) => <div key={item.id}>#{item.id} · {item.title} · {item.testCaseCount ? `${item.testCaseCount} 个测试点` : '题面已保存，测试数据待补充'}</div>)}
        {plan?.candidates.some((item) => item.testCases.some((test) => test.input.excerpt != null || test.output?.excerpt != null)) && <details>
          <summary>查看原文测试数据</summary>
          {plan.candidates.map((item) => <section key={item.key}>
            <p>{item.basic.title}</p>
            {item.testCases.map((test, index) => <div key={index}>
              <p>测试点 {index + 1} · 原文片段 · {test.input.path}</p>
              <pre>{test.input.excerpt?.slice(0, 2000) ?? test.input.path}</pre>
              <pre>{test.output?.excerpt?.slice(0, 2000) ?? test.output?.path ?? '暂无答案'}</pre>
            </div>)}
          </section>)}
        </details>}
        <a href={adminPath('/problems')} target="_blank" rel="noopener noreferrer">打开本地题库</a>
      </div> : plan && <div className="admin-ai-chat__import-review">
        <p>AI 已给出整理方案。核对题面、样例、限制与配对后导入，测试内容读取原文件。</p>
        {!!plan.warnings.length && <div className="admin-ai-chat__file-warnings">{plan.warnings.map((warning, index) => <div key={index}>{warning}</div>)}</div>}
        <label className="admin-ai-chat__import-field">题库文件夹<Select aria-label="导入题库文件夹" value={folderId} allowClear placeholder="不归属文件夹"
          options={folders.map((folder) => ({ label: folder.name, value: folder.id }))} onChange={setFolderId} /></label>
        {folderError && <div className="admin-ai-chat__error">文件夹列表加载失败：{folderError}，仍可不指定文件夹导入。</div>}
        {candidates.map((candidate, index) => <section className="admin-ai-chat__import-candidate" key={candidate.key} aria-label={`候选题目 ${index + 1}`}>
          <Checkbox checked={selected.includes(candidate.key)} onChange={(checked) => setSelected((keys) => checked ? [...keys, candidate.key] : keys.filter((key) => key !== candidate.key))}>导入第 {index + 1} 题</Checkbox>
          <label className="admin-ai-chat__import-field">题目名称<Input aria-label={`第 ${index + 1} 题名称`} value={candidate.basic.title} maxLength={200} onChange={(value) => updateBasic(candidate.key, 'title', value)} /></label>
          <div className="admin-ai-chat__import-limits">
            <label>时间限制（ms）<InputNumber aria-label={`第 ${index + 1} 题时间限制`} value={candidate.basic.timeLimit} min={100} max={60000} onChange={(value) => updateBasic(candidate.key, 'timeLimit', value)} /></label>
            <label>内存限制（MB）<InputNumber aria-label={`第 ${index + 1} 题内存限制`} value={candidate.basic.memoryLimit} min={16} max={1024} onChange={(value) => updateBasic(candidate.key, 'memoryLimit', value)} /></label>
            <label>难度<InputNumber aria-label={`第 ${index + 1} 题难度`} value={candidate.basic.difficulty} min={1} max={5} onChange={(value) => updateBasic(candidate.key, 'difficulty', value)} /></label>
          </div>
          <div className="admin-ai-chat__import-field">题面（HTML / LaTeX）<HtmlMathEditor ariaLabel={`第 ${index + 1} 题题面`} value={candidate.basic.statement} rows={5} onChange={(value) => updateBasic(candidate.key, 'statement', value)} /></div>
          <details><summary>输入输出格式、样例和特殊判题</summary>
            <label className="admin-ai-chat__import-field">输入格式<Input.TextArea value={candidate.basic.inputFormat} onChange={(value) => updateBasic(candidate.key, 'inputFormat', value)} /></label>
            <label className="admin-ai-chat__import-field">输出格式<Input.TextArea value={candidate.basic.outputFormat} onChange={(value) => updateBasic(candidate.key, 'outputFormat', value)} /></label>
            <label className="admin-ai-chat__import-field">样例（JSON 数组）<Input.TextArea aria-label={`第 ${index + 1} 题样例`} value={samples[candidate.key] || '[]'} onChange={(value) => setSamples((items) => ({ ...items, [candidate.key]: value }))} /></label>
            <label className="admin-ai-chat__import-field">特殊判题源码<Input.TextArea value={candidate.basic.checkerSource || ''} onChange={(value) => updateBasic(candidate.key, 'checkerSource', value)} /></label>
          </details>
          {!!candidate.warnings.length && <div className="admin-ai-chat__file-warnings">{candidate.warnings.map((warning, key) => <div key={key}>{warning}</div>)}</div>}
          {!candidate.testCases.length && <p>暂无测试数据，将保存为未发布题面，补充测试点后才能用于判题。</p>}
          <details className="admin-ai-chat__case-mapping" open={candidate.testCases.some((test) => !test.output)}><summary>{candidate.testCases.length} 个测试点 · 查看或修改答案配对</summary>
            {candidate.testCases.map((test, caseIndex) => <div className="admin-ai-chat__case-row" key={caseIndex}>
              <span title={test.input.excerpt ?? undefined}>{caseIndex + 1}. {refLabel(test.input)}</span><span>→</span>
              <Select aria-label={`第 ${index + 1} 题测试点 ${caseIndex + 1} 答案`} allowClear showSearch placeholder="缺少答案，请选择原文件" value={test.output ? refKey(test.output) : undefined}
                options={candidate.caseOptions.filter((option) => option.kind !== 'input').map((option) => ({ label: refLabel(option.reference), value: refKey(option.reference) }))}
                onChange={(value: string | undefined) => setCandidates((items) => items.map((item) => item.key === candidate.key ? { ...item, testCases: item.testCases.map((mapping, mappingIndex) => mappingIndex === caseIndex ? { ...mapping, output: value ? JSON.parse(value) as Reference : null } : mapping) } : item))} />
            </div>)}
          </details>
          <details><summary>来源文件（{candidate.sources.length}）</summary><ul>{candidate.sources.map((reference) => <li key={refKey(reference)}>{reference.path}</li>)}</ul></details>
        </section>)}
        {!importReady && <p className="admin-ai-chat__error">所选题目需要完整题面；已有测试输入必须提供对应答案或特殊判题源码。</p>}
      </div>}
    </Modal>
  );
}
