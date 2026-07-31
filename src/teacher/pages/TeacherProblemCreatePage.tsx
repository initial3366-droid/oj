/**
 * 教师题目Create页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
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
  Tag,
  Upload,
} from '@arco-design/web-react';
import { IconDelete, IconPlus, IconUpload } from '@arco-design/web-react/icon';
import { TeacherApiError, teacherGet, teacherPost, teacherPut } from '../teacherApi';
import { decryptIdFromUrl } from '../../utils/cipher';
import { HtmlMathEditor } from '../../admin/components/HtmlMathEditor';

const FormItem = Form.Item;
const TextArea = Input.TextArea;
const Step = Steps.Step;

/**
 * Sample测试点接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface SampleCase {
  input: string;
  output: string;
  explanation?: string;
}

/**
 * BasicFormData接口，明确该模块内部及 API 边界使用的数据结构。
 */
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
  accessScope?: 'ALL' | 'MAJOR' | 'PRIVATE';
  studentPublishStatus?: 'DRAFT' | 'PUBLISHED';
  samples: SampleCase[];
}

const DIFFICULTY_OPTIONS = [
  { value: 1, label: '入门' },
  { value: 2, label: '简单' },
  { value: 3, label: '中等' },
  { value: 4, label: '困难' },
  { value: 5, label: '地狱' },
];

/**
 * Test测试点接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TestCase {
  id?: number;
  caseNo: number;
  input: string;
  output: string;
}

/**
 * RawTest测试点类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type RawTestCase = Partial<TestCase> & {
  inputData?: string;
  outputData?: string;
};

/**
 * DraftData接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface DraftData {
  draftId: string;
  basic: BasicFormData | null;
  testCases: TestCase[];
}

/**
 * 解析并规范化Samples。失败时向调用方传播异常。
 */
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

