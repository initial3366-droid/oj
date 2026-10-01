/**
 * AI 控制台出题页面。通过独立 qoj-agent 服务生成题目，并展示服务端实时进度。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Grid,
  Input,
  InputNumber,
  Progress,
  Space,
  Tag,
  Typography,
} from '@arco-design/web-react';
import {
  IconCheckCircle,
  IconCloseCircle,
  IconLoading,
  IconRobot,
  IconThunderbolt,
} from '@arco-design/web-react/icon';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import { generateProblem, type AgentWorkspace } from '../../../api/aiAgent';
import { HtmlMath } from '../../../components/HtmlMath';
import './AdminAiProblemGeneratorPage.css';

const Row = Grid.Row;
const Col = Grid.Col;
const TextArea = Input.TextArea;

type GeneratorStatus = 'idle' | 'running' | 'success' | 'cancelled';

type ProgressItem = {
  key: string;
  label: string;
  detail: string;
  state: 'waiting' | 'running' | 'success' | 'error';
};

type GeneratedPreview = {
  title: string;
  rating: string;
  knowledgePoints: string[];
  statement: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
  statementHtml: string;
  statementLatex: string;
  inputFormatLatex: string;
  outputFormatLatex: string;
};

const initialSteps: ProgressItem[] = [
  { key: 'plan', label: '分析知识点与难度', detail: '等待任务开始', state: 'waiting' },
  { key: 'statement', label: '生成题面结构', detail: '等待任务开始', state: 'waiting' },
  { key: 'solution', label: '生成参考解与数据策略', detail: '等待任务开始', state: 'waiting' },
  { key: 'tests', label: '构造测试点', detail: '等待任务开始', state: 'waiting' },
  { key: 'verify', label: '运行判题校验', detail: '等待任务开始', state: 'waiting' },
  { key: 'review', label: '质量审查与发布准备', detail: '等待任务开始', state: 'waiting' },
];

/**
 * 渲染 AI 出题页面，并协调表单、模拟任务状态与实时进度展示。
 */
