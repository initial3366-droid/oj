/**
 * 管理员教师Management页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Button, Card, Form, Input, Message, Modal, Popconfirm, Select, Space, Table, Tag } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { useCallback, useEffect, useState } from 'react';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';

const FormItem = Form.Item;

/**
 * 教师接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface Teacher {
  id: number;
  username: string;
  displayName: string;
  teacherNo?: string | null;
  email?: string | null;
  majorId?: number | null;
  majorName?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  classCount: number;
  createdAt: string;
}

/**
 * 教师FormData接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherFormData {
  username: string;
  password?: string;
  displayName: string;
  teacherNo?: string;
  email?: string;
  majorId: number;
  status?: 'ACTIVE' | 'DISABLED';
}

interface Major {
  id: number;
  code: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
}

/**
 * 渲染管理员教师Management页面，并协调其数据加载、状态和交互。
 */
export function AdminTeacherManagementPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form] = Form.useForm<TeacherFormData>();

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      setTeachers(await adminGet<Teacher[]>(`/api/admin/v1/teachers?${params.toString()}`));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '教师列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminGet<Major[]>('/api/admin/v1/majors?activeOnly=false').then(setMajors).catch(() => setMajors([]));
  }, []);

  /**
   * 封装openCreate相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  }

  /**
   * 封装openEdit相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openEdit(teacher: Teacher) {
    setEditing(teacher);
    form.setFieldsValue({
      username: teacher.username,
      displayName: teacher.displayName,
      teacherNo: teacher.teacherNo || '',
      email: teacher.email || '',
      majorId: teacher.majorId ?? undefined,
      status: teacher.status,
      password: '',
    });
    setModalVisible(true);
  }

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function submit(values: TeacherFormData) {
    try {
      const payload = {
        ...values,
        password: values.password?.trim() || undefined,
        teacherNo: values.teacherNo?.trim() || undefined,
        email: values.email?.trim() || undefined,
      };
      if (editing) {
        await adminPut(`/api/admin/v1/teachers/${editing.id}`, payload);
        Message.success('教师已更新');
      } else {
        await adminPost('/api/admin/v1/teachers', payload);
        Message.success('教师已创建');
      }
      setModalVisible(false);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  /**
   * 删除目标数据。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
   */
  async function remove(id: number) {
    try {
      await adminDelete(`/api/admin/v1/teachers/${id}`);
      Message.success('教师已删除');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Input
          style={{ width: 280 }}
          placeholder="搜索教师账号、姓名、编号"
          value={searchInput}
          onChange={setSearchInput}
          onPressEnter={() => setKeyword(searchInput)}
          prefix={<IconSearch />}
        />
        <Button icon={<IconSearch />} onClick={() => setKeyword(searchInput)}>
          搜索
        </Button>
        <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
          新增教师
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        data={teachers}
        pagination={{ pageSize: 20, sizeCanChange: true, showTotal: true }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 90 },
          { title: '用户名', dataIndex: 'username', width: 160 },
          { title: '姓名', dataIndex: 'displayName', width: 160 },
          { title: '教师编号', dataIndex: 'teacherNo', width: 140, render: (value) => value || '-' },
          { title: '专业', dataIndex: 'majorName', width: 150, render: (value) => value || '未分配' },
          {
            title: '状态', dataIndex: 'status', width: 90,
            render: (value: Teacher['status']) => <Tag color={value === 'ACTIVE' ? 'green' : 'gray'}>{value === 'ACTIVE' ? '启用' : '停用'}</Tag>,
          },
          { title: '邮箱', dataIndex: 'email', width: 220, render: (value) => value || '-' },
          { title: '班级数', dataIndex: 'classCount', width: 110 },
          {
            title: '操作',
            width: 170,
            fixed: 'right' as const,
            render: (_: unknown, record: Teacher) => (
              <Space>
                <Button size="mini" icon={<IconEdit />} onClick={() => openEdit(record)}>
                  编辑
                </Button>
                <Popconfirm title="确认删除该教师？" onOk={() => remove(record.id)}>
                  <Button size="mini" status="danger" icon={<IconDelete />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? '编辑教师' : '新增教师'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        style={{ width: 560 }}
      >
        <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} onSubmit={submit}>
          <FormItem label="用户名" field="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="教师登录用户名" />
          </FormItem>
          <FormItem
            label="密码"
            field="password"
            rules={editing ? [] : [{ required: true, message: '请输入初始密码' }]}
          >
            <Input.Password placeholder={editing ? '不修改请留空' : '初始密码'} />
          </FormItem>
          <FormItem label="姓名" field="displayName" rules={[{ required: true, message: '请输入教师姓名' }]}>
            <Input placeholder="教师姓名" />
          </FormItem>
          <FormItem label="教师编号" field="teacherNo">
            <Input placeholder="可选" />
          </FormItem>
          <FormItem label="专业" field="majorId" rules={[{ required: true, message: '请选择专业' }]}>
            <Select placeholder="选择专业">
              {majors.filter((item) => item.status === 'ACTIVE' || item.id === editing?.majorId).map((item) => (
                <Select.Option key={item.id} value={item.id}>{item.name}（{item.code}）</Select.Option>
              ))}
            </Select>
          </FormItem>
          {editing && (
            <FormItem label="状态" field="status">
              <Select>
                <Select.Option value="ACTIVE">启用</Select.Option>
                <Select.Option value="DISABLED">停用</Select.Option>
              </Select>
            </FormItem>
          )}
          <FormItem label="邮箱" field="email">
            <Input placeholder="可选" />
          </FormItem>
        </Form>
      </Modal>
    </Card>
  );
}
