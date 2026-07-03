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
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconLeft, IconPlus, IconSave, IconSearch } from '@arco-design/web-react/icon';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';
import { AdminPageContainer } from '../../layout/AdminPageContainer';

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

interface PageResult<T> {
  total: number;
  list: T[];
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

export function AdminProblemFolderPage() {
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
    if (mode === 'list' || mode === 'create') {
      loadFolders();
    }
    if (mode === 'detail' && folderId) {
      loadFolderDetail(folderId);
    }
  }, [mode, folderId]);

  async function loadFolders() {
    setLoading(true);
    try {
      const result = await adminGet<ProblemFolder[]>('/api/admin/v1/problem-folders');
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
        adminGet<ProblemFolder>(`/api/admin/v1/problem-folders/${id}`),
        adminGet<PageResult<Problem>>('/api/admin/v1/problems?page=1&pageSize=500'),
      ]);
      setCurrentFolder(folder);
      setAllProblems(problemResult.list);
      setSelectedProblemIds(folder.problems.map((p) => p.id));
      form.setFieldsValue({ name: folder.name, description: folder.description });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载失败');
      navigate(adminPath('/problem-folders'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      const values = await form.validate();
      setSubmitting(true);
      await adminPost('/api/admin/v1/problem-folders', {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        displayOrder: 0,
      });
      Message.success('文件夹创建成功');
      navigate(adminPath('/problem-folders'));
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
      await adminPut(`/api/admin/v1/problem-folders/${folderId}`, {
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
      await adminPost(`/api/admin/v1/problem-folders/${folderId}/problems`, {
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
      await adminDelete(`/api/admin/v1/problem-folders/${id}`);
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
      <AdminPageContainer
        title="题目文件夹"
        loading={loading}
        extra={
          <Space>
            <Input
              style={{ width: 240 }}
              placeholder="搜索文件夹"
              prefix={<IconSearch />}
              value={keyword}
              onChange={setKeyword}
            />
            <Button type="primary" icon={<IconPlus />} onClick={() => navigate(adminPath('/problem-folders/new'))}>
              新建文件夹
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          data={filteredFolders}
          scroll={{ x: '100%' }}
          pagination={{ pageSize: 20, sizeCanChange: true, showTotal: true }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: '文件夹名称', dataIndex: 'name', ellipsis: true },
            { title: '描述', dataIndex: 'description', width: 260, ellipsis: true, render: (v: string) => v || '-' },
            { title: '题目数量', dataIndex: 'problemCount', width: 100, align: 'center' },
            { title: '显示顺序', dataIndex: 'displayOrder', width: 100, align: 'center' },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
            },
            {
              title: '操作',
              width: 170,
              render: (_: unknown, folder: ProblemFolder) => (
                <Space size={4}>
                  <Button
                    size="mini"
                    icon={<IconEdit />}
                    onClick={() => navigate(`/admin/problem-folders/${folder.id}`)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除？题目将移至默认文件夹"
                    onOk={() => handleDelete(folder.id)}
                  >
                    <Button size="mini" status="danger" icon={<IconDelete />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </AdminPageContainer>
    );
  }

  // 新建模式
  if (mode === 'create') {
    return (
      <AdminPageContainer
        title="新建文件夹"
        loading={loading}
        extra={
          <Space>
            <Button icon={<IconLeft />} onClick={() => navigate(adminPath('/problem-folders'))}>
              返回列表
            </Button>
            <Button type="primary" icon={<IconSave />} loading={submitting} onClick={handleCreate}>
              创建
            </Button>
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
      </AdminPageContainer>
    );
  }

  // 详情/编辑模式
  return (
    <div>
      <AdminPageContainer
        title={`编辑文件夹：${currentFolder?.name ?? ''}`}
        loading={loading}
        extra={
          <Button icon={<IconLeft />} onClick={() => navigate(adminPath('/problem-folders'))}>
            返回列表
          </Button>
        }
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 800 }}>
          <Row gutter={24}>
            <Col span={12}>
              <FormItem label="文件夹名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
                <Input maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label=" ">
                <Button type="primary" icon={<IconSave />} loading={submitting} onClick={handleUpdateInfo}>
                  保存信息
                </Button>
              </FormItem>
            </Col>
            <Col span={24}>
              <FormItem label="文件夹介绍" field="description">
                <TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={500} showWordLimit />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </AdminPageContainer>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={14}>
          <AdminPageContainer
            title={`已选题目 (${selectedProblems.length})`}
            extra={
              <Button
                type="primary"
                size="small"
                icon={<IconSave />}
                loading={submitting}
                onClick={handleSaveProblems}
              >
                保存题目
              </Button>
            }
          >
            <Table
              rowKey="id"
              data={selectedProblems}
              pagination={false}
              columns={[
                { title: '顺序', width: 70, align: 'center', render: (_: unknown, __: Problem, i: number) => i + 1 },
                { title: '题目', dataIndex: 'title', render: (t: string, r: Problem) => <Space><Typography.Text code>#{r.id}</Typography.Text><Typography.Text>{t}</Typography.Text></Space> },
                { title: '难度', dataIndex: 'difficulty', width: 90, render: (v: number) => difficultyTag(v) },
                {
                  title: '操作', width: 80, align: 'center',
                  render: (_: unknown, r: Problem) => (
                    <Button type="text" size="mini" status="danger" icon={<IconDelete />} onClick={() => removeProblem(r.id)}>
                      移除
                    </Button>
                  ),
                },
              ]}
            />
          </AdminPageContainer>
        </Col>
        <Col span={10}>
          <AdminPageContainer
            title="可选题目"
            extra={
              <Input.Search
                style={{ width: 200 }}
                placeholder="搜索题目"
                prefix={<IconSearch />}
                value={problemKeyword}
                onChange={setProblemKeyword}
                onSearch={setProblemKeyword}
              />
            }
          >
            <Table
              rowKey="id"
              data={availableProblems}
              pagination={{ pageSize: 10, showTotal: true }}
              columns={[
                {
                  title: '操作', width: 80, align: 'center',
                  render: (_: unknown, r: Problem) => (
                    <Button size="mini" type="primary" onClick={() => addProblem(r.id)}>
                      添加
                    </Button>
                  ),
                },
                { title: '题目', dataIndex: 'title' },
                { title: '难度', dataIndex: 'difficulty', width: 90, render: (v: number) => difficultyTag(v) },
              ]}
            />
          </AdminPageContainer>
        </Col>
      </Row>
    </div>
  );
}
