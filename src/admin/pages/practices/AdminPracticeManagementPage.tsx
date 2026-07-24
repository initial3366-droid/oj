import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
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
  IconCopy,
  IconDelete,
  IconEdit,
  IconLeft,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
  IconSend,
} from '@arco-design/web-react/icon';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import { adminPath } from '../../../utils/adminPath';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

type AccessScope = 'ALL' | 'MAJOR' | 'PRIVATE';

interface Problem {
  id: number;
  title: string;
  difficulty: number;
  tags?: string[];
  timeLimit: number;
  memoryLimit: number;
  testCaseCount?: number;
}

interface Practice {
  id: number;
  title: string;
  description?: string;
  ownerAccountType: string;
  accessScope: AccessScope;
  majorId?: number | null;
  majorName?: string | null;
  owner: boolean;
  canEdit: boolean;
  canCopy: boolean;
  canPublish: boolean;
  problems: Problem[];
  createdAt: string;
}

interface PracticePublication {
  id: number;
  sourcePracticeId: number;
  title: string;
  publisherAccountType: string;
  ownerId: number;
  status: string;
  studentAccessMode: 'ALL' | 'SELECTED_CLASSES';
  classIds: number[];
  problems: Problem[];
  createdAt: string;
}

interface Major {
  id: number;
  name: string;
}

interface PageResult<T> {
  total: number;
  list: T[];
}

