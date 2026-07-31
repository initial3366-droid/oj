/**
 * 管理员题目文件夹页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { adminPath } from '../../../utils/adminPath';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
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
import { IconDelete, IconEdit, IconLeft, IconPlus, IconSave, IconSearch } from '@arco-design/web-react/icon';
import {
  ProblemFolderCandidatePicker,
  type ProblemFolderCandidate,
} from '../../../components/problems/ProblemFolderCandidatePicker';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';
import { AdminPageContainer } from '../../layout/AdminPageContainer';

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
  accessScope: 'ALL' | 'MAJOR' | 'PRIVATE';
  majorId?: number | null;
  majorName?: string | null;
  owner: boolean;
  canEdit: boolean;
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
 * 渲染管理员题目文件夹页面，并协调其数据加载、状态和交互。
 */
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
  const [selectedProblems, setSelectedProblems] = useState<Problem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [majors, setMajors] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [accessScope, setAccessScope] = useState<'ALL' | 'MAJOR' | 'PRIVATE'>('ALL');
  const selectedProblemIds = useMemo(() => selectedProblems.map((problem) => problem.id), [selectedProblems]);

  /**
   * 封装filteredFolders相关逻辑。对原始数据进行派生或聚合。
   */
  const filteredFolders = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(normalized));
  }, [keyword, folders]);

  useEffect(() => {
    if (mode === 'list' || mode === 'create') {
      loadFolders();
    }
    if (mode === 'detail' && folderId) {
      loadFolderDetail(folderId);
    }
  }, [mode, folderId]);

  useEffect(() => {
    adminGet<Array<{ id: number; code: string; name: string }>>('/api/admin/v1/majors?activeOnly=true').then(setMajors).catch(() => setMajors([]));
  }, []);

  /**
   * 读取Folders并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
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

  /**
   * 读取文件夹详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function loadFolderDetail(id: number) {
    setLoading(true);
    try {
      const [folder, folderResult] = await Promise.all([
        adminGet<ProblemFolder>(`/api/admin/v1/problem-folders/${id}`),
        adminGet<ProblemFolder[]>('/api/admin/v1/problem-folders'),
      ]);
      setCurrentFolder(folder);
      setFolders(folderResult);
      setSelectedProblems(folder.problems);
      form.setFieldsValue({ name: folder.name, description: folder.description, accessScope: folder.accessScope, majorId: folder.majorId });
      setAccessScope(folder.accessScope);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '加载失败');
      navigate(adminPath('/problem-folders'));
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理Create。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function handleCreate() {
    try {
      const values = await form.validate();
      setSubmitting(true);
      const created = await adminPost<ProblemFolder>('/api/admin/v1/problem-folders', {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        displayOrder: 0,
        accessScope: values.accessScope || 'ALL',
        majorId: values.majorId || null,
      });
      Message.success('文件夹创建成功');
      navigate(adminPath(`/problem-folders/${created.id}`));
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 处理UpdateInfo。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function handleUpdateInfo() {
    if (!folderId) return;
    try {
      const values = await form.validate();
      setSubmitting(true);
      await adminPut(`/api/admin/v1/problem-folders/${folderId}`, {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        displayOrder: currentFolder?.displayOrder ?? 0,
        accessScope: values.accessScope,
        majorId: values.majorId || null,
      });
      Message.success('文件夹信息已保存');
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 处理SaveProblems。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function handleSaveProblems() {
    if (!folderId) return;
    setSubmitting(true);
    try {
      await adminPut(`/api/admin/v1/problem-folders/${folderId}/problems`, {
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
   * 处理Delete。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
   */
  async function handleDelete(id: number) {
    try {
      await adminDelete(`/api/admin/v1/problem-folders/${id}`);
      Message.success('文件夹已删除');
      loadFolders();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  /**
   * 创建或提交题目。会更新 React 状态并触发重新渲染。
   */
  function addProblem(problem: ProblemFolderCandidate) {
    setSelectedProblems((current) => current.some((item) => item.id === problem.id)
      ? current
      : [...current, problem]);
  }

  /**
   * 删除题目。会更新 React 状态并触发重新渲染。
   */
  function removeProblem(id: number) {
    setSelectedProblems((current) => current.filter((problem) => problem.id !== id));
  }

  // 卡片列表模式
  if (mode === 'list') {
    return (
      <AdminPageContainer
        title={`题目文件夹（${folders.length}）`}
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
            {
              title: '开放范围', dataIndex: 'accessScope', width: 120,
              render: (_: unknown, item: ProblemFolder) => <Tag>{item.accessScope === 'ALL' ? '所有人' : item.accessScope === 'MAJOR' ? item.majorName || '本专业' : '私有'}</Tag>,
            },
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
                    title="确定删除？文件夹中的题目会保留"
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
        <Form form={form} layout="vertical" requiredSymbol={false} style={{ maxWidth: 600 }}>
          <FormItem label="文件夹名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：动态规划、图论" maxLength={100} />
          </FormItem>
          <FormItem label="文件夹介绍" field="description">
            <TextArea placeholder="文件夹描述（可选）" autoSize={{ minRows: 3, maxRows: 6 }} maxLength={500} showWordLimit />
          </FormItem>
          <FormItem label="教师开放范围" field="accessScope" initialValue="ALL" rules={[{ required: true, message: '请选择教师开放范围' }]}>
            <Select onChange={(value) => setAccessScope(value as 'ALL' | 'MAJOR' | 'PRIVATE')}>
              <Select.Option value="ALL">所有人</Select.Option><Select.Option value="MAJOR">本专业</Select.Option><Select.Option value="PRIVATE">私有</Select.Option>
            </Select>
          </FormItem>
          {accessScope === 'MAJOR' && <FormItem label="所属专业" field="majorId" rules={[{ required: true, message: '请选择专业' }]}>
            <Select>{majors.map((major) => <Select.Option key={major.id} value={major.id}>{major.name}（{major.code}）</Select.Option>)}</Select>
          </FormItem>}
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
        <Form form={form} layout="vertical" requiredSymbol={false} style={{ maxWidth: 800 }}>
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
            <Col span={12}>
              <FormItem label="教师开放范围" field="accessScope" rules={[{ required: true, message: '请选择教师开放范围' }]}>
                <Select onChange={(value) => setAccessScope(value as 'ALL' | 'MAJOR' | 'PRIVATE')}>
                  <Select.Option value="ALL">所有人</Select.Option><Select.Option value="MAJOR">本专业</Select.Option><Select.Option value="PRIVATE">私有</Select.Option>
                </Select>
              </FormItem>
            </Col>
            {accessScope === 'MAJOR' && <Col span={12}><FormItem label="所属专业" field="majorId" rules={[{ required: true, message: '请选择专业' }]}>
              <Select>{majors.map((major) => <Select.Option key={major.id} value={major.id}>{major.name}（{major.code}）</Select.Option>)}</Select>
            </FormItem></Col>}
          </Row>
        </Form>
      </AdminPageContainer>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
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
        {folderId && <Col span={12}>
          <AdminPageContainer title="可选题目">
            <ProblemFolderCandidatePicker
              variant="admin"
              folderId={folderId}
              folders={folders}
              selectedProblemIds={selectedProblemIds}
              onAdd={addProblem}
            />
          </AdminPageContainer>
        </Col>}
      </Row>
    </div>
  );
}