export function AdminAiProblemGeneratorPage() {
  const [form] = Form.useForm();
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ProgressItem[]>(initialSteps);
  const [logs, setLogs] = useState<string[]>([]);
  const [progressPanelHeight, setProgressPanelHeight] = useState<number | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<GeneratedPreview | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressPanelRef = useRef<HTMLDivElement>(null);

  const currentStep = useMemo(() => steps.find((step) => step.state === 'running'), [steps]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  useLayoutEffect(() => {
    const descriptionItem = document.querySelector<HTMLElement>('.ai-description-item');
    const progressPanel = progressPanelRef.current;
    if (!descriptionItem || !progressPanel) return undefined;

    const syncHeight = () => {
      if (!window.matchMedia('(min-width: 992px)').matches) {
        setProgressPanelHeight(null);
        return;
      }
      const descriptionBottom = descriptionItem.getBoundingClientRect().bottom;
      const panelTop = progressPanel.getBoundingClientRect().top;
      setProgressPanelHeight(Math.max(360, Math.ceil(descriptionBottom - panelTop)));
    };

    const observer = new ResizeObserver(syncHeight);
    observer.observe(descriptionItem);
    window.addEventListener('resize', syncHeight);
    syncHeight();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, []);

  const addLog = (message: string) => {
    setLogs((current) => [...current.slice(-7), `${new Date().toLocaleTimeString('zh-CN', { hour12: false })}  ${message}`]);
  };

  const resetProgress = () => {
    setProgress(0);
    setSteps(initialSteps);
    setLogs([]);
    setGeneratedPreview(null);
  };

  const startGeneration = async (values: Record<string, unknown>) => {
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller;
    resetProgress();
    setStatus('running');
    addLog(`已提交 Agent · ${String(values.knowledgePoints || '').split('、').filter(Boolean).join(' / ')}`);
    try {
      const workspace: AgentWorkspace = await generateProblem({
        title: String(values.title || ''), rating: String(values.difficultyRating || ''), background: String(values.background || ''), description: String(values.description || ''),
        knowledgePoints: String(values.knowledgePoints || '').split('、').map((item) => item.trim()).filter(Boolean), testCaseCount: Number(values.testCaseCount || 20),
      }, (event) => { setProgress(event.percent); addLog(`${event.stage}：${event.message}`); setSteps((current) => current.map((item, index) => index < Math.ceil(event.percent / 16.7) - 1 ? { ...item, state: 'success', detail: '已完成' } : index === Math.ceil(event.percent / 16.7) - 1 ? { ...item, state: 'running', detail: event.message } : item)); }, controller.signal);
      const p = workspace.problem;
      setGeneratedPreview({ title: p.title || workspace.title, rating: p.rating, knowledgePoints: p.knowledgePoints, statement: p.statementHtml, inputFormat: p.inputFormatHtml, outputFormat: p.outputFormatHtml, sampleInput: p.samples[0]?.input || '', sampleOutput: p.samples[0]?.output || '', statementHtml: p.statementHtml, statementLatex: p.statementLatex, inputFormatLatex: p.inputFormatLatex, outputFormatLatex: p.outputFormatLatex });
      setSteps((current) => current.map((item) => ({ ...item, state: 'success', detail: '已完成' }))); setProgress(100); setStatus('success'); addLog('出题、验题、跑测试完成，题面可编辑');
    } catch (error) {
      if (controller.signal.aborted) return; setStatus('cancelled'); addLog(error instanceof Error ? error.message : 'Agent 生成失败');
    }
  };

  const cancelGeneration = () => {
    abortRef.current?.abort(); abortRef.current = null;
    setStatus('cancelled');
    setSteps((current) => current.map((item) => item.state === 'running' ? { ...item, state: 'error', detail: '已取消' } : item));
    addLog('任务已取消，生成结果不会写入题库');
  };

  return (
    <div className="ai-problem-generator-page">
      <AdminPageContainer
        title="AI 控制台 · 出题"
        extra={<Tag color={status === 'running' ? 'blue' : status === 'success' ? 'green' : status === 'cancelled' ? 'gray' : 'arcoblue'}>{status === 'running' ? '生成中' : status === 'success' ? '已完成' : status === 'cancelled' ? '已取消' : '待开始'}</Tag>}
      >
        <Row gutter={24}>
          <Col xs={24} lg={15}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: '#4e5969' }}><IconRobot style={{ color: '#165dff' }} /><Typography.Text>让 Agent 根据知识点生成可验证的候选题目</Typography.Text></div>
            <Form form={form} layout="vertical" onSubmit={startGeneration} initialValues={{ testCaseCount: 20 }}>
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item label="题目名称" field="title">
                    <Input placeholder="可选，不填写时由 Agent 自动拟定" maxLength={80} showWordLimit style={{ height: 32 }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Codeforces 分值区间" field="difficultyRating" required={false} rules={[{ required: true, message: '请输入 Codeforces 分值区间' }]}>
                    <Input placeholder="例如 1200-1400" maxLength={20} style={{ height: 32 }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="知识点" field="knowledgePoints" required={false} rules={[{ required: true, message: '请输入至少一个知识点' }]}>
                <Input placeholder="例如：最短路、堆、贪心（使用顿号分隔）" maxLength={160} />
              </Form.Item>
              <Form.Item label="题目背景" field="background">
                <TextArea placeholder="可选，为题目提供故事背景或业务场景" autoSize={{ minRows: 3, maxRows: 6 }} maxLength={800} showWordLimit />
              </Form.Item>
              <Form.Item className="ai-description-item" label="题目详细描述" field="description" required={false} rules={[{ required: true, message: '请描述题目目标和约束方向' }]}>
                <TextArea placeholder="描述希望考察的问题、输入规模、特殊限制或出题意图" autoSize={{ minRows: 6, maxRows: 12 }} maxLength={3000} showWordLimit />
              </Form.Item>
              <Row gutter={16} align="end">
                <Col span={8}>
                  <Form.Item label="测试点数量" field="testCaseCount" required={false} rules={[{ required: true, message: '请输入测试点数量' }]}>
                    <InputNumber min={5} max={200} style={{ width: '100%' }} suffix="个" />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" htmlType="submit" icon={<IconThunderbolt />} loading={status === 'running'} disabled={status === 'running'}>开始生成</Button>
                    {status === 'running' && <Button icon={<IconCloseCircle />} onClick={cancelGeneration}>取消任务</Button>}
                    {(status === 'success' || status === 'cancelled') && <Button onClick={resetProgress}>重新开始</Button>}
                  </Space>
                </Col>
              </Row>
            </Form>
          </Col>
          <Col xs={24} lg={9}>
            <div ref={progressPanelRef} style={{ background: '#f7f8fa', borderRadius: 6, padding: 20, minHeight: 360, height: progressPanelHeight ? `${progressPanelHeight}px` : undefined, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Typography.Text bold>实时进度</Typography.Text>
              </div>
              <Progress percent={progress} status={status === 'cancelled' ? 'error' : status === 'success' ? 'success' : 'normal'} />
              <div style={{ marginTop: 22 }}>
                {steps.map((step) => (
                  <div key={step.key} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 20, flex: '0 0 20px', color: step.state === 'success' ? '#00b42a' : step.state === 'error' ? '#f53f3f' : step.state === 'running' ? '#165dff' : '#c9cdd4' }}>
                      {step.state === 'success' ? <IconCheckCircle /> : step.state === 'error' ? <IconCloseCircle /> : step.state === 'running' ? <IconLoading spin /> : <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#c9cdd4', margin: '0 6px 2px' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: step.state === 'waiting' ? '#86909c' : '#1d2129' }}>{step.label}</div>
                      <div style={{ fontSize: 12, color: '#86909c', marginTop: 3 }}>{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              {currentStep && <Typography.Text type="secondary" style={{ fontSize: 12 }}>当前阶段：{currentStep.label}</Typography.Text>}
            </div>
          </Col>
        </Row>
      </AdminPageContainer>

      {generatedPreview && (
        <AdminPageContainer
          title="生成结果预览"
          extra={<Space><Tag color="green">校验通过</Tag><Button type="primary" size="small" icon={<IconCheckCircle />}>保存为草稿</Button></Space>}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <Input value={generatedPreview.title} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, title: value }))} style={{ maxWidth: 620, fontSize: 20, fontWeight: 600 }} />
              <Typography.Text type="secondary">Codeforces 分值区间：{generatedPreview.rating}</Typography.Text>
            </div>
            <Space wrap>{generatedPreview.knowledgePoints.map((tag) => <Tag key={tag} color="arcoblue">{tag}</Tag>)}</Space>
          </div>
          <div style={{ marginTop: 20 }}>
            <Typography.Text bold style={{ display: 'block', marginBottom: 8 }}>题目描述</Typography.Text>
            <TextArea value={generatedPreview.statementHtml} autoSize={{ minRows: 8, maxRows: 20 }} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, statement: value, statementHtml: value }))} />
            <Typography.Text type="secondary">HTML 题面，可直接编辑；LaTeX 版本见下方。</Typography.Text>
            <TextArea value={generatedPreview.statementLatex} autoSize={{ minRows: 6, maxRows: 16 }} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, statementLatex: value }))} style={{ marginTop: 8, fontFamily: 'SFMono-Regular, Consolas, monospace' }} />
          </div>
          <div style={{ marginTop: 20 }}>
            <Typography.Text bold style={{ display: 'block', marginBottom: 8 }}>输入格式</Typography.Text>
            <TextArea value={generatedPreview.inputFormat} autoSize={{ minRows: 3, maxRows: 10 }} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, inputFormat: value }))} />
            <TextArea value={generatedPreview.inputFormatLatex} autoSize={{ minRows: 3, maxRows: 10 }} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, inputFormatLatex: value }))} style={{ marginTop: 8, fontFamily: 'SFMono-Regular, Consolas, monospace' }} />
          </div>
          <div style={{ marginTop: 20 }}>
            <Typography.Text bold style={{ display: 'block', marginBottom: 8 }}>输出格式</Typography.Text>
            <TextArea value={generatedPreview.outputFormat} autoSize={{ minRows: 3, maxRows: 10 }} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, outputFormat: value }))} />
            <TextArea value={generatedPreview.outputFormatLatex} autoSize={{ minRows: 3, maxRows: 10 }} onChange={(value) => setGeneratedPreview((current) => current && ({ ...current, outputFormatLatex: value }))} style={{ marginTop: 8, fontFamily: 'SFMono-Regular, Consolas, monospace' }} />
          </div>
          <Typography.Title heading={5} style={{ marginTop: 20 }}>样例</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Typography.Text type="secondary">输入</Typography.Text>
              <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', background: '#f7f8fa', borderRadius: 4, padding: '12px 14px', lineHeight: 1.6, fontFamily: 'SFMono-Regular, Consolas, monospace' }}>{generatedPreview.sampleInput}</pre>
            </Col>
            <Col xs={24} lg={12}>
              <Typography.Text type="secondary">输出</Typography.Text>
              <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', background: '#f7f8fa', borderRadius: 4, padding: '12px 14px', lineHeight: 1.6, fontFamily: 'SFMono-Regular, Consolas, monospace' }}>{generatedPreview.sampleOutput}</pre>
            </Col>
          </Row>
          <div style={{ borderTop: '1px solid #e5e6eb', marginTop: 28, paddingTop: 24 }}>
            <Typography.Title heading={4} style={{ marginTop: 0 }}>题目预览</Typography.Title>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 32px', border: '1px solid #e5e6eb', borderRadius: 6, background: '#fff' }}>
              <Typography.Title heading={3} style={{ marginTop: 0 }}>{generatedPreview.title}</Typography.Title>
              <Space wrap style={{ marginBottom: 20 }}>{generatedPreview.knowledgePoints.map((tag) => <Tag key={tag} color="arcoblue">{tag}</Tag>)}<Tag color="gray">CF {generatedPreview.rating}</Tag></Space>
              <Typography.Title heading={5}>题目描述</Typography.Title>
              <HtmlMath value={generatedPreview.statementHtml} emptyText="暂无题目描述" />
              <Typography.Title heading={5}>输入格式</Typography.Title>
              <HtmlMath value={generatedPreview.inputFormat} emptyText="无" />
              <Typography.Title heading={5}>输出格式</Typography.Title>
              <HtmlMath value={generatedPreview.outputFormat} emptyText="无" />
              <Typography.Title heading={5}>样例</Typography.Title>
              <Row gutter={16}>
                <Col xs={24} lg={12}><Typography.Text type="secondary">输入</Typography.Text><pre style={{ whiteSpace: 'pre-wrap', background: '#f7f8fa', padding: 12, borderRadius: 4 }}>{generatedPreview.sampleInput}</pre></Col>
                <Col xs={24} lg={12}><Typography.Text type="secondary">输出</Typography.Text><pre style={{ whiteSpace: 'pre-wrap', background: '#f7f8fa', padding: 12, borderRadius: 4 }}>{generatedPreview.sampleOutput}</pre></Col>
              </Row>
            </div>
          </div>
        </AdminPageContainer>
      )}

      <Card bordered={false} title="任务日志" extra={<Typography.Text type="secondary">实时更新</Typography.Text>}>
        <div style={{ minHeight: 88, fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 12, lineHeight: 1.8, color: '#4e5969', background: '#f7f8fa', padding: '12px 16px', borderRadius: 4 }}>
          {logs.length ? logs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>) : <Typography.Text type="secondary">提交任务后，这里会显示 Agent、判题器和质量审查的实时反馈。</Typography.Text>}
        </div>
      </Card>
    </div>
  );
}
