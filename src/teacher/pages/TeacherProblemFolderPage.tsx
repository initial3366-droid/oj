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
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconFile, IconLeft, IconPlus, IconSave, IconSearch } from '@arco-design/web-react/icon';
import { teacherGet, teacherPost, teacherPut, teacherDelete } from '../teacherApi';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

interface FolderProblem {
  id: number;
  title: string;
  difficulty: number;
  timeLimit: number;
  memoryLimit: number;
}

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

interface Problem {
  id: number;
  title: string;
  difficulty: number;
  folderId?: number;
}

interface PageResult {
  total: number;
  list: Problem[];
}

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

function difficultyTag(value?: number) {
  const info = difficultyMap[value ?? 0] ?? { text: '未知', color: 'gray' };
  return <Tag color={info.color}>{info.text}</Tag>;
}

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

  const filteredFolders = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(normalized));
  }, [keyword, folders]);

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

  const selectedProblems = useMemo(() => {
    const map = new Map(allProblems.map((p) => [p.id, p]));
    return selectedProblemIds.map((id) => map.get(id)).filter(Boolean) as Problem[];
  }, [allProblems, selectedProblemIds]);

  useEffect(() => {
    if (mode === 'list' || mode === 'create') loadFolders();
    if (mode === 'detail' && folderId) loadFolderDetail(folderId);
  }, [mode, folderId]);

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

  async function handleDelete(id: number) {
    try {
      await teacherDelete(`/api/admin/v1/problem-folders/${id}`);
      Message.success('文件夹已删除');
      loadFolders();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  function addProblem(id: number) {
    setSelectedProblemIds((prev) => [...prev, id]);
  }

  function removeProblem(id: number) {
    setSelectedProblemIds((prev) => prev.filter((pid) => pid !== id));
  }

  // 卡片列表模式
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
            />
            <Button type="primary" icon={<IconPlus />} onClick={() => navigate('/teacher/problem-folders/new')}>
              新建文件夹
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {filteredFolders.map((folder) => (
            <Col key={folder.id} span={8}>
              <Card
                hoverable
                onClick={() => navigate(`/teacher/problem-folders/${folder.id}`)}
                style={{ cursor: 'pointer' }}
                actions={[
                  <Button key="edit" type="text" size="small" onClick={(e) => { e.stopPropagation(); navigate(`/teacher/problem-folders/${folder.id}`); }}>
                    编辑
                  </Button>,
                  <Popconfirm key="delete" title="确定删除？题目将移至默认文件夹" onOk={(e) => { e?.stopPropagation(); handleDelete(folder.id); }}>
                    <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={(e) => e.stopPropagation()}>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <Typography.Title heading={5} style={{ margin: 0 }}>{folder.name}</Typography.Title>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, minHeight: 40 }}>
                  {folder.description || '暂无介绍'}
                </Typography.Text>
                <Tag color="blue" style={{ marginTop: 12 }}>{folder.problemCount} 道题目</Tag>
              </Card>
            </Col>
          ))}
          {filteredFolders.length === 0 && (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>暂无文件夹</div>
            </Col>
          )}
        </Row>
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
