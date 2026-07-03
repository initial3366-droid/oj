import { adminPath } from '../../../utils/adminPath';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Grid,
  Input,
  Message,
  Popconfirm,
  Radio,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import {
  IconDelete,
  IconLeft,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
} from '@arco-design/web-react/icon';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';
import { AdminPageContainer } from '../../layout/AdminPageContainer';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;
const RadioGroup = Radio.Group;
const Option = Select.Option;

type Audience = 'ALL' | 'CLASS';

interface Problem {
  id: number;
  title: string;
  difficulty: number;
  tags?: string[];
  timeLimit: number;
  memoryLimit: number;
  testCaseCount?: number;
}

interface PracticeProblem {
  id: number | string;
  title: string;
  difficulty?: number;
  tags?: string[];
  timeLimit?: number;
  memoryLimit?: number;
}

interface Practice {
  id: number;
  title: string;
  description?: string;
  audience: Audience;
  audienceId?: number | null;
  hasPassword: boolean;
  ownerId: number;
  problems: PracticeProblem[];
  createdAt: string;
  updatedAt: string;
}

interface PageResult<T> {
  total: number;
  list: T[];
}

interface ClassOption {
  id: number;
  name: string;
}

interface PracticeFormValues {
  title: string;
  description?: string;
  audience: Audience;
  audienceId?: number;
  password?: string;
}

const difficultyMap: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

function modeFromPath(pathname: string) {
  if (pathname.endsWith('/new')) return 'create';
  if (pathname.endsWith('/edit')) return 'edit';
  return 'list';
}

