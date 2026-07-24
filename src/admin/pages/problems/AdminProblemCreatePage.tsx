/**
 * 管理员题目Create页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { adminPath } from '../../../utils/adminPath';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Card,
  Steps,
  Form,
  Input,
  InputNumber,
  Button,
  Message,
  Space,
  Modal,
  Upload,
  Popconfirm,
  Select,
  Tag,
} from '@arco-design/web-react';
import { IconPlus, IconDelete, IconUpload } from '@arco-design/web-react/icon';
import { adminGet, adminPost, adminPut } from '../../api/adminClient';
import { HtmlMathEditor } from '../../components/HtmlMathEditor';
import { decryptIdFromUrl } from '../../../utils/cipher';

const FormItem = Form.Item;
const Step = Steps.Step;
const Textarea = Input.TextArea;

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
  majorId?: number;
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
    majorId: values.majorId || undefined,
    studentPublishStatus: values.studentPublishStatus || 'PUBLISHED',
  };
}

/**
 * 解析并规范化TestCases。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function normalizeTestCases(testCases: TestCase[]) {
  return testCases
    .map((tc, index) => ({
      caseNo: Number.isFinite(Number(tc.caseNo)) && Number(tc.caseNo) > 0 ? Number(tc.caseNo) : index + 1,
      input: tc.input?.trim() || '',
      output: tc.output?.trim() || '',
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

/**
 * 渲染管理员题目Create页面，并协调其数据加载、状态和交互。
 */