/**
 * 解析并规范化Basic请求参数。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
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
    accessScope: values.accessScope || 'ALL',
    studentPublishStatus: values.studentPublishStatus || 'PUBLISHED',
  };
}

/**
 * 解析并规范化TestCases。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function normalizeTestCases(testCases: TestCase[]) {
  return testCases
    .map((testCase, index) => ({
      caseNo: Number.isFinite(Number(testCase.caseNo)) && Number(testCase.caseNo) > 0 ? Number(testCase.caseNo) : index + 1,
      input: testCase.input?.trim() || '',
      output: testCase.output?.trim() || '',
    }))
    .sort((left, right) => left.caseNo - right.caseNo);
}

/**
 * 解析并规范化LoadedTestCases。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
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

function problemErrorSource(error: unknown) {
  if (!(error instanceof TeacherApiError)) {
    return '前端校验';
  }
  if (error.status === 0) return '网络连接';
  if (error.status === 400) return '后端校验';
  if (error.status === 401 || error.status === 403) return '登录与权限';
  if (error.status === 404) return '题目草稿';
  if (error.status === 409) return '数据冲突';
  if (error.status >= 500) return '后端服务';
  return '后端请求';
}

function problemErrorReason(error: unknown, source: string) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message && /[\u3400-\u9fff]/.test(message)) {
    return message;
  }
  if (source === '网络连接') {
    return '无法连接后端服务，请确认服务已启动后重试';
  }
  return '请求未能完成，请检查填写内容或稍后重试';
}

function showProblemActionError(action: string, error: unknown) {
  const source = problemErrorSource(error);
  Message.error(`${action}失败（${source}）：${problemErrorReason(error, source)}`);
}

/**
 * 渲染教师题目Create页面，并协调其数据加载、状态和交互。
 */
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
  const [folders, setFolders] = useState<Array<{ id: number; name: string; canEdit: boolean }>>([]);
  const [importZipFile, setImportZipFile] = useState<File | null>(null);
  const [importZipVisible, setImportZipVisible] = useState(false);

  useEffect(() => {
    if (isEditMode && problemId) {
      loadProblem(problemId);
      loadTestCases(problemId);
    } else {
      createDraft();
    }
    teacherGet<Array<{ id: number; name: string; canEdit: boolean }>>('/api/admin/v1/problem-folders')
      .then((res) => setFolders(res.filter((folder) => folder.canEdit)))
      .catch(() => {});
  }, [isEditMode, problemId]);

  /**
   * 读取题目并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
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
        accessScope: result.accessScope || 'PRIVATE',
        studentPublishStatus: result.studentPublishStatus || (result.isPublic ? 'PUBLISHED' : 'DRAFT'),
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

  /**
   * 读取TestCases并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadTestCases(id: number) {
    try {
      const cases = await teacherGet<RawTestCase[]>(`/api/admin/v1/problems/${id}/test-cases`);
      setTestCases(normalizeLoadedTestCases(cases));
    } catch {
      // ignore
    }
  }

  /**
   * 创建或提交Draft。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function createDraft() {
    try {
      const result = await teacherPost<DraftData>('/api/admin/v1/problem-drafts');
      setDraftId(result.draftId);
    } catch (error) {
      showProblemActionError('创建题目草稿', error);
    }
  }

  /**
   * 更新BasicInfo。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
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
        showProblemActionError('保存题目基本信息', error);
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * 更新BasicInfoAndNext。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
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
        showProblemActionError('保存题目基本信息', error);
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * 更新TestCases。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；对原始数据进行派生或聚合。
   */
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
      if (error instanceof Error) showProblemActionError('保存测试点', error);
      return false;
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理Commit。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
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
      if (error instanceof Error) showProblemActionError('创建题目', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理Submit。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
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
      showProblemActionError('创建题目', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理ImportZip。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
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
      showProblemActionError('导入测试点', error);
      return false;
    } finally {
      setLoading(false);
    }
  }

  /**
   * 创建或提交Test测试点。会更新 React 状态并触发重新渲染。
   */
  function addTestCase() {
    setTestCases([...testCases, { caseNo: testCases.length + 1, input: '', output: '' }]);
  }

  /**
   * 删除Test测试点。会更新 React 状态并触发重新渲染。
   */
  function removeTestCase(index: number) {
    setTestCases(testCases.filter((_, i) => i !== index));
  }

  /**
   * 更新Test测试点。会更新 React 状态并触发重新渲染。
   */
  function updateTestCase(index: number, field: 'input' | 'output', value: string) {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
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
            initialValues={{ timeLimit: 1000, memoryLimit: 256, isPublic: true, accessScope: 'ALL', studentPublishStatus: 'PUBLISHED', difficulty: 1, samples: [] }}
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
            <FormItem label="教师开放范围" field="accessScope" rules={[{ required: true, message: '请选择开放范围' }]}>
              <Select>
                <Select.Option value="ALL">所有人</Select.Option>
                <Select.Option value="MAJOR">本专业</Select.Option>
                <Select.Option value="PRIVATE">私有</Select.Option>
              </Select>
            </FormItem>
            <FormItem label="学生题库状态" field="studentPublishStatus" rules={[{ required: true, message: '请选择发布状态' }]}>
              <Select>
                <Select.Option value="PUBLISHED">已发布</Select.Option>
                <Select.Option value="DRAFT">未发布</Select.Option>
              </Select>
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
            <FormItem label="题目描述" field="statement" rules={[{ required: true, message: '请输入题目描述' }]} triggerPropName="value" style={{ marginBottom: '20px' }}>
              <HtmlMathEditor placeholder="支持 HTML 标签与 LaTeX 公式" rows={10} />
            </FormItem>
            <FormItem label="输入格式" field="inputFormat" style={{ marginBottom: '20px' }}>
              <HtmlMathEditor placeholder="输入格式说明（支持 HTML 与 LaTeX）" rows={3} />
            </FormItem>
            <FormItem label="输出格式" field="outputFormat" style={{ marginBottom: '20px' }}>
              <HtmlMathEditor placeholder="输出格式说明（支持 HTML 与 LaTeX）" rows={3} />
            </FormItem>
            <FormItem label="样例">
              <Form.List
                field="samples"
              >
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
