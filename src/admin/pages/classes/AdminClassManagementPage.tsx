/**
 * 管理员班级Management页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { adminPath } from '../../../utils/adminPath';
import {
  Alert,
  Button,
  Card,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconEye, IconImport, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';

const FormItem = Form.Item;
const Option = Select.Option;
const { Row, Col } = Grid;

/**
 * 班级Room接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ClassRoom {
  id: number;
  name: string;
  description?: string | null;
  teacherId: number;
  teacherName?: string | null;
  memberCount: number;
  joinEnabled: boolean;
  approvalRequired: boolean;
  createdAt: string;
  updatedAt?: string | null;
  members?: ClassMember[];
}

/**
 * 班级Member接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ClassMember {
  userId: number;
  username?: string | null;
  displayName?: string | null;
  studentNo?: string | null;
  email?: string | null;
  source?: string | null;
  profileFields?: Record<string, string>;
  joinedAt: string;
}

/**
 * 教师Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherOption {
  id: number;
  username: string;
  displayName: string;
}

/**
 * 班级FormData接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ClassFormData {
  name: string;
  description?: string;
  teacherId: number;
  joinEnabled: boolean;
  approvalRequired: boolean;
}

/**
 * Import结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ImportResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ rowNumber: number; studentNo?: string | null; reason: string }>;
}

/**
 * ImportFormData接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ImportFormData {
  classId: number;
  studentNoField: string;
  nameField: string;
}

/**
 * 格式化Date。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

/**
 * 渲染管理员班级Management页面，并协调其数据加载、状态和交互。
 */
