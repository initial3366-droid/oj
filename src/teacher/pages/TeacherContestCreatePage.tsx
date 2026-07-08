import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Radio,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconLeft, IconPlus, IconSave, IconSearch } from '@arco-design/web-react/icon';
import { teacherGet, teacherPost, teacherPut } from '../teacherApi';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;
const Step = Steps.Step;
const RadioGroup = Radio.Group;

type Audience = 'ALL' | 'CLASS';
type ContestType = 'ACM' | 'OI';

interface Problem {
  id: number;
  title: string;
  difficulty: number;
  timeLimit: number;
  memoryLimit: number;
  tags?: string[];
  folderId?: number;
  folderName?: string;
  testCaseCount?: number;
}

interface Folder {
  id: number;
  name: string;
  problems: Problem[];
}

interface ClassOption {
  id: number;
  name: string;
}

interface SelectedProblem {
  problemId: number;
  label: string;
  score: number;
  displayOrder: number;
}

interface ContestDraft {
  title: string;
  description: string;
  type: ContestType;
  durationMinutes: number;
  startTime: string;
  audienceTypes: Audience[];
  classIds: number[];
  frozen: boolean;
  freezeTime: string;
  enableRollingScoreboard: boolean;
  goldRatio: number;
  silverRatio: number;
  bronzeRatio: number;
  allowAfterEndSubmit: boolean;
  allowAfterEndViewProblem: boolean;
  publicScoreboardEnabled: boolean;
  allowStarRegistration: boolean;
  allowViewAllSubmissions: boolean;
  registrationPassword: string;
  totalScore: number;
  problems: SelectedProblem[];
}

const emptyDraft: ContestDraft = {
  title: '',
  description: '',
  type: 'ACM',
  durationMinutes: 180,
  startTime: '',
  audienceTypes: ['ALL'],
  classIds: [],
  frozen: false,
  freezeTime: '',
  enableRollingScoreboard: false,
  goldRatio: 10,
  silverRatio: 20,
  bronzeRatio: 30,
  allowAfterEndSubmit: false,
  allowAfterEndViewProblem: true,
  publicScoreboardEnabled: true,
  allowStarRegistration: false,
  allowViewAllSubmissions: true,
  registrationPassword: '',
  totalScore: 100,
  problems: [],
};

function labelOf(index: number) {
  return String.fromCharCode(65 + index);
}

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const difficultyMap: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