interface PracticeFormValues {
  title: string;
  description?: string;
  accessScope: AccessScope;
  majorId?: number;
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

function difficultyTag(value?: number) {
  const info = difficultyMap[value ?? 0] ?? { text: '未知', color: 'gray' };
  return <Tag color={info.color}>{info.text}</Tag>;
}

function scopeTag(practice: Practice) {
  if (practice.accessScope === 'ALL') return <Tag color="green">所有人</Tag>;
  if (practice.accessScope === 'MAJOR') return <Tag color="arcoblue">本专业{practice.majorName ? `：${practice.majorName}` : ''}</Tag>;
  return <Tag color="gray">私有</Tag>;
}

export function AdminPracticeManagementPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { practiceId: practiceIdParam } = useParams();
  const mode = modeFromPath(location.pathname);
  const practiceId = practiceIdParam ? Number(practiceIdParam) : null;
  const [form] = Form.useForm<PracticeFormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceTotal, setPracticeTotal] = useState(0);
  const [publications, setPublications] = useState<PracticePublication[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [keyword, setKeyword] = useState('');
  const [problemKeyword, setProblemKeyword] = useState('');
  const [selectedProblemIds, setSelectedProblemIds] = useState<number[]>([]);
  const [accessScope, setAccessScope] = useState<AccessScope>('ALL');

  const filteredPractices = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return normalized ? practices.filter((item) => item.title.toLowerCase().includes(normalized)) : practices;
  }, [keyword, practices]);

  const filteredProblems = useMemo(() => {
    const normalized = problemKeyword.trim().toLowerCase();
    if (!normalized) return problems;
    return problems.filter((item) => item.title.toLowerCase().includes(normalized)
      || String(item.id).includes(normalized)
      || (item.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized)));
  }, [problemKeyword, problems]);

  const problemById = useMemo(() => new Map(problems.map((problem) => [problem.id, problem])), [problems]);
  const selectedProblems = selectedProblemIds
    .map((id) => problemById.get(id))
    .filter((item): item is Problem => Boolean(item));

  useEffect(() => {
    if (mode === 'list') void loadPractices();
    else void loadEditor();
  }, [mode, practiceId]);

  async function loadPractices() {
    setLoading(true);
    try {
      const [result, publicationResult] = await Promise.all([
        adminGet<PageResult<Practice>>('/api/admin/v1/practices?page=1&pageSize=200'),
        adminGet<PracticePublication[]>('/api/admin/v1/practices/publications'),
      ]);
      setPractices(result.list);
      setPracticeTotal(result.total);
      setPublications(publicationResult);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题单列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadEditor() {
    setLoading(true);
    try {
      const requests = await Promise.all([
        adminGet<PageResult<Problem>>('/api/admin/v1/problems?page=1&pageSize=500'),
        adminGet<Major[]>('/api/admin/v1/majors?activeOnly=true'),
        mode === 'edit'
          ? adminGet<PageResult<Practice>>('/api/admin/v1/practices?page=1&pageSize=200')
          : Promise.resolve<PageResult<Practice>>({ total: 0, list: [] }),
      ]);
      const [problemResult, majorResult, practiceResult] = requests;
      setProblems(problemResult.list);
      setMajors(majorResult);
      if (mode === 'edit') {
        const practice = practiceResult.list.find((item) => item.id === practiceId);
        if (!practice || !practice.canEdit) throw new Error('题单不存在或无权编辑');
        setSelectedProblemIds((practice.problems ?? []).map((problem) => problem.id));
        setAccessScope(practice.accessScope ?? 'PRIVATE');
        form.setFieldsValue({
          title: practice.title,
          description: practice.description ?? '',
          accessScope: practice.accessScope ?? 'PRIVATE',
          majorId: practice.majorId ?? undefined,
        });
      } else {
        setSelectedProblemIds([]);
        setAccessScope('ALL');
        form.setFieldsValue({ title: '', description: '', accessScope: 'ALL', majorId: undefined });
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题单数据加载失败');
      navigate(adminPath('/practices'));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    try {
      const values = await form.validate();
      if (selectedProblemIds.length === 0) {
        Message.warning('请至少选择一道题目');
        return;
      }
      if (values.accessScope === 'MAJOR' && !values.majorId) {
        Message.warning('请选择专业');
        return;
      }
      setSubmitting(true);
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        accessScope: values.accessScope,
        majorId: values.accessScope === 'MAJOR' ? values.majorId : null,
        problemIds: selectedProblemIds,
      };
      if (mode === 'edit' && practiceId) {
        await adminPut(`/api/admin/v1/practices/${practiceId}`, payload);
        Message.success('题单已更新');
      } else {
        await adminPost('/api/admin/v1/practices', payload);
        Message.success('题单已创建');
      }
      navigate(adminPath('/practices'));
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    try {
      await adminDelete(`/api/admin/v1/practices/${id}`);
      Message.success('题单已删除');
      void loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function copy(id: number) {
    try {
      await adminPost(`/api/admin/v1/practices/${id}/copy`);
      Message.success('题单已复制');
      void loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '复制失败');
    }
  }

  async function removePublication(id: number) {
    try {
      await adminDelete(`/api/admin/v1/practices/publications/${id}`);
      Message.success('发布实例已删除');
      void loadPractices();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  function toggleProblem(id: number) {
    setSelectedProblemIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <AdminPageContainer
          title={mode === 'edit' ? '编辑题单' : '创建题单'}
          loading={loading}
          extra={(
            <Space>
              <Button icon={<IconLeft />} onClick={() => navigate(adminPath('/practices'))}>返回列表</Button>
              <Button type="primary" icon={<IconSave />} loading={submitting} onClick={submit}>{mode === 'edit' ? '保存修改' : '创建题单'}</Button>
            </Space>
          )}
        >
          <Form
            form={form}
            layout="vertical"
            requiredSymbol={false}
            initialValues={{ accessScope: 'ALL' }}
            onValuesChange={(_, values) => setAccessScope(values.accessScope ?? 'ALL')}
          >
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <FormItem label="题单名称" field="title" rules={[{ required: true, message: '请输入题单名称' }]}>
                  <Input maxLength={100} />
                </FormItem>
              </Col>
              <Col xs={24} md={12}>
                <FormItem label="教师开放范围" field="accessScope">
                  <Radio.Group type="button">
                    <Radio value="ALL">所有人</Radio>
                    <Radio value="MAJOR">本专业</Radio>
                    <Radio value="PRIVATE">私有</Radio>
                  </Radio.Group>
                </FormItem>
              </Col>
              {accessScope === 'MAJOR' && (
                <Col xs={24} md={12}>
                  <FormItem label="授权专业" field="majorId" rules={[{ required: true, message: '请选择专业' }]}>
                    <Select placeholder="选择专业" allowClear>
                      {majors.map((major) => <Select.Option key={major.id} value={major.id}>{major.name}</Select.Option>)}
                    </Select>
                  </FormItem>
                </Col>
              )}
              <Col span={24}>
                <FormItem label="题单介绍" field="description">
                  <TextArea autoSize={{ minRows: 3, maxRows: 7 }} maxLength={2000} showWordLimit />
                </FormItem>
              </Col>
            </Row>
          </Form>
        </AdminPageContainer>

        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <AdminPageContainer title="选择题目" extra={<Input.Search style={{ width: 260 }} placeholder="搜索题目 ID、名称或标签" prefix={<IconSearch />} value={problemKeyword} onChange={setProblemKeyword} />}>
              <Table
                rowKey="id"
                data={filteredProblems}
                pagination={{ pageSize: 10, showTotal: true }}
                columns={[
                  { title: '选择', width: 90, align: 'center' as const, render: (_: unknown, problem: Problem) => <Button size="mini" type={selectedProblemIds.includes(problem.id) ? 'outline' : 'primary'} onClick={() => toggleProblem(problem.id)}>{selectedProblemIds.includes(problem.id) ? '移除' : '选择'}</Button> },
                  { title: 'ID', dataIndex: 'id', width: 80 },
                  { title: '题目', dataIndex: 'title', render: (title: string, problem: Problem) => <div><Typography.Text bold>{title}</Typography.Text><Typography.Text type="secondary" style={{ display: 'block' }}>{problem.timeLimit}ms / {problem.memoryLimit}MB</Typography.Text></div> },
                  { title: '难度', dataIndex: 'difficulty', width: 100, render: difficultyTag },
                ]}
              />
            </AdminPageContainer>
          </Col>
          <Col xs={24} lg={10}>
            <AdminPageContainer title={`已选题目 (${selectedProblems.length})`} extra={<Button size="small" disabled={!selectedProblemIds.length} onClick={() => setSelectedProblemIds([])}>清空</Button>}>
              <Table
                rowKey="id"
                data={selectedProblems}
                pagination={false}
                columns={[
                  { title: '顺序', width: 70, align: 'center' as const, render: (_: unknown, __: Problem, index: number) => index + 1 },
                  { title: '题目', dataIndex: 'title' },
                  { title: '操作', width: 80, render: (_: unknown, problem: Problem) => <Button type="text" size="mini" status="danger" icon={<IconDelete />} onClick={() => toggleProblem(problem.id)}>移除</Button> },
                ]}
              />
            </AdminPageContainer>
          </Col>
        </Row>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col xs={12} lg={6}><Statistic title="题单总数" value={practiceTotal} /></Col>
        <Col xs={12} lg={6}><Statistic title="公开给所有教师" value={practices.filter((item) => item.accessScope === 'ALL').length} /></Col>
        <Col xs={12} lg={6}><Statistic title="专业题单" value={practices.filter((item) => item.accessScope === 'MAJOR').length} /></Col>
        <Col xs={12} lg={6}><Statistic title="题目总量" value={practices.reduce((sum, item) => sum + (item.problems?.length ?? 0), 0)} /></Col>
      </Row>
      <AdminPageContainer
        title={`题单管理（${practiceTotal}）`}
        loading={loading}
        extra={(
          <Space>
            <Input style={{ width: 260 }} placeholder="搜索题单名称" prefix={<IconSearch />} value={keyword} onChange={setKeyword} />
            <Button icon={<IconRefresh />} onClick={loadPractices}>刷新</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => navigate(adminPath('/practices/new'))}>创建题单</Button>
          </Space>
        )}
      >
        <Table
          rowKey="id"
          data={filteredPractices}
          pagination={{ pageSize: 20, showTotal: true }}
          expandedRowRender={(record: Practice) => <Space wrap>{record.problems.map((problem, index) => <Tag key={problem.id}>{index + 1}. {problem.title}</Tag>)}</Space>}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: '题单名称', dataIndex: 'title', render: (title: string, practice: Practice) => <div><Typography.Text bold>{title}</Typography.Text>{practice.description && <Typography.Text type="secondary" ellipsis style={{ display: 'block', maxWidth: 360 }}>{practice.description}</Typography.Text>}</div> },
            { title: '教师开放范围', width: 190, render: (_: unknown, practice: Practice) => scopeTag(practice) },
            { title: '题目数', width: 90, align: 'center' as const, render: (_: unknown, practice: Practice) => practice.problems.length },
            { title: '创建者类型', dataIndex: 'ownerAccountType', width: 110, render: (value: string) => value === 'ADMIN' ? '管理员' : '教师' },
            { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
            {
              title: '操作', width: 300, render: (_: unknown, practice: Practice) => (
                <Space wrap>
                  {practice.canEdit && <Button type="text" size="small" icon={<IconEdit />} onClick={() => navigate(adminPath(`/practices/${practice.id}/edit`))}>编辑</Button>}
                  {practice.canCopy && <Button type="text" size="small" icon={<IconCopy />} onClick={() => copy(practice.id)}>复制</Button>}
                  {practice.canPublish && <Button type="text" size="small" icon={<IconSend />} onClick={() => navigate(adminPath(`/practices/${practice.id}/publish`))}>发布</Button>}
                  {practice.canEdit && <Popconfirm title="确定要删除该题单吗？" onOk={() => remove(practice.id)}><Button type="text" size="small" status="danger" icon={<IconDelete />}>删除</Button></Popconfirm>}
                </Space>
              ),
            },
          ]}
        />
      </AdminPageContainer>
      <AdminPageContainer title={`发布实例（${publications.length}）`} loading={loading}>
        <Table
          rowKey="id"
          data={publications}
          pagination={{ pageSize: 20, showTotal: true }}
          columns={[
            { title: '发布ID', dataIndex: 'id', width: 80 },
            { title: '发布标题', dataIndex: 'title', width: 200, ellipsis: true, render: (value: string) => <Typography.Text bold ellipsis={{ showTooltip: true }} style={{ maxWidth: 180 }}>{value}</Typography.Text> },
            { title: '来源题单', dataIndex: 'sourcePracticeId', width: 90, render: (value: number) => `#${value}` },
            { title: '题目数', width: 80, align: 'center' as const, render: (_: unknown, item: PracticePublication) => item.problems.length },
            {
              title: '学生范围',
              width: 150,
              render: (_: unknown, item: PracticePublication) => item.studentAccessMode === 'ALL'
                ? <Tag color="green">所有学生</Tag>
                : <Tag color="arcoblue">指定班级（{item.classIds.length}）</Tag>,
            },
            { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <Tag color="green">{value === 'PUBLISHED' ? '已发布' : value}</Tag> },
            { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
            {
              title: '操作',
              width: 150,
              render: (_: unknown, item: PracticePublication) => (
                <Space>
                  <Button type="text" size="small" icon={<IconEdit />} onClick={() => navigate(adminPath(`/practices/publications/${item.id}/edit`))}>编辑</Button>
                  <Popconfirm title="确定删除该发布实例吗？删除后学生将无法访问。" onOk={() => removePublication(item.id)}>
                    <Button type="text" size="small" status="danger" icon={<IconDelete />}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </AdminPageContainer>
    </Space>
  );
}