export function AdminProblemCreatePage() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const problemId = params.problemId ? decryptIdFromUrl(params.problemId) : null;
  const isEditMode = Boolean(problemId);
  const isTestCasesRoute = location.pathname.endsWith('/test-cases');
  const [currentStep, setCurrentStep] = useState(isTestCasesRoute ? 1 : 0);
  const [draftId, setDraftId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [basicForm] = Form.useForm<BasicFormData>();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [autoSaving, setAutoSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [folders, setFolders] = useState<Array<{ id: number; name: string }>>([]);
  const [majors, setMajors] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [accessScope, setAccessScope] = useState<'ALL' | 'MAJOR' | 'PRIVATE'>('ALL');
  const [importZipFile, setImportZipFile] = useState<File | null>(null);
  const [importZipVisible, setImportZipVisible] = useState(false);

  useEffect(() => {
    if (isEditMode && problemId) {
      loadProblem(problemId);
      loadProblemTestCases(problemId);
    } else {
      createDraft();
    }
    // 加载文件夹列表
    adminGet<{ id: number; name: string }[]>('/api/admin/v1/problem-folders')
      .then((res) => setFolders(res))
      .catch(() => {});
    adminGet<Array<{ id: number; code: string; name: string }>>('/api/admin/v1/majors?activeOnly=true')
      .then(setMajors)
      .catch(() => setMajors([]));
  }, [isEditMode, problemId]);

  // 自动保存基本信息
  useEffect(() => {
    if (isEditMode || !draftId) return;

    const timer = setTimeout(() => {
      autoSaveBasicInfo();
    }, 2000); // 2秒防抖

    return () => clearTimeout(timer);
  }, [isEditMode, draftId, basicForm]);

  // 自动保存测试点
  useEffect(() => {
    if (isEditMode || !draftId || testCases.length === 0) return;

    const timer = setTimeout(() => {
      autoSaveTestCases();
    }, 2000); // 2秒防抖

    return () => clearTimeout(timer);
  }, [isEditMode, draftId, testCases]);

  /**
   * 读取题目并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function loadProblem(id: number) {
    try {
      setLoading(true);
      const result = await adminGet<any>(`/api/admin/v1/problems/${id}`);
      basicForm.setFieldsValue({
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
        majorId: result.majorId || undefined,
        studentPublishStatus: result.studentPublishStatus || (result.isPublic ? 'PUBLISHED' : 'DRAFT'),
        samples: result.samples || [],
      });
      setAccessScope(result.accessScope || 'PRIVATE');
      setTags(result.tags || []);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载题目失败');
      navigate(adminPath('/problems'));
    } finally {
      setLoading(false);
    }
  }

  /**
   * 读取题目TestCases并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function loadProblemTestCases(id: number) {
    try {
      const result = await adminGet<TestCase[]>(`/api/admin/v1/problems/${id}/test-cases`);
      setTestCases(normalizeLoadedTestCases(result || []));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载测试点失败');
    }
  }

  /**
   * 创建或提交Draft。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function createDraft() {
    try {
      const result = await adminPost<DraftData>('/api/admin/v1/problem-drafts', {});
      setDraftId(result.draftId);

      // 加载草稿数据
      if (result.basic) {
        basicForm.setFieldsValue(result.basic);
      }
      if (result.testCases) {
        setTestCases(normalizeLoadedTestCases(result.testCases));
      }
    } catch (error) {
      Message.error('创建草稿失败');
      console.error(error);
    }
  }

  /**
   * 封装autoSaveBasicInfo相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function autoSaveBasicInfo() {
    if (autoSaving) return;

    try {
      setAutoSaving(true);
      const values = basicForm.getFieldsValue();

      // 只有当有内容时才保存
      if (!values.title && !values.statement) {
        return;
      }

      await adminPut(`/api/admin/v1/problem-drafts/${draftId}/basic`, normalizeBasicPayload(values, tags));
      console.log('基本信息已自动保存');
    } catch (error) {
      console.error('自动保存失败:', error);
    } finally {
      setAutoSaving(false);
    }
  }

  /**
   * 封装autoSaveTestCases相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function autoSaveTestCases() {
    if (autoSaving || testCases.length === 0) return;

    // 过滤掉空的测试点（输出为空视为无效；输入可以为空）
    const validTestCases = testCases.filter(tc => tc.output?.trim());
    if (validTestCases.length === 0) return;

    try {
      setAutoSaving(true);
      await adminPut(`/api/admin/v1/problem-drafts/${draftId}/test-cases`, {
        testCases: validTestCases.map(tc => ({
          caseNo: tc.caseNo,
          input: tc.input?.trim() || '',
          output: tc.output.trim(),
        })),
      });
      console.log('测试点已自动保存');
    } catch (error) {
      console.error('自动保存测试点失败:', error);
    } finally {
      setAutoSaving(false);
    }
  }

  /**
   * 更新BasicInfo。包含异步流程并由调用方处理完成或失败状态。
   */
  async function saveBasicInfo() {
    await saveProblemInfo();
  }

  /**
   * 更新题目Info。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function saveProblemInfo(stayOnStep = false) {
    try {
      await basicForm.validate();
      const values = basicForm.getFieldsValue();

      setLoading(true);
      const payload = normalizeBasicPayload(values, tags);
      if (isEditMode && problemId) {
        await adminPut(`/api/admin/v1/problems/${problemId}`, payload);
      } else {
        await adminPut(`/api/admin/v1/problem-drafts/${draftId}/basic`, payload);
      }
      Message.success(isEditMode ? '题目信息已保存' : '基本信息已保存');
      if (!stayOnStep) {
        setCurrentStep(1);
      }
      return true;
    } catch (error) {
      console.error('保存题目信息错误:', error);
      if (error instanceof Error) {
        Message.error(error.message || '保存失败');
      } else {
        console.log('表单验证失败:', error);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }

  /**
   * 创建或提交Test测试点。会更新 React 状态并触发重新渲染。
   */
  function addTestCase() {
    const maxCaseNo = testCases.length > 0 ? Math.max(...testCases.map(tc => tc.caseNo)) : 0;
    setTestCases([...testCases, { caseNo: maxCaseNo + 1, input: '', output: '' }]);
  }

  /**
   * 删除Test测试点。会更新 React 状态并触发重新渲染。
   */
  function removeTestCase(index: number) {
    const newTestCases = [...testCases];
    newTestCases.splice(index, 1);
    setTestCases(newTestCases);
  }

  /**
   * 更新Test测试点。会更新 React 状态并触发重新渲染。
   */
  function updateTestCase(index: number, field: keyof TestCase, value: string) {
    const newTestCases = [...testCases];
    if (field === 'caseNo') {
      newTestCases[index][field] = parseInt(value) || 1;
    } else {
      (newTestCases[index] as any)[field] = value;
    }
    setTestCases(newTestCases);
  }

  /**
   * 处理ImportZip。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function handleImportZip(file: File, overwrite: boolean) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const url = isEditMode && problemId
        ? `/api/admin/v1/problems/${problemId}/test-cases/zip?overwrite=${overwrite}`
        : `/api/admin/v1/problem-drafts/${draftId}/test-cases/zip?overwrite=${overwrite}`;
      const result = await adminPost<{ testCases?: TestCase[] }>(url, formData);

      if (isEditMode && problemId) {
        await loadProblemTestCases(problemId);
      } else {
        setTestCases(normalizeLoadedTestCases(result.testCases || []));
      }
      Message.success('导入成功');
      return true;
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '导入失败');
      console.error(error);
      return false;
    } finally {
      setLoading(false);
    }
  }

  /**
   * 更新TestCases。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；对原始数据进行派生或聚合。
   */
  async function saveTestCases(showSuccess = true) {
    try {
      const normalized = normalizeTestCases(testCases);

      if (normalized.length === 0) {
        Message.warning('请先添加测试点');
        return false;
      }

      const seenCaseNos = new Set<number>();
      for (const tc of normalized) {
        if (!tc.output) {
          Message.warning(`测试点 ${tc.caseNo} 的输出数据不能为空`);
          return false;
        }
        if (seenCaseNos.has(tc.caseNo)) {
          Message.warning(`测试点编号 ${tc.caseNo} 重复，请调整后再保存`);
          return false;
        }
        seenCaseNos.add(tc.caseNo);
      }

      setLoading(true);
      if (isEditMode && problemId) {
        const saved = await adminPut<TestCase[]>(`/api/admin/v1/problems/${problemId}/test-cases`, {
          testCases: normalized,
        });
        setTestCases(normalizeLoadedTestCases(saved || []));
      } else {
        const savedDraft = await adminPut<DraftData>(`/api/admin/v1/problem-drafts/${draftId}/test-cases`, {
          testCases: normalized,
        });
        setTestCases(normalizeLoadedTestCases(savedDraft.testCases || []));
      }
      if (showSuccess) {
        Message.success('测试点已保存');
      }
      return true;
    } catch (error) {
      console.error('保存测试点错误:', error);
      Message.error(error instanceof Error ? error.message : '保存失败');
      return false;
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理Submit。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function handleSubmit() {
    try {
      if (isEditMode) {
        const saved = await saveTestCases(false);
        if (saved) {
          Message.success('测试点已保存');
          navigate(adminPath('/problems'));
        }
        return;
      }
      const saved = await saveTestCases(false);
      if (!saved) {
        return;
      }
      setLoading(true);
      await adminPost(`/api/admin/v1/problem-drafts/${draftId}/commit`, {});
      Message.success('题目创建成功');
      navigate(adminPath('/problems'));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Steps current={currentStep}>
          <Step title={isEditMode ? "编辑题目" : "基本信息"} />
          <Step title="测试点" />
        </Steps>
        {autoSaving && (
          <span style={{ fontSize: '12px', color: '#999', marginLeft: '16px' }}>
            自动保存中...
          </span>
        )}
      </div>

      <div style={{ display: currentStep === 0 ? 'block' : 'none', maxWidth: '100%', overflow: 'hidden' }}>
        <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <Form
            form={basicForm}
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 18 }}
            labelAlign="left"
            requiredSymbol={false}
            initialValues={{
              timeLimit: 1000,
              memoryLimit: 256,
              isPublic: true,
              accessScope: 'ALL',
              studentPublishStatus: 'PUBLISHED',
              difficulty: 1,
              samples: [],
            }}
            style={{ maxWidth: '1200px', margin: '0 auto' }}
          >
          <FormItem
            label="题目名称"
            field="title"
            rules={[{ required: true, message: '请输入题目名称' }]}
          >
            <Input placeholder="题目名称" maxLength={200} />
          </FormItem>

          <FormItem
            label="时间限制"
            field="timeLimit"
            rules={[{ required: true, message: '请输入时间限制' }]}
            extra="单位：毫秒(ms)"
          >
            <InputNumber min={100} max={10000} style={{ width: '100%' }} />
          </FormItem>

          <FormItem
            label="内存限制"
            field="memoryLimit"
            rules={[{ required: true, message: '请输入内存限制' }]}
            extra="单位：兆字节(MB)"
          >
            <InputNumber min={16} max={1024} style={{ width: '100%' }} />
          </FormItem>

          <FormItem label="教师开放范围" field="accessScope" rules={[{ required: true, message: '请选择开放范围' }]}>
            <Select onChange={(value) => setAccessScope(value as 'ALL' | 'MAJOR' | 'PRIVATE')}>
              <Select.Option value="ALL">所有人</Select.Option>
              <Select.Option value="MAJOR">本专业</Select.Option>
              <Select.Option value="PRIVATE">私有</Select.Option>
            </Select>
          </FormItem>
          {accessScope === 'MAJOR' && (
            <FormItem label="所属专业" field="majorId" rules={[{ required: true, message: '请选择专业' }]}>
              <Select placeholder="选择专业">
                {majors.map((major) => <Select.Option key={major.id} value={major.id}>{major.name}（{major.code}）</Select.Option>)}
              </Select>
            </FormItem>
          )}
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
                <Tag
                  key={tag}
                  closable
                  onClose={() => setTags(tags.filter((t) => t !== tag))}
                  color="blue"
                >
                  {tag}
                </Tag>
              ))}
            </div>
            <Space>
              <Input
                value={tagInput}
                onChange={setTagInput}
                placeholder="输入标签名称"
                onPressEnter={() => {
                  const val = tagInput.trim();
                  if (val && !tags.includes(val)) {
                    setTags([...tags, val]);
                  }
                  setTagInput('');
                }}
                style={{ width: 200 }}
              />
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  const val = tagInput.trim();
                  if (val && !tags.includes(val)) {
                    setTags([...tags, val]);
                  }
                  setTagInput('');
                }}
              >
                添加
              </Button>
            </Space>
          </FormItem>

          <FormItem
            label="题目描述"
            field="statement"
            rules={[{ required: true, message: '请输入题目描述' }]}
            triggerPropName="value"
            style={{ marginBottom: '20px' }}
          >
            <HtmlMathEditor placeholder="支持 HTML 标签与 LaTeX 公式" rows={10} />
          </FormItem>

          <FormItem label="输入格式" field="inputFormat" style={{ marginBottom: '20px' }}>
            <HtmlMathEditor placeholder="输入格式说明（支持 HTML 与 LaTeX）" rows={3} />
          </FormItem>

          <FormItem label="输出格式" field="outputFormat" style={{ marginBottom: '20px' }}>
            <HtmlMathEditor placeholder="输出格式说明（支持 HTML 与 LaTeX）" rows={3} />
          </FormItem>

          <FormItem label="样例">
            <Form.List field="samples">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Card
                      key={field.key}
                      style={{ marginBottom: '16px' }}
                      extra={
                        <Button
                          type="text"
                          size="small"
                          status="danger"
                          icon={<IconDelete />}
                          onClick={() => remove(index)}
                        >
                          删除
                        </Button>
                      }
                      title={`样例 ${index + 1}`}
                    >
                      <FormItem
                        label="输入"
                        field={`${field.field}.input`}
                        rules={[{ required: true, message: '请输入样例输入' }]}
                      >
                        <Textarea placeholder="样例输入" rows={3} />
                      </FormItem>
                      <FormItem
                        label="输出"
                        field={`${field.field}.output`}
                        rules={[{ required: true, message: '请输入样例输出' }]}
                      >
                        <Textarea placeholder="样例输出" rows={3} />
                      </FormItem>
                      <FormItem label="说明" field={`${field.field}.explanation`}>
                        <Textarea placeholder="样例说明（可选）" rows={2} />
                      </FormItem>
                    </Card>
                  ))}
                  <Button type="dashed" icon={<IconPlus />} onClick={() => add()} style={{ width: '100%' }}>
                    添加样例
                  </Button>
                </>
              )}
            </Form.List>
          </FormItem>

          <FormItem wrapperCol={{ offset: 4 }}>
            <Space>
              <Button type="primary" onClick={saveBasicInfo} loading={loading}>
                {isEditMode ? '保存并编辑测试点' : '下一步'}
              </Button>
              <Button onClick={() => navigate(adminPath('/problems'))}>取消</Button>
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
                <Textarea
                  value={testCase.input}
                  onChange={(value: string) => updateTestCase(index, 'input', value)}
                  placeholder="测试点输入数据"
                  rows={4}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>输出数据</div>
                <Textarea
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
