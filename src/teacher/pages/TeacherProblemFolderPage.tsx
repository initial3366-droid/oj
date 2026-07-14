/**
 * 教师题目文件夹页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
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
  Space,
  Table,
  Tag,
} from '@arco-design/web-react';
import { IconDelete, IconLeft, IconPlus, IconSave, IconSearch } from '@arco-design/web-react/icon';
import { teacherGet, teacherPost, teacherPut, teacherDelete } from '../teacherApi';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

/**
 * 文件夹题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FolderProblem {
  id: number;
  title: string;
  difficulty: number;
  timeLimit: number;
  memoryLimit: number;
}

/**
 * 题目文件夹接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ProblemFolder {
  id: number;
  name: string;
  description: string;
  displayOrder: number;
  problemCount: number;
  problems: FolderProblem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface Problem {
  id: number;
  title: string;
  difficulty: number;
  folderId?: number;
}

/**
 * 页面结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PageResult {
  total: number;
  list: Problem[];
}

/**
 * 封装模式FromPath相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function modeFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.includes('new')) return 'create';
  const idx = parts.indexOf('problem-folders');
  if (idx >= 0 && parts.length > idx + 1) return 'detail';
  return 'list';
}

const difficultyMap: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

/**
 * 封装difficultyTag相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function difficultyTag(value?: number) {
  const info = difficultyMap[value ?? 0] ?? { text: '未知', color: 'gray' };
  return <Tag color={info.color}>{info.text}</Tag>;
}

/**
 * 格式化Date。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 渲染教师题目文件夹页面，并协调其数据加载、状态和交互。
 */
