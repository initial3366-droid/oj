import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Steps,
  Switch,
  Tag,
  Upload,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconUpload } from '@arco-design/web-react/icon';
import { teacherGet, teacherPost, teacherPut } from '../teacherApi';
import { decryptIdFromUrl } from '../../utils/cipher';
import { MarkdownInsertModal } from '../../admin/components/MarkdownInsertModal';
import { CodeInsertModal } from '../../admin/components/CodeInsertModal';

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

type RawTestCase = Partial<TestCase> & {
  inputData?: string;
  outputData?: string;
};

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

function normalizeLoadedTestCases(testCases: RawTestCase[]) {
  return (testCases || [])
    .map((tc, index) => ({
      id: tc.id,
      caseNo: Number.isFinite(Number(tc.caseNo)) && Number(tc.caseNo) > 0 ? Number(tc.caseNo) : index + 1,
      input: tc.input ?? tc.inputData ?? '',
      output: tc.output ?? tc.outputData ?? '',
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
  const [importZipFile, setImportZipFile] = useState<File | null>(null);
  const [importZipVisible, setImportZipVisible] = useState(false);

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
      const cases = await teacherGet<RawTestCase[]>(`/api/admin/v1/problems/${id}/test-cases`);
      setTestCases(normalizeLoadedTestCases(cases));
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
        const saved = await teacherPut<RawTestCase[]>(`/api/admin/v1/problems/${problemId}/test-cases`, payload);
        setTestCases(normalizeLoadedTestCases(saved));
      } else if (draftId) {
        const savedDraft = await teacherPut<DraftData>(`/api/admin/v1/problem-drafts/${draftId}/test-cases`, payload);
        setTestCases(normalizeLoadedTestCases(savedDraft.testCases || []));
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

  async function handleSubmit() {
    try {
      if (isEditMode) {
        const saved = await saveTestCases(false);
        if (saved) {
          Message.success('测试点已保存');
          navigate('/teacher/problems');
        }
        return;
      }
      const saved = await saveTestCases(false);
      if (!saved) return;
      setLoading(true);
      await teacherPost(`/api/admin/v1/problem-drafts/${draftId}/commit`);
      Message.success('题目已创建');
      navigate('/teacher/problems');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleImportZip(file: File, overwrite: boolean) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const url = isEditMode && problemId
        ? `/api/admin/v1/problems/${problemId}/test-cases/zip?overwrite=${overwrite}`
        : `/api/admin/v1/problem-drafts/${draftId}/test-cases/zip?overwrite=${overwrite}`;
      const result = await teacherPost<{ testCases?: RawTestCase[] }>(url, formData);

      if (isEditMode && problemId) {
        await loadTestCases(problemId);
      } else {
        setTestCases(normalizeLoadedTestCases(result.testCases || []));
      }
      Message.success('导入成功');
      return true;
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '导入失败');
      return false;
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
    <Card style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Steps current={currentStep}>
          <Step title={isEditMode ? '编辑题目' : '基本信息'} />
          <Step title="测试点" />
        </Steps>
      </div>

      <div style={{ display: currentStep === 0 ? 'block' : 'none', maxWidth: '100%', overflow: 'hidden' }}>
        <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <Form
            form={form}
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 18 }}
            labelAlign="left"
            requiredSymbol={false}
            initialValues={{ timeLimit: 1000, memoryLimit: 256, isPublic: true, difficulty: 1, samples: [] }}
            style={{ maxWidth: '1200px', margin: '0 auto' }}
          >
            <FormItem label="题目名称" field="title" rules={[{ required: true, message: '请输入题目名称' }]}>
              <Input placeholder="题目名称" maxLength={200} />
            </FormItem>
            <FormItem label="时间限制" field="timeLimit" rules={[{ required: true, message: '请输入时间限制' }]} extra="单位：毫秒(ms)">
              <InputNumber min={100} max={10000} style={{ width: '100%' }} />
            </FormItem>
            <FormItem label="内存限制" field="memoryLimit" rules={[{ required: true, message: '请输入内存限制' }]} extra="单位：兆字节(MB)">
              <InputNumber min={16} max={1024} style={{ width: '100%' }} />
            </FormItem>
            <FormItem label="可见性" field="isPublic" triggerPropName="checked" extra="关闭后普通用户、前台题库、直接访问题目链接和普通提交接口都不可见。">
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
            <FormItem label="题目描述" field="statement" rules={[{ required: true, message: '请输入题目描述' }]} triggerPropName="value">
              <TextArea placeholder="支持 Markdown 和 LaTeX 格式" rows={10} style={{ fontFamily: 'monospace' }} />
            </FormItem>
            <div style={{ marginLeft: '16.66%', marginTop: '-8px', marginBottom: '16px' }}>
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
            <div style={{ marginLeft: '16.66%', marginTop: '-8px', marginBottom: '16px' }}>
              <Button size="small" icon={<IconEdit />} onClick={() => setInputFormatModalVisible(true)}>
                插入 Markdown
              </Button>
            </div>
            <FormItem label="输出格式" field="outputFormat">
              <TextArea placeholder="输出格式说明" rows={3} style={{ fontFamily: 'monospace' }} />
            </FormItem>
            <div style={{ marginLeft: '16.66%', marginTop: '-8px', marginBottom: '16px' }}>
              <Button size="small" icon={<IconEdit />} onClick={() => setOutputFormatModalVisible(true)}>
                插入 Markdown
              </Button>
            </div>
            <FormItem label="样例" required>
              <Form.List field="samples">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => (
                      <Card key={field.key} style={{ marginBottom: '16px' }}
                        extra={<Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => remove(index)}>删除</Button>}
                        title={`样例 ${index + 1}`}
                      >
                        <FormItem label="输入" field={`${field.field}.input`} rules={[{ required: true, message: '请输入样例输入' }]}>
                          <TextArea placeholder="样例输入" rows={3} />
                        </FormItem>
                        <FormItem label="输出" field={`${field.field}.output`} rules={[{ required: true, message: '请输入样例输出' }]}>
                          <TextArea placeholder="样例输出" rows={3} />
                        </FormItem>
                        <FormItem label="说明" field={`${field.field}.explanation`}>
                          <TextArea placeholder="样例说明（可选）" rows={2} />
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
            <FormItem wrapperCol={{ offset: 4 }}>
              <Space>
                <Button type="primary" onClick={saveBasicInfoAndNext} loading={loading}>
                  {isEditMode ? '保存并编辑测试点' : '下一步'}
                </Button>
                <Button onClick={() => navigate('/teacher/problems')}>取消</Button>
              </Space>
            </FormItem>
          </Form>
        </div>
      </div>

      <div style={{ display: currentStep === 1 ? 'block' : 'none', maxWidth: '1200px', margin: '0 auto', overflow: 'hidden' }}>
          <div style={{ marginBottom: '16px' }}>
            <Space>
              <Upload
                accept=".zip"
                beforeUpload={(file) => {
                  setImportZipFile(file);
                  setImportZipVisible(true);
                  return false;
                }}
              >
                <Button icon={<IconUpload />}>导入 ZIP 文件</Button>
              </Upload>
            </Space>
          </div>

          {testCases.map((testCase, index) => (
            <Card
              key={index}
              style={{ marginBottom: '16px' }}
              title={`测试点 ${testCase.caseNo}`}
              extra={
                <Popconfirm title="确定删除该测试点吗？" onOk={() => removeTestCase(index)}>
                  <Button type="text" size="small" status="danger" icon={<IconDelete />}>
                    删除
                  </Button>
                </Popconfirm>
              }
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>输入数据</div>
                <TextArea
                  value={testCase.input}
                  onChange={(value: string) => updateTestCase(index, 'input', value)}
                  placeholder="测试点输入数据"
                  rows={4}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>输出数据</div>
                <TextArea
                  value={testCase.output}
                  onChange={(value: string) => updateTestCase(index, 'output', value)}
                  placeholder="测试点输出数据"
                  rows={4}
                />
              </div>
            </Card>
          ))}

          <div style={{ marginBottom: '16px' }}>
            <Button icon={<IconPlus />} onClick={addTestCase}>
              手动添加测试点
            </Button>
          </div>

          <div style={{ marginTop: '24px' }}>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>上一步</Button>
              <Button onClick={() => saveTestCases()} loading={loading}>
                保存测试点
              </Button>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                {isEditMode ? '完成' : '创建题目'}
              </Button>
            </Space>
          </div>
      </div>

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

      <Modal
        title="导入测试点"
        visible={importZipVisible}
        onCancel={() => {
          setImportZipVisible(false);
          if (importZipFile) handleImportZip(importZipFile, false);
        }}
        onOk={() => {
          setImportZipVisible(false);
          if (importZipFile) handleImportZip(importZipFile, true);
        }}
        okText="覆盖"
        cancelText="追加"
      >
        是否覆盖现有测试点？
      </Modal>
    </Card>
  );
}