export function TeacherContestCreatePage() {
  const navigate = useNavigate();
  const { contestId } = useParams();
  const isEditing = Boolean(contestId);
  const numericContestId = contestId ? Number(contestId) : undefined;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<ContestDraft>({ ...emptyDraft, startTime: nowLocalInput() });
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const [problemKeyword, setProblemKeyword] = useState('');

  const selectedAudienceTypes = draft.audienceTypes;
  const currentAudience: Audience = selectedAudienceTypes.includes('ALL') ? 'ALL' : 'CLASS';
  const selectedProblemIds = new Set(draft.problems.map((p) => p.problemId));

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [classResult, folderResult] = await Promise.all([
        teacherGet<ClassOption[]>('/api/teacher/v1/classes').catch(() => []),
        teacherGet<Folder[]>('/api/admin/v1/problem-folders').catch(() => []),
      ]);
      setClasses(classResult);
      setFolders(folderResult);

      if (isEditing && numericContestId) {
        const contest = await teacherGet<any>(`/api/admin/v1/contests/${numericContestId}`);
        const audienceTypes: Audience[] = contest.audiences?.some((a: any) => a.audienceType === 'ALL')
          ? ['ALL']
          : contest.audiences?.map((a: any) => a.audienceType).filter((t: string) => t === 'ALL' || t === 'CLASS') ?? ['ALL'];
        const classIds = contest.audiences
          ?.filter((a: any) => a.audienceType === 'CLASS' && a.audienceId > 0)
          .map((a: any) => a.audienceId) ?? [];

        setDraft({
          title: contest.title,
          description: contest.description || '',
          type: contest.type,
          durationMinutes: contest.durationMinutes || 180,
          startTime: contest.startTime?.slice(0, 16) || '',
          audienceTypes: audienceTypes.length ? audienceTypes : ['ALL'],
          classIds,
          frozen: contest.frozen ?? false,
          freezeTime: contest.freezeTime?.slice(0, 16) || '',
          enableRollingScoreboard: contest.enableRollingScoreboard ?? false,
          goldRatio: contest.goldRatio ?? 10,
          silverRatio: contest.silverRatio ?? 20,
          bronzeRatio: contest.bronzeRatio ?? 30,
          allowAfterEndSubmit: contest.allowAfterEndSubmit ?? false,
          allowAfterEndViewProblem: contest.allowAfterEndViewProblem ?? true,
          publicScoreboardEnabled: contest.publicScoreboardEnabled ?? true,
          allowStarRegistration: contest.allowStarRegistration ?? false,
          allowViewAllSubmissions: contest.allowViewAllSubmissions ?? true,
          registrationPassword: '',
          totalScore: contest.problems?.reduce((sum: number, p: any) => sum + Number(p.score ?? 0), 0) || 100,
          problems: (contest.problems ?? []).map((p: any, i: number) => ({
            problemId: p.problemId,
            label: p.label || labelOf(i),
            score: p.score ?? 0,
            displayOrder: p.displayOrder ?? i + 1,
          })),
        });
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(patch: Partial<ContestDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function chooseAudience(type: Audience) {
    if (type === 'ALL') {
      updateDraft({ audienceTypes: ['ALL'], classIds: [] });
    } else {
      updateDraft({ audienceTypes: ['CLASS'] });
    }
  }

  function toggleClassId(classId: number) {
    setDraft((prev) => {
      const ids = prev.classIds.includes(classId)
        ? prev.classIds.filter((id) => id !== classId)
        : [...prev.classIds, classId];
      return { ...prev, classIds: ids };
    });
  }

  function toggleProblem(problemId: number) {
    setDraft((prev) => {
      const exists = prev.problems.some((p) => p.problemId === problemId);
      let next: SelectedProblem[];
      if (exists) {
        next = prev.problems.filter((p) => p.problemId !== problemId);
      } else {
        next = [...prev.problems, { problemId, label: '', score: 0, displayOrder: 0 }];
      }
      next = next.map((p, i) => ({ ...p, label: labelOf(i), displayOrder: i + 1 }));
      if (prev.type === 'OI') {
        const perProblem = Math.floor(prev.totalScore / next.length);
        next = next.map((p) => ({ ...p, score: perProblem }));
      }
      return { ...prev, problems: next };
    });
  }

  function validateBasic(): boolean {
    if (!draft.title.trim()) { Message.warning('请输入比赛标题'); return false; }
    if (!draft.startTime) { Message.warning('请选择开始时间'); return false; }
    if (draft.durationMinutes < 1) { Message.warning('比赛时长至少 1 分钟'); return false; }
    if (currentAudience === 'CLASS' && draft.classIds.length === 0) { Message.warning('请选择至少一个班级'); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!validateBasic()) return;
    if (draft.problems.length === 0) { Message.warning('请至少选择一道题目'); return; }

    setSubmitting(true);
    try {
      const audiences = currentAudience === 'ALL'
        ? [{ audienceType: 'ALL', audienceId: 0 }]
        : draft.classIds.map((id) => ({ audienceType: 'CLASS', audienceId: id }));

      const startStr = draft.startTime.length === 16 ? `${draft.startTime}:00` : draft.startTime;
      const parts = startStr.split(/[-T:]/).map(Number);
      const endDate = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4] + draft.durationMinutes, parts[5] || 0);
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:${String(endDate.getSeconds()).padStart(2, '0')}`;

      const payload = {
        title: draft.title.trim(),
        description: draft.description?.trim() || '',
        type: draft.type,
        durationMinutes: draft.durationMinutes,
        startTime: startStr,
        endTime: endStr,
        audience: currentAudience,
        audienceId: currentAudience === 'CLASS' ? draft.classIds[0] : null,
        audiences,
        frozen: draft.frozen,
        freezeTime: draft.frozen && draft.freezeTime ? (draft.freezeTime.length === 16 ? `${draft.freezeTime}:00` : draft.freezeTime) : null,
        enableRollingScoreboard: draft.enableRollingScoreboard,
        goldRatio: draft.goldRatio,
        silverRatio: draft.silverRatio,
        bronzeRatio: draft.bronzeRatio,
        allowFullscreen: false,
        antiCheatEnabled: false,
        maxSwitches: 3,
        allowAfterEndSubmit: draft.allowAfterEndSubmit,
        allowAfterEndViewProblem: draft.allowAfterEndViewProblem,
        publicScoreboardEnabled: draft.publicScoreboardEnabled,
        allowStarRegistration: draft.allowStarRegistration,
        allowViewAllSubmissions: draft.allowViewAllSubmissions,
        registrationType: 'PUBLIC',
        registrationPassword: draft.registrationPassword?.trim() || undefined,
        problems: draft.problems.map((p) => ({
          problemId: p.problemId,
          label: p.label,
          score: draft.type === 'OI' ? p.score : 0,
          displayOrder: p.displayOrder,
          caseScores: [],
        })),
      };

      if (isEditing && numericContestId) {
        await teacherPut(`/api/admin/v1/contests/${numericContestId}`, payload);
        Message.success('比赛已更新');
      } else {
        await teacherPost('/api/admin/v1/contests', payload);
        Message.success('比赛已创建');
      }
      navigate('/teacher/contests');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredFolders = folders.map((folder) => {
    const filtered = problemKeyword.trim()
      ? folder.problems.filter((p) => p.title.toLowerCase().includes(problemKeyword.trim().toLowerCase()))
      : folder.problems;
    return { ...folder, filtered };
  }).filter((f) => f.filtered.length > 0 || !problemKeyword.trim());

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title={isEditing ? '编辑比赛' : '添加比赛'}
        loading={loading}
        extra={
          <Space>
            <Button icon={<IconLeft />} onClick={() => navigate('/teacher/contests')}>返回列表</Button>
            <Button type="primary" icon={<IconSave />} loading={submitting} onClick={handleSubmit}>
              {isEditing ? '保存修改' : '创建比赛'}
            </Button>
          </Space>
        }
      >
        <Steps current={step} style={{ maxWidth: 400, marginBottom: 24 }}>
          <Step title="比赛信息" />
          <Step title="选择题目" />
        </Steps>

        {step === 0 ? (
          <Form layout="vertical" style={{ maxWidth: 900 }}>
            <Row gutter={24}>
              <Col span={12}>
                <FormItem label="比赛标题" required>
                  <Input placeholder="请输入比赛标题" value={draft.title} onChange={(val) => updateDraft({ title: val })} />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="比赛开始时间" required>
                  <input className="arco-input" type="datetime-local" value={draft.startTime}
                    onChange={(e) => updateDraft({ startTime: e.target.value })} />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="比赛时长（分钟）" required>
                  <InputNumber min={1} style={{ width: '100%' }} value={draft.durationMinutes}
                    onChange={(val) => updateDraft({ durationMinutes: Number(val) || 1 })} />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="赛制" required>
                  <RadioGroup type="button" value={draft.type} onChange={(val) => updateDraft({ type: val })}>
                    <Radio value="ACM">ACM</Radio>
                    <Radio value="OI">OI</Radio>
                  </RadioGroup>
                </FormItem>
              </Col>
              {draft.type === 'OI' && (
                <Col span={12}>
                  <FormItem label="OI 总分">
                    <InputNumber min={0} style={{ width: '100%' }} value={draft.totalScore}
                      onChange={(val) => updateDraft({ totalScore: Number(val) || 100 })} />
                  </FormItem>
                </Col>
              )}
              <Col span={12}>
                <FormItem label="封榜">
                  <Switch checked={draft.frozen} onChange={(val) => updateDraft({ frozen: val })} />
                </FormItem>
              </Col>
              {draft.frozen && (
                <Col span={12}>
                  <FormItem label="封榜时间">
                    <input className="arco-input" type="datetime-local" value={draft.freezeTime}
                      onChange={(e) => updateDraft({ freezeTime: e.target.value })} />
                  </FormItem>
                </Col>
              )}
              <Col span={12}>
                <FormItem label="注册密码">
                  <Input placeholder="留空则无需密码" value={draft.registrationPassword}
                    onChange={(val) => updateDraft({ registrationPassword: val })} />
                </FormItem>
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />
            <Typography.Text type="secondary" style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>高级设置</Typography.Text>

            <Row gutter={24}>
              <Col span={6}>
                <FormItem label="滚动榜">
                  <Switch checked={draft.enableRollingScoreboard} onChange={(val) => updateDraft({ enableRollingScoreboard: val })} />
                </FormItem>
              </Col>
              <Col span={6}>
                <FormItem label="赛后允许提交">
                  <Switch checked={draft.allowAfterEndSubmit} onChange={(val) => updateDraft({ allowAfterEndSubmit: val })} />
                </FormItem>
              </Col>
              <Col span={6}>
                <FormItem label="赛后查看题目">
                  <Switch checked={draft.allowAfterEndViewProblem} onChange={(val) => updateDraft({ allowAfterEndViewProblem: val })} />
                </FormItem>
              </Col>
              <Col span={6}>
                <FormItem label="公开榜单">
                  <Switch checked={draft.publicScoreboardEnabled} onChange={(val) => updateDraft({ publicScoreboardEnabled: val })} />
                </FormItem>
              </Col>
              <Col span={6}>
                <FormItem label="打星报名">
                  <Switch checked={draft.allowStarRegistration} onChange={(val) => updateDraft({ allowStarRegistration: val })} />
                </FormItem>
              </Col>
              <Col span={6}>
                <FormItem label="查看他人提交状态">
                  <Switch checked={draft.allowViewAllSubmissions} onChange={(val) => updateDraft({ allowViewAllSubmissions: val })} />
                </FormItem>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col span={8}>
                <FormItem label="金牌比例 (%)">
                  <InputNumber min={0} max={100} style={{ width: '100%' }} value={draft.goldRatio}
                    onChange={(val) => updateDraft({ goldRatio: Number(val) || 0 })} />
                </FormItem>
              </Col>
              <Col span={8}>
                <FormItem label="银牌比例 (%)">
                  <InputNumber min={0} max={100} style={{ width: '100%' }} value={draft.silverRatio}
                    onChange={(val) => updateDraft({ silverRatio: Number(val) || 0 })} />
                </FormItem>
              </Col>
              <Col span={8}>
                <FormItem label="铜牌比例 (%)">
                  <InputNumber min={0} max={100} style={{ width: '100%' }} value={draft.bronzeRatio}
                    onChange={(val) => updateDraft({ bronzeRatio: Number(val) || 0 })} />
                </FormItem>
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />

            <Row gutter={24}>
              <Col span={24}>
                <FormItem label="面向群体" required>
                  <Space direction="vertical" size={8}>
                    <Space wrap>
                      <Radio checked={currentAudience === 'ALL'} onChange={() => chooseAudience('ALL')}>所有人</Radio>
                      <Checkbox checked={currentAudience === 'CLASS'} onChange={(checked) => chooseAudience(checked ? 'CLASS' : 'ALL')}>
                        指定班级
                      </Checkbox>
                    </Space>
                    {currentAudience === 'CLASS' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {classes.map((cls) => (
                          <Tag
                            key={cls.id}
                            color={draft.classIds.includes(cls.id) ? 'blue' : 'gray'}
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleClassId(cls.id)}
                          >
                            {cls.name}
                          </Tag>
                        ))}
                        {classes.length === 0 && <Typography.Text type="secondary">暂无班级</Typography.Text>}
                      </div>
                    )}
                  </Space>
                </FormItem>
              </Col>
              <Col span={24}>
                <FormItem label="比赛介绍">
                  <TextArea rows={5} placeholder="请输入比赛介绍" value={draft.description}
                    onChange={(val) => updateDraft({ description: val })} />
                </FormItem>
              </Col>
            </Row>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { if (validateBasic()) setStep(1); }}>下一步</Button>
            </div>
          </Form>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Text>已选 {draft.problems.length} 道题目</Typography.Text>
              <Space>
                <Input.Search style={{ width: 260 }} placeholder="搜索题目" prefix={<IconSearch />}
                  value={problemKeyword} onChange={setProblemKeyword} />
                <Button onClick={() => setStep(0)}>上一步</Button>
              </Space>
            </div>

            {/* 已选题目 */}
            {draft.problems.length > 0 && (
              <Card size="small" title="已选题目">
                <Table
                  rowKey="problemId"
                  data={draft.problems}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '编号', dataIndex: 'label', width: 70, align: 'center', render: (v: string) => <Tag color="arcoblue">{v}</Tag> },
                    { title: '题目', dataIndex: 'problemId', render: (id: number) => {
                      const p = folders.flatMap((f) => f.problems).find((pp) => pp.id === id);
                      return p ? p.title : `#${id}`;
                    }},
                    ...(draft.type === 'OI' ? [{
                      title: '分数', dataIndex: 'score', width: 100, align: 'center' as const,
                      render: (_: number, record: SelectedProblem) => (
                        <InputNumber size="small" min={0} value={record.score} style={{ width: 80 }}
                          onChange={(val) => {
                            const next = draft.problems.map((p) => p.problemId === record.problemId ? { ...p, score: Number(val) || 0 } : p);
                            updateDraft({ problems: next });
                          }} />
                      ),
                    }] : []),
                    { title: '操作', width: 70, align: 'center', render: (_: unknown, record: SelectedProblem) => (
                      <Button type="text" size="mini" status="danger" icon={<IconDelete />} onClick={() => toggleProblem(record.problemId)} />
                    )},
                  ]}
                />
              </Card>
            )}

            {/* 文件夹选题 */}
            <Card size="small" title="按文件夹选题" style={{ maxHeight: 500, overflow: 'auto' }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {filteredFolders.map((folder) => {
                  const isExpanded = expandedFolderIds.has(folder.id);
                  const problems = problemKeyword.trim() ? folder.filtered : folder.problems;
                  if (!problems?.length) return null;

                  return (
                    <Card key={folder.id} size="small" style={{ border: '1px solid #e5e6eb' }}
                      headerStyle={{ padding: '8px 16px', cursor: 'pointer' }}
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
                          onClick={() => setExpandedFolderIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
                            return next;
                          })}>
                          <Space>
                            <Typography.Text style={{ fontWeight: 600 }}>{folder.name}</Typography.Text>
                            <Tag color="blue" size="small">{problems.length} 题</Tag>
                          </Space>
                          <Button size="mini" type="text">{isExpanded ? '收起' : '展开'}</Button>
                        </div>
                      }
                      bodyStyle={{ padding: 0, display: isExpanded ? 'block' : 'none' }}
                    >
                      <Table
                        rowKey="id"
                        data={problems}
                        pagination={false}
                        size="small"
                        columns={[
                          { title: '操作', width: 70, align: 'center', render: (_: unknown, p: Problem) => {
                            const selected = selectedProblemIds.has(p.id);
                            return (
                              <Button size="mini" type={selected ? 'outline' : 'primary'}
                                status={selected ? 'warning' : 'default'}
                                onClick={() => toggleProblem(p.id)}>
                                {selected ? '移除' : '选择'}
                              </Button>
                            );
                          }},
                          { title: '题目', dataIndex: 'title' },
                          { title: '难度', dataIndex: 'difficulty', width: 80, render: (v: number) => {
                            const info = difficultyMap[v] ?? { text: '未知', color: 'gray' };
                            return <Tag color={info.color}>{info.text}</Tag>;
                          }},
                        ]}
                      />
                    </Card>
                  );
                })}
              </Space>
            </Card>
          </Space>
        )}
      </Card>
    </Space>
  );
}
