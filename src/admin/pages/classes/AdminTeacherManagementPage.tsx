import { Button, Card, Form, Input, Message, Modal, Popconfirm, Space, Table } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { useCallback, useEffect, useState } from 'react';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';

const FormItem = Form.Item;

interface Teacher {
  id: number;
  username: string;
  displayName: string;
  studentNo?: string | null;
  email?: string | null;
  classCount: number;
  createdAt: string;
}

interface TeacherFormData {
  username: string;
  password?: string;
  displayName: string;
  studentNo?: string;
  email?: string;
}

export function AdminTeacherManagementPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form] = Form.useForm<TeacherFormData>();

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

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  }

  function openEdit(teacher: Teacher) {
    setEditing(teacher);
    form.setFieldsValue({
      username: teacher.username,
      displayName: teacher.displayName,
      studentNo: teacher.studentNo || '',
      email: teacher.email || '',
      password: '',
    });
    setModalVisible(true);
  }

  async function submit(values: TeacherFormData) {
    try {
      const payload = {
        ...values,
        password: values.password?.trim() || undefined,
        studentNo: values.studentNo?.trim() || undefined,
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
          placeholder="搜索教师用户名、姓名、学号"
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
          { title: '工号/学号', dataIndex: 'studentNo', width: 160, render: (value) => value || '-' },
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
          <FormItem label="工号/学号" field="studentNo">
            <Input placeholder="可选" />
          </FormItem>
          <FormItem label="邮箱" field="email">
            <Input placeholder="可选" />
          </FormItem>
        </Form>
      </Modal>
    </Card>
  );
}
