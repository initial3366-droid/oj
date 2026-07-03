import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconLeft, IconPlus, IconSave, IconUpload } from '@arco-design/web-react/icon';
import { teacherGet, teacherPost, teacherPut } from '../teacherApi';
import { decryptIdFromUrl } from '../../utils/cipher';
import { MarkdownInsertModal } from '../../admin/components/MarkdownInsertModal';
import { CodeInsertModal } from '../../admin/components/CodeInsertModal';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;
const Step = Steps.Step;

interface SampleCase {
  input: string;
  output: string;
  explanation?: string;
}

interface BasicFormData {
  title: string;
  timeLimit: number;
  memoryLimit: number;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  tags?: string[];
  difficulty?: number;
  folderId?: number;
  isPublic?: boolean;
  samples: SampleCase[];
}

const DIFFICULTY_OPTIONS = [
  { value: 1, label: '入门' },
  { value: 2, label: '简单' },
  { value: 3, label: '中等' },
  { value: 4, label: '困难' },
  { value: 5, label: '地狱' },
];

interface TestCase {
  id?: number;
  caseNo: number;
  input: string;
  output: string;
}

interface DraftData {
  draftId: string;
  basic: BasicFormData | null;
  testCases: TestCase[];
}

function normalizeSamples(samples?: SampleCase[]) {
  return (samples || [])
    .filter((sample) => {
      const input = sample?.input?.trim() || '';
      const output = sample?.output?.trim() || '';
      const explanation = sample?.explanation?.trim() || '';
      return input || output || explanation;
    })
    .map((sample, index) => {
      const input = sample.input?.trim() || '';
      const output = sample.output?.trim() || '';
      if (!input || !output) {
        throw new Error(`样例 ${index + 1} 的输入和输出都不能为空`);
      }
      return {
        input,
        output,
        explanation: sample.explanation?.trim() || '',
      };
    });
}

function normalizeBasicPayload(values: Partial<BasicFormData>, tags: string[]) {
  return {
    title: values.title?.trim() || '',
    timeLimit: values.timeLimit ?? 1000,
    memoryLimit: values.memoryLimit ?? 256,
    statement: values.statement?.trim() || '',
    inputFormat: values.inputFormat?.trim() || '',
    outputFormat: values.outputFormat?.trim() || '',
    tags,
    difficulty: values.difficulty ?? null,
    folderId: values.folderId || undefined,
    samples: normalizeSamples(values.samples),
    isPublic: values.isPublic !== false,
  };
}

function normalizeTestCases(testCases: TestCase[]) {
  return testCases
    .map((testCase, index) => ({
      caseNo: Number.isFinite(Number(testCase.caseNo)) && Number(testCase.caseNo) > 0 ? Number(testCase.caseNo) : index + 1,
      input: testCase.input?.trim() || '',
      output: testCase.output?.trim() || '',
    }))
    .sort((left, right) => left.caseNo - right.caseNo);
}