export function AdminClassManagementPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [deleteClass, setDeleteClass] = useState<ClassRoom | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'warning'; content: string } | null>(null);
  const [form] = Form.useForm<ClassFormData>();
  const [importForm] = Form.useForm<ImportFormData>();

  /**
   * 读取Classes并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      setClasses(await adminGet<ClassRoom[]>(`/api/admin/v1/classes?${params.toString()}`));
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '班级列表加载失败' });
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  /**
   * 读取Teachers并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const loadTeachers = useCallback(async (nextKeyword = '', required?: TeacherOption) => {
    setTeacherLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextKeyword.trim()) params.set('keyword', nextKeyword.trim());
      const rows = await adminGet<TeacherOption[]>(`/api/admin/v1/teachers?${params.toString()}`);
      setTeachers(required && !rows.some((item) => item.id === required.id) ? [required, ...rows] : rows);
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '教师列表加载失败' });
    } finally {
      setTeacherLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  /**
   * 封装openCreate相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openCreate() {
    setEditingClass(null);
    form.resetFields();
    form.setFieldsValue({ joinEnabled: true, approvalRequired: true });
    setModalVisible(true);
  }

  /**
   * 封装openImport相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openImport(item?: ClassRoom) {
    setSelectedImportFile(null);
    setImportResult(null);
    importForm.setFieldsValue({
      classId: item?.id,
      studentNoField: '学号',
      nameField: '姓名',
    });
    setImportModalVisible(true);
  }

  /**
   * 处理ImportFileChange。会更新 React 状态并触发重新渲染。
   */
  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
      setNotice({ type: 'error', content: '仅支持 csv、xls、xlsx 文件' });
      event.target.value = '';
      return;
    }
    setSelectedImportFile(file);
    setImportResult(null);
    event.target.value = '';
  }

  /**
   * 创建或提交Import。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function submitImport(values: ImportFormData) {
    if (!selectedImportFile) {
      setNotice({ type: 'warning', content: '请选择 csv、xls 或 xlsx 文件' });
      return;
    }
    const formData = new FormData();
    formData.append('classId', String(values.classId));
    formData.append('studentNoField', values.studentNoField);
    formData.append('nameField', values.nameField);
    formData.append('file', selectedImportFile);
    try {
      setImporting(true);
      const result = await adminPost<ImportResult>('/api/admin/v1/students/import', formData);
      setImportResult(result);
      setNotice({ type: 'success', content: '导入完成' });
      loadClasses();
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '导入失败' });
    } finally {
      setImporting(false);
    }
  }

  /**
   * 封装openEdit相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openEdit(item: ClassRoom) {
    setEditingClass(item);
    if (item.teacherId && item.teacherName) {
      loadTeachers(item.teacherName, { id: item.teacherId, username: '', displayName: item.teacherName });
    }
    form.setFieldsValue({
      name: item.name,
      description: item.description || '',
      teacherId: item.teacherId,
      joinEnabled: item.joinEnabled,
      approvalRequired: item.approvalRequired,
    });
    setModalVisible(true);
  }

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function submit(values: ClassFormData) {
    const payload = {
      name: values.name?.trim(),
      description: values.description?.trim() || undefined,
      teacherId: Number(values.teacherId),
      joinEnabled: Boolean(values.joinEnabled),
      approvalRequired: Boolean(values.approvalRequired),
    };
    try {
      if (editingClass) {
        await adminPut(`/api/admin/v1/classes/${editingClass.id}`, payload);
        setNotice({ type: 'success', content: '班级已更新' });
      } else {
        await adminPost('/api/admin/v1/classes', payload);
        setNotice({ type: 'success', content: '班级已创建' });
      }
      setModalVisible(false);
      loadClasses();
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '保存失败' });
    }
  }

  /**
   * 封装confirmDelete相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function confirmDelete() {
    if (!deleteClass) return;
    try {
      await adminDelete(`/api/admin/v1/classes/${deleteClass.id}`);
      setNotice({ type: 'success', content: '班级已删除' });
      setDeleteClass(null);
      loadClasses();
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '删除失败' });
    }
  }

  return (
    <Card>
      {notice && (
        <Alert
          type={notice.type}
          content={notice.content}
          closable
          onClose={() => setNotice(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space style={{ marginBottom: 16 }}>
        <Input
          style={{ width: 280 }}
          placeholder="搜索班级名称"
          value={searchInput}
          onChange={setSearchInput}
          onPressEnter={() => setKeyword(searchInput)}
          prefix={<IconSearch />}
        />
        <Button icon={<IconSearch />} onClick={() => setKeyword(searchInput)}>
          搜索
        </Button>
        <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
          创建班级
        </Button>
        <Button icon={<IconImport />} onClick={() => openImport()}>
          导入学生
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        data={classes}
        pagination={{ pageSize: 20, sizeCanChange: true, showTotal: true }}
        scroll={{ x: '100%' }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 90 },
          { title: '班级名称', dataIndex: 'name', width: 160, ellipsis: true },
          { title: '教师', dataIndex: 'teacherName', width: 120, ellipsis: true, render: (value: string) => value || '-' },
          { title: '人数', dataIndex: 'memberCount', width: 64 },
          {
            title: '加入',
            dataIndex: 'joinEnabled',
            width: 70,
            render: (value: boolean) => <Tag color={value ? 'green' : 'gray'}>{value ? '开启' : '关闭'}</Tag>,
          },
          {
            title: '审核',
            dataIndex: 'approvalRequired',
            width: 70,
            render: (value: boolean) => <Tag color={value ? 'orange' : 'green'}>{value ? '需要' : '自动'}</Tag>,
          },
          { title: '创建时间', dataIndex: 'createdAt', width: 170, render: formatDate },
          {
            title: '操作',
            width: 220,
            render: (_: unknown, record: ClassRoom) => (
              <Space size={4}>
                <Button size="mini" icon={<IconEye />} onClick={() => navigate(`/admin/classes/${record.id}`)}>
                  查看
                </Button>
                <Button size="mini" icon={<IconEdit />} onClick={() => openEdit(record)}>
                  编辑
                </Button>
                <Button size="mini" icon={<IconImport />} onClick={() => openImport(record)}>
                  导入
                </Button>
                <Button size="mini" status="danger" icon={<IconDelete />} onClick={() => setDeleteClass(record)}>
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingClass ? '编辑班级' : '创建班级'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        style={{ width: 620 }}
      >
        <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} onSubmit={submit}>
          <FormItem label="班级名称" field="name" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="班级名称" />
          </FormItem>
          <FormItem label="班级介绍" field="description">
            <Input.TextArea placeholder="班级介绍" autoSize={{ minRows: 3, maxRows: 6 }} />
          </FormItem>
          <FormItem label="教师" field="teacherId" rules={[{ required: true, message: '请选择教师' }]}>
            <Select
              placeholder="选择教师"
              showSearch
              filterOption={false}
              loading={teacherLoading}
              onSearch={(value) => loadTeachers(value)}
            >
              {teachers.map((teacher) => (
                <Option key={teacher.id} value={teacher.id}>
                  {teacher.displayName || teacher.username}（{teacher.username || teacher.id}）
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="允许加入" field="joinEnabled" triggerPropName="checked">
            <Switch checkedText="开启" uncheckedText="关闭" />
          </FormItem>
          <FormItem label="加入审核" field="approvalRequired" triggerPropName="checked">
            <Switch checkedText="需要" uncheckedText="自动" />
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title="删除班级"
        visible={!!deleteClass}
        okText="确认删除"
        cancelText="取消"
        onCancel={() => setDeleteClass(null)}
        onOk={confirmDelete}
        okButtonProps={{ status: 'danger' }}
      >
        <Typography.Text>确认删除班级 {deleteClass?.name}？学生主班级、申请和班级受众会同步清理。</Typography.Text>
      </Modal>

      <Modal
        title="导入学生"
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={() => importForm.submit()}
        confirmLoading={importing}
        style={{ width: 720 }}
      >
        <Alert
          type="info"
          content="仅支持 .csv、.xls、.xlsx。首行必须是表头，必需字段为“学号”和“姓名”；其他列会保存为学生扩展资料，不导入邮箱。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={importForm} layout="vertical" onSubmit={submitImport}>
          <FormItem field="classId" label="目标班级" rules={[{ required: true, message: '请选择班级' }]}>
            <Select placeholder="选择班级">
              {classes.map((item) => <Option key={item.id} value={item.id}>{item.name}（{item.id}）</Option>)}
            </Select>
          </FormItem>
          <FormItem label="导入文件" required>
            <Space>
              <input type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleImportFileChange} />
              {selectedImportFile && <Tag color="blue">{selectedImportFile.name}</Tag>}
            </Space>
          </FormItem>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormItem field="studentNoField" label="学号字段" rules={[{ required: true, message: '请输入学号字段' }]}>
              <Input />
            </FormItem>
            <FormItem field="nameField" label="姓名字段" rules={[{ required: true, message: '请输入姓名字段' }]}>
              <Input />
            </FormItem>
          </div>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            示例表头：学号,姓名,手机号,专业,备注
          </Typography.Paragraph>
        </Form>
        {importResult && (
          <Card size="small" title="导入结果" style={{ marginTop: 16 }}>
            <Space>
              <Tag color="green">成功 {importResult.successCount}</Tag>
              <Tag color="red">失败 {importResult.failureCount}</Tag>
            </Space>
            {importResult.errors.length > 0 && (
              <Table
                style={{ marginTop: 12 }}
                rowKey="rowNumber"
                data={importResult.errors}
                pagination={false}
                columns={[
                  { title: '行号', dataIndex: 'rowNumber', width: 100 },
                  { title: '学号', dataIndex: 'studentNo', width: 160 },
                  { title: '原因', dataIndex: 'reason' },
                ]}
              />
            )}
          </Card>
        )}
      </Modal>
    </Card>
  );
}

/**
 * 渲染管理员班级详情页面，并协调其数据加载、状态和交互。
 */