function normalizeProblemId(id: number | string) {
  if (typeof id === 'number') return id;
  const match = id.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function difficultyTag(value?: number) {
  const info = difficultyMap[value ?? 0] ?? { text: '未知', color: 'gray' };
  return <Tag color={info.color}>{info.text}</Tag>;
}

function audienceText(practice: Practice) {
  if (practice.audience === 'CLASS') {
    return practice.audienceId ? `班级 #${practice.audienceId}` : '班级';
  }
  return '所有人';
}

export function AdminPracticeManagementPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = modeFromPath(location.pathname);
  const practiceId = mode === 'edit' ? Number(location.pathname.split('/')[3]) : null;
  const [form] = Form.useForm<PracticeFormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [keyword, setKeyword] = useState('');
  const [problemKeyword, setProblemKeyword] = useState('');
  const [selectedProblemIds, setSelectedProblemIds] = useState<number[]>([]);
  const [audience, setAudience] = useState<Audience>('ALL');

  const filteredPractices = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return practices;
    return practices.filter((item) => item.title.toLowerCase().includes(normalized));
  }, [keyword, practices]);

  const filteredProblems = useMemo(() => {
    const normalized = problemKeyword.trim().toLowerCase();
    if (!normalized) return problems;
    return problems.filter((item) => {
      return (
        item.title.toLowerCase().includes(normalized) ||
        String(item.id).includes(normalized) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized))
      );
    });
  }, [problemKeyword, problems]);

  const selectedProblemMap = useMemo(
    () => new Map(problems.map((problem) => [problem.id, problem])),
    [problems],
  );

  const selectedProblems = selectedProblemIds
    .map((id) => selectedProblemMap.get(id))
    .filter((item): item is Problem => Boolean(item));

  useEffect(() => {
    if (mode === 'create') {
      loadCreateData();
      return;
    }
    if (mode === 'edit' && practiceId) {
      loadEditData(practiceId);
      return;
    }
    loadPractices();
  }, [mode, practiceId]);

  async function loadPractices() {
    setLoading(true);
    try {
      const result = await adminGet<PageResult<Practice>>('/api/admin/v1/practices?page=1&pageSize=200');
      setPractices(result.list);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题单列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadCreateData() {
    setLoading(true);
    try {
      const [problemResult, classResult] = await Promise.all([
        adminGet<PageResult<Problem>>('/api/admin/v1/problems?page=1&pageSize=500'),
        adminGet<ClassOption[]>('/api/admin/v1/classes'),
      ]);
      setProblems(problemResult.list);
      setClasses(classResult);
      setAudience('ALL');
      setSelectedProblemIds([]);
      form.setFieldsValue({ title: '', description: '', audience: 'ALL', password: '' });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadEditData(id: number) {
    setLoading(true);
    try {
      const [practiceResult, problemResult, classResult] = await Promise.all([
        adminGet<PageResult<Practice>>(`/api/admin/v1/practices?page=1&pageSize=200`).then(
          (res) => (res.list ?? []).find((p: Practice) => p.id === id)
        ),
        adminGet<PageResult<Problem>>('/api/admin/v1/problems?page=1&pageSize=500'),
        adminGet<ClassOption[]>('/api/admin/v1/classes'),
      ]);
      if (!practiceResult) {
        Message.error('题单不存在');
        navigate(adminPath('/practices'));
        return;
      }
      setProblems(problemResult.list);
      setClasses(classResult);
      const practice = practiceResult as Practice;
      setAudience(practice.audience || 'ALL');
      setSelectedProblemIds((practice.problems ?? []).map((p) => normalizeProblemId(p.id)));
      form.setFieldsValue({
        title: practice.title,
        description: practice.description || '',
        audience: practice.audience || 'ALL',
        audienceId: practice.audienceId ?? undefined,
        password: '',
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题单数据加载失败');
      navigate(adminPath('/practices'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await adminDelete<void>(`/api/admin/v1/practices/${id}`);
      Message.success('题单已删除');
      loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function handleCreate() {
    try {
      const values = await form.validate();
      if (selectedProblemIds.length === 0) {
        Message.warning('请至少选择一道题目');
        return;
      }
      if (values.audience === 'CLASS' && !values.audienceId) {
        Message.warning('请选择可访问的班级');
        return;
      }

      setSubmitting(true);
      await adminPost<Practice>('/api/admin/v1/practices', {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        audience: values.audience,
        audienceId: values.audience === 'CLASS' ? values.audienceId : null,
        password: values.password?.trim() || undefined,
        problemIds: selectedProblemIds,
      });
      Message.success('题单创建成功');
      navigate(adminPath('/practices'));
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!practiceId) return;
    try {
      const values = await form.validate();
      if (selectedProblemIds.length === 0) {
        Message.warning('请至少选择一道题目');
        return;
      }
      if (values.audience === 'CLASS' && !values.audienceId) {
        Message.warning('请选择可访问的班级');
        return;
      }

      setSubmitting(true);
      await adminPut(`/api/admin/v1/practices/${practiceId}`, {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        audience: values.audience,
        audienceId: values.audience === 'CLASS' ? values.audienceId : null,
        password: values.password?.trim() || undefined,
        problemIds: selectedProblemIds,
      });
      Message.success('题单更新成功');
      navigate(adminPath('/practices'));
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleProblem(problemId: number) {
    setSelectedProblemIds((current) => {
      if (current.includes(problemId)) {
        return current.filter((id) => id !== problemId);
      }
      return [...current, problemId];
    });
  }

  function removeSelectedProblem(problemId: number) {
    setSelectedProblemIds((current) => current.filter((id) => id !== problemId));
  }

  function clearSelectedProblems() {
    setSelectedProblemIds([]);
  }

  const practiceColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '题单名称',
      dataIndex: 'title',
      width: 240,
      render: (title: string, record: Practice) => (
        <div>
          <Typography.Text bold>{title}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {record.description || '暂无介绍'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '范围',
      dataIndex: 'audience',
      width: 120,
      render: (_: unknown, record: Practice) => <Tag>{audienceText(record)}</Tag>,
    },
    {
      title: '题目数',
      dataIndex: 'problems',
      width: 100,
      align: 'center' as const,
      render: (items: PracticeProblem[]) => items?.length ?? 0,
    },
    {
      title: '密码',
      dataIndex: 'hasPassword',
      width: 100,
      align: 'center' as const,
      render: (hasPassword: boolean) => (
        <Tag color={hasPassword ? 'orange' : 'gray'}>{hasPassword ? '已设置' : '无'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: Practice) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconSave />}
            onClick={() => navigate(`/admin/practices/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm title="确定要删除该题单吗？" onOk={() => handleDelete(record.id)}>
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const problemColumns = [
    {
      title: '选择',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: Problem) => {
        const selected = selectedProblemIds.includes(record.id);
        return (
          <Button
            size="mini"
            type={selected ? 'primary' : 'secondary'}
            onClick={() => toggleProblem(record.id)}
          >
            {selected ? '已选' : '选择'}
          </Button>
        );
      },
    },
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '题目名称',
      dataIndex: 'title',
      render: (title: string, record: Problem) => (
        <div>
          <Typography.Text bold>{title}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {record.timeLimit}ms / {record.memoryLimit}MB · {record.testCaseCount ?? 0} 个测试点
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 100,
      align: 'center' as const,
      render: (value: number) => difficultyTag(value),
    },
  ];

  const selectedColumns = [
    {
      title: '顺序',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, __: Problem, index: number) => index + 1,
    },
    {
      title: '题目',
      dataIndex: 'title',
      render: (title: string, record: Problem) => (
        <Space>
          <Typography.Text code>#{record.id}</Typography.Text>
          <Typography.Text>{title}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 100,
      render: (value: number) => difficultyTag(value),
    },
    {
      title: '操作',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: Problem) => (
        <Button
          type="text"
          size="mini"
          status="danger"
          icon={<IconDelete />}
          onClick={() => removeSelectedProblem(record.id)}
        >
          移除
        </Button>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <div>
        <AdminPageContainer
          title={mode === 'edit' ? '编辑题单' : '创建题单'}
          loading={loading}
          extra={
            <Space>
              <Button icon={<IconLeft />} onClick={() => navigate(adminPath('/practices'))}>
                返回列表
              </Button>
              <Button
                type="primary"
                icon={<IconSave />}
                loading={submitting}
                onClick={mode === 'edit' ? handleUpdate : handleCreate}
              >
                {mode === 'edit' ? '保存修改' : '创建题单'}
              </Button>
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ audience: 'ALL' }}
            onValuesChange={(_, values) => setAudience(values.audience ?? 'ALL')}
          >
            <Row gutter={24}>
              <Col span={12}>
                <FormItem
                  label="题单名称"
                  field="title"
                  rules={[{ required: true, message: '请输入题单名称' }]}
                >
                  <Input placeholder="例如：动态规划入门题单" maxLength={100} />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="访问范围" field="audience">
                  <RadioGroup type="button">
                    <Radio value="ALL">所有人</Radio>
                    <Radio value="CLASS">指定班级</Radio>
                  </RadioGroup>
                </FormItem>
              </Col>
              {audience === 'CLASS' && (
                <Col span={12}>
                  <FormItem
                    label="可访问班级"
                    field="audienceId"
                    rules={[{ required: true, message: '请选择班级' }]}
                  >
                    <Select placeholder="选择班级" allowClear>
                      {classes.map((item) => (
                        <Option key={item.id} value={item.id}>
                          {item.name}（{item.id}）
                        </Option>
                      ))}
                    </Select>
                  </FormItem>
                </Col>
              )}
              <Col span={12}>
                <FormItem label="访问密码" field="password">
                  <Input.Password placeholder="不填写则无需密码" maxLength={100} />
                </FormItem>
              </Col>
              <Col span={24}>
                <FormItem label="题单介绍" field="description">
                  <TextArea
                    placeholder="写一点题单目标、适合人群或刷题建议"
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    maxLength={2000}
                    showWordLimit
                  />
                </FormItem>
              </Col>
            </Row>
          </Form>
        </AdminPageContainer>

        <Row gutter={16}>
          <Col span={14}>
            <AdminPageContainer
              title="选择题目"
              extra={
                <Input.Search
                  style={{ width: 260 }}
                  placeholder="搜索题目 ID、名称或标签"
                  prefix={<IconSearch />}
                  value={problemKeyword}
                  onChange={setProblemKeyword}
                  onSearch={setProblemKeyword}
                />
              }
            >
              <Table
                rowKey="id"
                columns={problemColumns}
                data={filteredProblems}
                pagination={{ pageSize: 10, showTotal: true }}
              />
            </AdminPageContainer>
          </Col>
          <Col span={10}>
            <AdminPageContainer
              title={`已选题目 (${selectedProblems.length})`}
              extra={
                <Button size="small" disabled={selectedProblemIds.length === 0} onClick={clearSelectedProblems}>
                  清空
                </Button>
              }
            >
              <Table
                rowKey="id"
                columns={selectedColumns}
                data={selectedProblems}
                pagination={false}
              />
            </AdminPageContainer>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="题单总数" value={practices.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="题目总量"
              value={practices.reduce((sum, item) => sum + (item.problems?.length ?? 0), 0)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有密码题单"
              value={practices.filter((item) => item.hasPassword).length}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="班级题单"
              value={practices.filter((item) => item.audience === 'CLASS').length}
            />
          </Card>
        </Col>
      </Row>

      <AdminPageContainer
        title="题单管理"
        loading={loading}
        extra={
          <Space>
            <Input
              style={{ width: 260 }}
              placeholder="搜索题单名称"
              prefix={<IconSearch />}
              value={keyword}
              onChange={setKeyword}
            />
            <Button icon={<IconRefresh />} onClick={loadPractices}>
              刷新
            </Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => navigate(adminPath('/practices/new'))}>
              创建题单
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={practiceColumns}
          data={filteredPractices}
          pagination={{ pageSize: 20, showTotal: true }}
          expandedRowRender={(record: Practice) => {
            const problems = record.problems ?? [];
            if (problems.length === 0) {
              return <Typography.Text type="secondary">暂无题目</Typography.Text>;
            }
            return (
              <Space wrap>
                {problems.map((problem, index) => (
                  <Tag key={`${record.id}-${normalizeProblemId(problem.id)}-${index}`}>
                    {index + 1}. {problem.title}
                  </Tag>
                ))}
              </Space>
            );
          }}
        />
      </AdminPageContainer>
    </div>
  );
}
