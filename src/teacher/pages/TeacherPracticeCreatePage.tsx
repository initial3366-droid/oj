/**
 * 教师练习Create页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Grid,
  Input,
  Message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconLeft, IconPlus, IconSave, IconSearch } from '@arco-design/web-react/icon';
import { teacherGet, teacherPost, teacherPut } from '../teacherApi';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

/**
 * Audience类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type Audience = 'ALL' | 'CLASS';

/**
 * 题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
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

/**
 * 文件夹接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface Folder {
  id: number;
  name: string;
  description?: string;
  problemCount: number;
  problems: Problem[];
}

/**
 * 班级Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ClassOption {
  id: number;
  name: string;
}

const difficultyMap: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

/**
 * 渲染教师练习Create页面，并协调其数据加载、状态和交互。
 */
export function TeacherPracticeCreatePage() {
  const navigate = useNavigate();
  const { practiceId } = useParams();
  const isEditing = Boolean(practiceId);
  const numericPracticeId = practiceId ? Number(practiceId) : undefined;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [audience, setAudience] = useState<Audience>('ALL');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const [selectedProblemIds, setSelectedProblemIds] = useState<number[]>([]);
  const [problemKeyword, setProblemKeyword] = useState('');

  /**
   * 封装selectedProblems相关逻辑。对原始数据进行派生或聚合。
   */
  const selectedProblems = useMemo(() => {
    const allProblems = folders.flatMap((f) => f.problems);
    const map = new Map(allProblems.map((p) => [p.id, p]));
    return selectedProblemIds.map((id) => map.get(id)).filter(Boolean) as Problem[];
  }, [folders, selectedProblemIds]);

  useEffect(() => {
    loadData();
  }, []);

  /**
   * 读取Data并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadData() {
    setLoading(true);
    try {
      const [classResult, folderResult] = await Promise.all([
        teacherGet<ClassOption[]>('/api/teacher/v1/classes').catch(() => []),
        teacherGet<Folder[]>('/api/admin/v1/problem-folders').catch(() => []),
      ]);
      setClasses(classResult);
      setFolders(folderResult);

      if (isEditing && numericPracticeId) {
        const practice = await teacherGet<any>(`/api/admin/v1/practices?page=1&pageSize=200`).then(
          (res) => (res.list ?? []).find((p: any) => p.id === numericPracticeId)
        );
        if (practice) {
          form.setFieldsValue({
            title: practice.title,
            description: practice.description || '',
            audience: practice.audience || 'ALL',
            audienceId: practice.audienceId ?? undefined,
            password: '',
          });
          setAudience(practice.audience || 'ALL');
          setSelectedProblemIds((practice.problems ?? []).map((p: any) => p.id));
        }
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 构造或转换ggle题目。会更新 React 状态并触发重新渲染。
   */
  function toggleProblem(problemId: number) {
    setSelectedProblemIds((prev) =>
      prev.includes(problemId) ? prev.filter((id) => id !== problemId) : [...prev, problemId]
    );
  }

  /**
   * 处理Submit。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function handleSubmit() {
    try {
      const values = await form.validate();
      if (selectedProblemIds.length === 0) {
        Message.warning('请至少选择一道题目');
        return;
      }
      if (values.audience === 'CLASS' && !values.audienceId) {
        Message.warning('请选择班级');
        return;
      }

      setSubmitting(true);
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        audience: values.audience,
        audienceId: values.audience === 'CLASS' ? values.audienceId : null,
        password: values.password?.trim() || undefined,
        problemIds: selectedProblemIds,
      };

      if (isEditing && numericPracticeId) {
        await teacherPut(`/api/admin/v1/practices/${numericPracticeId}`, payload);
        Message.success('题单已更新');
      } else {
        await teacherPost('/api/admin/v1/practices', payload);
        Message.success('题单已创建');
      }
      navigate('/teacher/practices');
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
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
        title={isEditing ? '编辑题单' : '添加题单'}
        loading={loading}
        extra={
          <Space>
            <Button icon={<IconLeft />} onClick={() => navigate('/teacher/practices')}>返回列表</Button>
            <Button type="primary" icon={<IconSave />} loading={submitting} onClick={handleSubmit}>
              {isEditing ? '保存修改' : '创建题单'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 800 }} initialValues={{ audience: 'ALL' }}>
          <Row gutter={24}>
            <Col span={12}>
              <FormItem label="题单名称" field="title" rules={[{ required: true, message: '请输入题单名称' }]}>
                <Input placeholder="例如：动态规划入门题单" maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="访问范围" field="audience">
                <Select onChange={(val) => setAudience(val as Audience)}>
                  <Select.Option value="ALL">所有人</Select.Option>
                  <Select.Option value="CLASS">指定班级</Select.Option>
                </Select>
              </FormItem>
            </Col>
            {audience === 'CLASS' && (
              <Col span={12}>
                <FormItem label="可访问班级" field="audienceId" rules={[{ required: true, message: '请选择班级' }]}>
                  <Select placeholder="选择班级" allowClear>
                    {classes.map((item) => (
                      <Select.Option key={item.id} value={item.id}>{item.name}（{item.id}）</Select.Option>
                    ))}
                  </Select>
                </FormItem>
              </Col>
            )}
            <Col span={12}>
              <FormItem label="访问密码" field="password">
                <Input.Password placeholder={isEditing ? '留空则不修改密码' : '不填写则无需密码'} />
              </FormItem>
            </Col>
            <Col span={24}>
              <FormItem label="题单介绍" field="description">
                <TextArea placeholder="题单目标、适合人群或刷题建议" autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} showWordLimit />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card bordered={false} title={`已选题目 (${selectedProblems.length})`}>
            <Table
              rowKey="id"
              data={selectedProblems}
              pagination={false}
              size="small"
              columns={[
                { title: '顺序', width: 60, align: 'center', render: (_: unknown, __: Problem, i: number) => i + 1 },
                { title: '题目', dataIndex: 'title' },
                { title: '难度', dataIndex: 'difficulty', width: 80, render: (v: number) => {
                  const info = difficultyMap[v] ?? { text: '未知', color: 'gray' };
                  return <Tag color={info.color}>{info.text}</Tag>;
                }},
                { title: '操作', width: 70, align: 'center', render: (_: unknown, r: Problem) => (
                  <Button type="text" size="mini" status="danger" icon={<IconDelete />} onClick={() => toggleProblem(r.id)}>移除</Button>
                )},
              ]}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card
            bordered={false}
            title="按文件夹选题"
            extra={<Input.Search style={{ width: 180 }} placeholder="搜索题目" prefix={<IconSearch />} value={problemKeyword} onChange={setProblemKeyword} />}
            style={{ maxHeight: 600, overflow: 'auto' }}
          >
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
                          const selected = selectedProblemIds.includes(p.id);
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
        </Col>
      </Row>
    </Space>
  );
}