export function TeacherProblemFolderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = modeFromPath(location.pathname);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const folderId = mode === 'detail' ? Number(pathParts[pathParts.length - 1]) : null;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [folders, setFolders] = useState<ProblemFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<ProblemFolder | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [selectedProblemIds, setSelectedProblemIds] = useState<number[]>([]);
  const [keyword, setKeyword] = useState('');
  const [problemKeyword, setProblemKeyword] = useState('');

  /**
   * 封装filteredFolders相关逻辑。对原始数据进行派生或聚合。
   */
  const filteredFolders = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(normalized));
  }, [keyword, folders]);

  /**
   * 封装availableProblems相关逻辑。对原始数据进行派生或聚合。
   */
  const availableProblems = useMemo(() => {
    const selectedSet = new Set(selectedProblemIds);
    return allProblems
      .filter((p) => !selectedSet.has(p.id))
      .filter((p) => {
        if (!problemKeyword.trim()) return true;
        const kw = problemKeyword.trim().toLowerCase();
        return p.title.toLowerCase().includes(kw) || String(p.id).includes(kw);
      });
  }, [allProblems, selectedProblemIds, problemKeyword]);

  /**
   * 封装selectedProblems相关逻辑。对原始数据进行派生或聚合。
   */
  const selectedProblems = useMemo(() => {
    const map = new Map(allProblems.map((p) => [p.id, p]));
    return selectedProblemIds.map((id) => map.get(id)).filter(Boolean) as Problem[];
  }, [allProblems, selectedProblemIds]);

  useEffect(() => {
    if (mode === 'list' || mode === 'create') loadFolders();
    if (mode === 'detail' && folderId) loadFolderDetail(folderId);
  }, [mode, folderId]);

  /**
   * 读取Folders并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadFolders() {
    setLoading(true);
    try {
      const result = await teacherGet<ProblemFolder[]>('/api/admin/v1/problem-folders');
      setFolders(result);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 读取文件夹详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function loadFolderDetail(id: number) {
    setLoading(true);
    try {
      const [folder, problemResult] = await Promise.all([
        teacherGet<ProblemFolder>(`/api/admin/v1/problem-folders/${id}`),
        teacherGet<PageResult>('/api/admin/v1/problems?page=1&pageSize=500'),
      ]);
      setCurrentFolder(folder);
      setAllProblems(problemResult.list);
      setSelectedProblemIds(folder.problems.map((p) => p.id));
      form.setFieldsValue({ name: folder.name, description: folder.description });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载失败');
      navigate('/teacher/problem-folders');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理Create。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function handleCreate() {
    try {
      const values = await form.validate();
      setSubmitting(true);
      await teacherPost('/api/admin/v1/problem-folders', {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        displayOrder: 0,
      });
      Message.success('文件夹创建成功');
      navigate('/teacher/problem-folders');
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 处理UpdateInfo。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function handleUpdateInfo() {
    if (!folderId) return;
    try {
      const values = await form.validate();
      setSubmitting(true);
      await teacherPut(`/api/admin/v1/problem-folders/${folderId}`, {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        displayOrder: currentFolder?.displayOrder ?? 0,
      });
      Message.success('文件夹信息已保存');
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 处理SaveProblems。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function handleSaveProblems() {
    if (!folderId) return;
    setSubmitting(true);
    try {
      await teacherPost(`/api/admin/v1/problem-folders/${folderId}/problems`, {
        problemIds: selectedProblemIds,
      });
      Message.success('题目已更新');
      loadFolderDetail(folderId);
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 处理Delete。包含异步流程并由调用方处理完成或失败状态。
   */
  async function handleDelete(id: number) {
    try {
      await teacherDelete(`/api/admin/v1/problem-folders/${id}`);
      Message.success('文件夹已删除');
      loadFolders();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  /**
   * 创建或提交题目。会更新 React 状态并触发重新渲染。
   */
  function addProblem(id: number) {
    setSelectedProblemIds((prev) => [...prev, id]);
  }

  /**
   * 删除题目。会更新 React 状态并触发重新渲染。
   */
  function removeProblem(id: number) {
    setSelectedProblemIds((prev) => prev.filter((pid) => pid !== id));
  }

  // 列表模式：只展示当前教师自己添加的文件夹，默认每页 10 个
  if (mode === 'list') {
    return (
      <Card
        bordered={false}
        title="题目文件夹"
        extra={
          <Space>
            <Input
              style={{ width: 240 }}
              placeholder="搜索文件夹"
              prefix={<IconSearch />}
              value={keyword}
              onChange={setKeyword}
              allowClear
            />
            <Button type="primary" icon={<IconPlus />} onClick={() => navigate('/teacher/problem-folders/new')}>
              新建文件夹
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          data={filteredFolders}
          pagination={{ pageSize: 10, showTotal: true }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 90, align: 'center' },
            { title: '文件夹名称', dataIndex: 'name', width: 180, ellipsis: true },
            { title: '介绍', dataIndex: 'description', ellipsis: true, render: (value: string) => value || '暂无介绍' },
            {
              title: '题目数量',
              dataIndex: 'problemCount',
              width: 120,
              align: 'center',
              render: (value: number) => <Tag color="blue">{value || 0} 道题目</Tag>,
            },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: formatDate },
            { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: formatDate },
            {
              title: '操作',
              width: 150,
              align: 'center',
              fixed: 'right',
              render: (_: unknown, folder: ProblemFolder) => (
                <Space size={4}>
                  <Button type="text" size="small" onClick={() => navigate(`/teacher/problem-folders/${folder.id}`)}>
                    编辑
                  </Button>
                  <Popconfirm title="确定删除？题目将移至默认文件夹" onOk={() => handleDelete(folder.id)}>
                    <Button type="text" size="small" status="danger" icon={<IconDelete />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    );
  }

  // 新建模式
  if (mode === 'create') {
    return (
      <Card
        bordered={false}
        title="新建文件夹"
        extra={
          <Space>
            <Button icon={<IconLeft />} onClick={() => navigate('/teacher/problem-folders')}>返回列表</Button>
            <Button type="primary" icon={<IconSave />} loading={submitting} onClick={handleCreate}>创建</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <FormItem label="文件夹名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：动态规划、图论" maxLength={100} />
          </FormItem>
          <FormItem label="文件夹介绍" field="description">
            <TextArea placeholder="文件夹描述（可选）" autoSize={{ minRows: 3, maxRows: 6 }} maxLength={500} showWordLimit />
          </FormItem>
        </Form>
      </Card>
    );
  }

  // 详情/编辑模式
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title={`编辑文件夹：${currentFolder?.name ?? ''}`}
        extra={<Button icon={<IconLeft />} onClick={() => navigate('/teacher/problem-folders')}>返回列表</Button>}
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 800 }}>
          <Row gutter={24}>
            <Col span={12}>
              <FormItem label="文件夹名称" field="name" rules={[{ required: true }]}>
                <Input maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label=" ">
                <Button type="primary" icon={<IconSave />} loading={submitting} onClick={handleUpdateInfo}>保存信息</Button>
              </FormItem>
            </Col>
            <Col span={24}>
              <FormItem label="文件夹介绍" field="description">
                <TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={500} showWordLimit />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card bordered={false} title={`已选题目 (${selectedProblems.length})`}
            extra={<Button type="primary" size="small" icon={<IconSave />} loading={submitting} onClick={handleSaveProblems}>保存题目</Button>}
          >
            <Table
              rowKey="id"
              data={selectedProblems}
              pagination={false}
              columns={[
                { title: '顺序', width: 70, align: 'center', render: (_: unknown, __: Problem, i: number) => i + 1 },
                { title: '题目', dataIndex: 'title' },
                { title: '难度', dataIndex: 'difficulty', width: 90, render: (v: number) => difficultyTag(v) },
                { title: '操作', width: 80, align: 'center', render: (_: unknown, r: Problem) => (
                  <Button type="text" size="mini" status="danger" icon={<IconDelete />} onClick={() => removeProblem(r.id)}>移除</Button>
                )},
              ]}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered={false} title="可选题目"
            extra={<Input.Search style={{ width: 200 }} placeholder="搜索题目" prefix={<IconSearch />} value={problemKeyword} onChange={setProblemKeyword} onSearch={setProblemKeyword} />}
          >
            <Table
              rowKey="id"
              data={availableProblems}
              pagination={{ pageSize: 10, showTotal: true }}
              columns={[
                { title: '操作', width: 80, align: 'center', render: (_: unknown, r: Problem) => (
                  <Button size="mini" type="primary" onClick={() => addProblem(r.id)}>添加</Button>
                )},
                { title: '题目', dataIndex: 'title' },
                { title: '难度', dataIndex: 'difficulty', width: 90, render: (v: number) => difficultyTag(v) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