export function TeacherProblemCreatePage() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const problemId = params.problemId ? decryptIdFromUrl(params.problemId) : null;
  const isTestCasesRoute = location.pathname.endsWith('/test-cases');
  const isEditMode = Boolean(problemId);

  const [form] = Form.useForm<BasicFormData>();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(isTestCasesRoute ? 1 : 0);
  const [draftId, setDraftId] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [folders, setFolders] = useState<Array<{ id: number; name: string }>>([]);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [statementModalVisible, setStatementModalVisible] = useState(false);
  const [inputFormatModalVisible, setInputFormatModalVisible] = useState(false);
  const [outputFormatModalVisible, setOutputFormatModalVisible] = useState(false);

  useEffect(() => {
    if (isEditMode && problemId) {
      loadProblem(problemId);
      loadTestCases(problemId);
    } else {
      createDraft();
    }
    teacherGet<Array<{ id: number; name: string }>>('/api/admin/v1/problem-folders')
      .then((res) => setFolders(res))
      .catch(() => {});
  }, [isEditMode, problemId]);

  async function loadProblem(id: number) {
    try {
      setLoading(true);
      const result = await teacherGet<any>(`/api/admin/v1/problems/${id}`);
      form.setFieldsValue({
        title: result.title,
        timeLimit: result.timeLimit,
        memoryLimit: result.memoryLimit,
        statement: result.statement,
        inputFormat: result.inputFormat || '',
        outputFormat: result.outputFormat || '',
        tags: result.tags || [],
        difficulty: result.difficulty ?? 1,
        folderId: result.folderId || undefined,
        isPublic: result.isPublic !== false,
        samples: result.samples || [],
      });
      setTags(result.tags || []);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载题目失败');
      navigate('/teacher/problems');
    } finally {
      setLoading(false);
    }
  }

  async function loadTestCases(id: number) {
    try {
      const cases = await teacherGet<TestCase[]>(`/api/admin/v1/problems/${id}/test-cases`);
      setTestCases(cases.map((c, i) => ({ ...c, caseNo: c.caseNo || i + 1 })));
    } catch {
      // ignore
    }
  }

  async function createDraft() {
    try {
      const result = await teacherPost<DraftData>('/api/admin/v1/problem-drafts');
      setDraftId(result.draftId);
    } catch (error) {
      Message.error('创建草稿失败');
    }
  }

  async function saveBasicInfo() {
    try {
      const values = await form.validate();
      setLoading(true);
      const payload = normalizeBasicPayload(values, tags);
      if (isEditMode && problemId) {
        await teacherPut(`/api/admin/v1/problems/${problemId}`, payload);
      } else if (draftId) {
        await teacherPut(`/api/admin/v1/problem-drafts/${draftId}/basic`, payload);
      }
      Message.success('基本信息已保存');
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveBasicInfoAndNext() {
    try {
      const values = await form.validate();
      setLoading(true);
      const payload = normalizeBasicPayload(values, tags);
      if (isEditMode && problemId) {
        await teacherPut(`/api/admin/v1/problems/${problemId}`, payload);
      } else if (draftId) {
        await teacherPut(`/api/admin/v1/problem-drafts/${draftId}/basic`, payload);
      }
      Message.success('基本信息已保存');
      setCurrentStep(1);
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveTestCases(showSuccess = true) {
    if (!isEditMode && !draftId) return false;
    try {
      const normalized = normalizeTestCases(testCases);
      if (normalized.length === 0) {
        Message.warning('请先添加测试点');
        return false;
      }

      const seenCaseNos = new Set<number>();
      for (const testCase of normalized) {
        if (!testCase.input) {
          Message.warning(`测试点 ${testCase.caseNo} 的输入数据不能为空`);
          return false;
        }
        if (!testCase.output) {
          Message.warning(`测试点 ${testCase.caseNo} 的输出数据不能为空`);
          return false;
        }
        if (seenCaseNos.has(testCase.caseNo)) {
          Message.warning(`测试点编号 ${testCase.caseNo} 重复，请调整后再保存`);
          return false;
        }
        seenCaseNos.add(testCase.caseNo);
      }

      setLoading(true);
      const payload = { testCases: normalized };
      if (isEditMode && problemId) {
        const saved = await teacherPut<TestCase[]>(`/api/admin/v1/problems/${problemId}/test-cases`, payload);
        setTestCases(saved.map((testCase, index) => ({ ...testCase, caseNo: testCase.caseNo || index + 1 })));
      } else if (draftId) {
        const savedDraft = await teacherPut<DraftData>(`/api/admin/v1/problem-drafts/${draftId}/test-cases`, payload);
        setTestCases((savedDraft.testCases || []).map((testCase, index) => ({ ...testCase, caseNo: testCase.caseNo || index + 1 })));
      }
      if (showSuccess) {
        Message.success('测试点已保存');
      }
      return true;
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!draftId) return;
    try {
      const saved = await saveTestCases(false);
      if (!saved) return;

      setLoading(true);
      await teacherPost(`/api/admin/v1/problem-drafts/${draftId}/commit`);
      Message.success('题目已创建');
      navigate('/teacher/problems');
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  function addTestCase() {
    setTestCases([...testCases, { caseNo: testCases.length + 1, input: '', output: '' }]);
  }

  function removeTestCase(index: number) {
    setTestCases(testCases.filter((_, i) => i !== index));
  }

  function updateTestCase(index: number, field: 'input' | 'output', value: string) {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  }

  function appendWithBlankLine(current: string | undefined, content: string): string {
    const base = (current ?? '').replace(/\s+$/g, '');
    if (!base) return content.replace(/^\s+/, '');
    return `${base}\n\n${content.replace(/^\s+/, '')}`;
  }

  function handleInsertCode(code: string) {
    form.setFieldValue('statement', appendWithBlankLine(form.getFieldValue('statement') as string | undefined, code));
    setCodeModalVisible(false);
  }

  function handleInsertStatement(markdown: string) {
    form.setFieldValue('statement', appendWithBlankLine(form.getFieldValue('statement') as string | undefined, markdown));
    setStatementModalVisible(false);
  }

  function handleInsertInputFormat(markdown: string) {
    form.setFieldValue('inputFormat', appendWithBlankLine(form.getFieldValue('inputFormat') as string | undefined, markdown));
    setInputFormatModalVisible(false);
  }

  function handleInsertOutputFormat(markdown: string) {
    form.setFieldValue('outputFormat', appendWithBlankLine(form.getFieldValue('outputFormat') as string | undefined, markdown));
    setOutputFormatModalVisible(false);
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title={isEditMode ? '编辑题目' : '添加题目'}
        extra={
          <Space>
            <Button icon={<IconLeft />} onClick={() => navigate('/teacher/problems')}>
              返回列表
            </Button>
            {currentStep === 0 ? (
              <Button type="primary" icon={<IconSave />} loading={loading} onClick={saveBasicInfo}>
                保存基本信息
              </Button>
            ) : isEditMode ? (
              <Button type="primary" icon={<IconSave />} loading={loading} onClick={() => saveTestCases()}>
                保存测试点
              </Button>
            ) : (
              <Button type="primary" icon={<IconSave />} loading={loading} onClick={handleCommit}>
                创建题目
              </Button>
            )}
          </Space>
        }
      >
        <Steps current={currentStep} style={{ maxWidth: 400, marginBottom: 24 }}>
          <Step title="基本信息" />
          <Step title="测试点" />
        </Steps>

        {currentStep === 0 ? (
          <Form form={form} labelCol={{ span: 4 }} wrapperCol={{ span: 18 }} labelAlign="left" requiredSymbol={false}
            initialValues={{ timeLimit: 1000, memoryLimit: 256, isPublic: true, difficulty: 1, samples: [] }}
            style={{ maxWidth: 1000 }}
          >
            <FormItem label="题目名称" field="title" rules={[{ required: true, message: '请输入题目名称' }]}>
              <Input placeholder="题目名称" maxLength={200} />
            </FormItem>
            <FormItem label="时间限制" field="timeLimit" rules={[{ required: true }]} extra="单位：毫秒(ms)">
              <InputNumber min={100} max={10000} style={{ width: '100%' }} />
            </FormItem>
            <FormItem label="内存限制" field="memoryLimit" rules={[{ required: true }]} extra="单位：兆字节(MB)">
              <InputNumber min={16} max={1024} style={{ width: '100%' }} />
            </FormItem>
            <FormItem label="可见性" field="isPublic" triggerPropName="checked">
              <Switch checkedText="公开" uncheckedText="隐藏" />
            </FormItem>
            <FormItem label="难度" field="difficulty" rules={[{ required: true, message: '请选择难度' }]}>
              <Select placeholder="请选择难度">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <Select.Option key={d.value} value={d.value}>{d.label}</Select.Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="所属文件夹" field="folderId">
              <Select placeholder="请选择文件夹" allowClear>
                {folders.map((f) => (
                  <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="标签">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: tags.length > 0 ? 8 : 0 }}>
                {tags.map((tag) => (
                  <Tag key={tag} closable onClose={() => setTags(tags.filter((t) => t !== tag))} color="blue">{tag}</Tag>
                ))}
              </div>
              <Space>
                <Input
                  value={tagInput}
                  onChange={setTagInput}
                  placeholder="输入标签名称"
                  onPressEnter={() => {
                    const val = tagInput.trim();
                    if (val && !tags.includes(val)) setTags([...tags, val]);
                    setTagInput('');
                  }}
                  style={{ width: 200 }}
                />
                <Button type="primary" size="small" onClick={() => {
                  const val = tagInput.trim();
                  if (val && !tags.includes(val)) setTags([...tags, val]);
                  setTagInput('');
                }}>添加</Button>
              </Space>
            </FormItem>
            <FormItem label="题目描述" field="statement" rules={[{ required: true }]} triggerPropName="value">
              <TextArea placeholder="支持 Markdown 和 LaTeX 格式" rows={10} style={{ fontFamily: 'monospace' }} />
            </FormItem>
            <div style={{ marginLeft: '16.66%', marginTop: -8, marginBottom: 16 }}>
              <Space>
                <Button size="small" icon={<IconEdit />} onClick={() => setStatementModalVisible(true)}>
                  插入 Markdown
                </Button>
                <Button size="small" icon={<IconEdit />} onClick={() => setCodeModalVisible(true)}>
                  插入代码块
                </Button>
              </Space>
            </div>
            <FormItem label="输入格式" field="inputFormat">
              <TextArea placeholder="输入格式说明" rows={3} style={{ fontFamily: 'monospace' }} />
            </FormItem>
            <div style={{ marginLeft: '16.66%', marginTop: -8, marginBottom: 16 }}>
              <Button size="small" icon={<IconEdit />} onClick={() => setInputFormatModalVisible(true)}>
                插入 Markdown
              </Button>
            </div>
            <FormItem label="输出格式" field="outputFormat">
              <TextArea placeholder="输出格式说明" rows={3} style={{ fontFamily: 'monospace' }} />
            </FormItem>
            <div style={{ marginLeft: '16.66%', marginTop: -8, marginBottom: 16 }}>
              <Button size="small" icon={<IconEdit />} onClick={() => setOutputFormatModalVisible(true)}>
                插入 Markdown
              </Button>
            </div>
            <FormItem label="样例">
              <Form.List field="samples">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => (
                      <Card key={field.key} style={{ marginBottom: 16 }}
                        extra={<Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => remove(index)}>删除</Button>}
                        title={`样例 ${index + 1}`}
                      >
                        <FormItem label="输入" field={`${field.field}.input`}>
                          <TextArea placeholder="样例输入" rows={3} />
                        </FormItem>
                        <FormItem label="输出" field={`${field.field}.output`}>
                          <TextArea placeholder="样例输出" rows={3} />
                        </FormItem>
                        <FormItem label="解释" field={`${field.field}.explanation`}>
                          <TextArea placeholder="可选" rows={2} />
                        </FormItem>
                      </Card>
                    ))}
                    <Button type="dashed" icon={<IconPlus />} onClick={() => add({ input: '', output: '', explanation: '' })} style={{ width: '100%' }}>
                      添加样例
                    </Button>
                  </>
                )}
              </Form.List>
            </FormItem>
            <div style={{ marginLeft: '16.66%', marginTop: 16 }}>
              <Space>
                <Button onClick={saveBasicInfoAndNext} loading={loading}>下一步：测试点</Button>
              </Space>
            </div>
          </Form>
        ) : (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text>共 {testCases.length} 个测试点</Typography.Text>
              <Space>
                <Button size="small" icon={<IconPlus />} onClick={addTestCase}>添加测试点</Button>
                <Button size="small" onClick={() => setCurrentStep(0)}>返回基本信息</Button>
              </Space>
            </div>
            <Table
              rowKey="caseNo"
              data={testCases}
              pagination={false}
              columns={[
                { title: '#', dataIndex: 'caseNo', width: 60, align: 'center' },
                {
                  title: '输入',
                  dataIndex: 'input',
                  render: (_: unknown, __: TestCase, index: number) => (
                    <TextArea
                      value={testCases[index]?.input || ''}
                      onChange={(val) => updateTestCase(index, 'input', val)}
                      rows={2}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  ),
                },
                {
                  title: '输出',
                  dataIndex: 'output',
                  render: (_: unknown, __: TestCase, index: number) => (
                    <TextArea
                      value={testCases[index]?.output || ''}
                      onChange={(val) => updateTestCase(index, 'output', val)}
                      rows={2}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  ),
                },
                {
                  title: '操作',
                  width: 80,
                  align: 'center',
                  render: (_: unknown, __: TestCase, index: number) => (
                    <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => removeTestCase(index)} />
                  ),
                },
              ]}
            />
          </div>
        )}
      </Card>

      <CodeInsertModal
        visible={codeModalVisible}
        onClose={() => setCodeModalVisible(false)}
        onInsert={handleInsertCode}
      />

      <MarkdownInsertModal
        visible={statementModalVisible}
        onClose={() => setStatementModalVisible(false)}
        onInsert={handleInsertStatement}
        title="插入题目描述"
        initialValue=""
      />

      <MarkdownInsertModal
        visible={inputFormatModalVisible}
        onClose={() => setInputFormatModalVisible(false)}
        onInsert={handleInsertInputFormat}
        title="插入输入格式"
        initialValue=""
      />

      <MarkdownInsertModal
        visible={outputFormatModalVisible}
        onClose={() => setOutputFormatModalVisible(false)}
        onInsert={handleInsertOutputFormat}
        title="插入输出格式"
        initialValue=""
      />
    </Space>
  );
}