export function AdminClassDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const classId = Number(params.classId);
  const [detail, setDetail] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error'; content: string } | null>(null);

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      setDetail(await adminGet<ClassRoom>(`/api/admin/v1/classes/${classId}`));
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '班级详情加载失败' });
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {notice && <Alert type={notice.type} content={notice.content} closable onClose={() => setNotice(null)} />}

      <Card>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Statistic title="班级 ID" value={detail?.id ?? '-'} />
          </Col>
          <Col span={6}>
            <Statistic title="人数" value={detail?.memberCount ?? 0} />
          </Col>
          <Col span={6}>
            <Statistic title="教师" value={detail?.teacherName || '-'} />
          </Col>
          <Col span={6}>
            <Tag color={detail?.joinEnabled ? 'green' : 'gray'}>{detail?.joinEnabled ? '允许加入' : '关闭加入'}</Tag>
          </Col>
        </Row>
      </Card>

      <Card title={detail?.name || '班级详情'} extra={<Button onClick={() => navigate(adminPath('/classes'))}>返回列表</Button>}>
        <Table
          rowKey="userId"
          loading={loading}
          data={detail?.members ?? []}
          pagination={{ pageSize: 20, sizeCanChange: true, showTotal: true }}
          columns={[
            { title: '用户ID', dataIndex: 'userId', width: 120 },
            { title: '用户名', dataIndex: 'username', width: 160, render: (value) => value || '-' },
            { title: '姓名', dataIndex: 'displayName', width: 160, render: (value) => value || '-' },
            { title: '学号', dataIndex: 'studentNo', width: 160, render: (value) => value || '-' },
            { title: '来源', dataIndex: 'source', width: 130, render: (value) => value || '-' },
            { title: '加入时间', dataIndex: 'joinedAt', width: 190, render: formatDate },
          ]}
        />
      </Card>
    </Space>
  );
}
