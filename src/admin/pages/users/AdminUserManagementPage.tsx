import { adminPath } from '../../../utils/adminPath';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Message,
  Popconfirm,
  Card,
  Tag,
} from '@arco-design/web-react';
import { IconPlus, IconSearch, IconEdit, IconDelete, IconRefresh } from '@arco-design/web-react/icon';
import { adminGet, adminPost, adminPut, adminDelete } from '../../api/adminClient';

const FormItem = Form.Item;
const Option = Select.Option;

interface User {
  id: number;
  username: string;
  displayName: string;
  studentNo: string | null;
  email: string;
  role: string;
  className: string | null;
  createdAt: string;
}

interface PageResult {
  list: User[];
  total: number;
}

interface UserFormData {
  username: string;
  displayName: string;
  studentNo?: string;
  email: string;
  role: string;
  password?: string;
}

const ACTIVE_USER_ROLES = new Set(['STUDENT', 'GUEST']);

function isActiveUser(user: User) {
  return ACTIVE_USER_ROLES.has(user.role);
}

export function AdminUserManagementPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');

  // 根据路由设置角色过滤
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/users/students')) {
      setRoleFilter('STUDENT');
    }
  }, [location.pathname]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm<UserFormData>();

  useEffect(() => {
    loadUsers();
  }, [page, keyword, roleFilter]);

  async function loadUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (keyword) params.append('keyword', keyword);
      if (roleFilter) params.append('role', roleFilter);

      const result = await adminGet<PageResult>(`/api/admin/v1/users?${params.toString()}`);
      const visibleUsers = (result.list || []).filter(isActiveUser);
      setUsers(visibleUsers);
      setTotal(Math.max(visibleUsers.length, result.total - ((result.list || []).length - visibleUsers.length)));
    } catch (error) {
      Message.error('加载用户列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setKeyword(searchInput);
    setPage(1);
  }

  function handleCreate() {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      displayName: user.displayName,
      studentNo: user.studentNo || '',
      email: user.email,
      role: user.role,
    });
    setModalVisible(true);
  }

  async function handleDelete(id: number) {
    try {
      await adminDelete(`/api/admin/v1/users/${id}`);
      Message.success('删除成功');
      loadUsers();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function handleResetAiQuota(userId: number) {
    try {
      await adminPost(`/api/admin/v1/agent/reset/user/${userId}`);
      Message.success('AI 额度已重置');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '重置失败');
    }
  }

  async function handleResetAllAiQuota() {
    try {
      await adminPost('/api/admin/v1/agent/reset/all');
      Message.success('所有用户 AI 额度已重置');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '重置失败');
    }
  }

  async function handleSubmit(values: UserFormData) {
    try {
      if (editingUser) {
        await adminPut(`/api/admin/v1/users/${editingUser.id}`, values);
        Message.success('更新成功');
      } else {
        await adminPost('/api/admin/v1/users', values);
        Message.success('创建成功');
      }
      setModalVisible(false);
      loadUsers();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  const [quotaMap, setQuotaMap] = useState<Record<number, { used: number; remaining: number }>>({});

  useEffect(() => {
    if (users.length > 0) loadQuotas();
  }, [users]);

  async function loadQuotas() {
    const map: Record<number, { used: number; remaining: number }> = {};
    for (const user of users) {
      try {
        const q = await adminGet<{ used: number; remaining: number }>(`/api/admin/v1/agent/quota/${user.id}`);
        map[user.id] = q;
      } catch {
        map[user.id] = { used: 0, remaining: 5 };
      }
    }
    setQuotaMap(map);
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
      align: 'center' as const,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      width: 150,
      align: 'center' as const,
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      width: 120,
      align: 'center' as const,
      render: (value: string | null) => value || '-',
    },
    {
      title: '班级',
      dataIndex: 'className',
      width: 150,
      align: 'center' as const,
      render: (value: string | null) => value || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      align: 'center' as const,
      render: (role: string) => {
        const colorMap: Record<string, string> = {
          SUPER_ADMIN: 'red',
          TEACHER: 'blue',
          STUDENT: 'green',
          GUEST: 'gray',
        };
        return <Tag color={colorMap[role] || 'gray'}>{role}</Tag>;
      },
    },
    {
      title: 'AI 额度',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: User) => {
        const q = quotaMap[record.id];
        if (!q) return '-';
        return <Tag color={q.remaining > 0 ? 'green' : 'red'}>{q.remaining}/{q.remaining + q.used}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      align: 'center' as const,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定重置该用户的 AI 额度吗？"
            onOk={() => handleResetAiQuota(record.id)}
          >
            <Button type="text" size="small" icon={<IconRefresh />}>
              重置AI
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要删除该用户吗？"
            onOk={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: '16px' }}>
        <Space size="medium">
          <Input
            style={{ width: 300 }}
            placeholder="搜索用户名、邮箱或学号"
            value={searchInput}
            onChange={setSearchInput}
            onPressEnter={handleSearch}
            prefix={<IconSearch />}
          />
          <Select
            style={{ width: 150 }}
            placeholder="筛选角色"
            allowClear
            value={roleFilter}
            onChange={(value) => {
              setRoleFilter(value);
              setPage(1);
            }}
            disabled={location.pathname !== adminPath('/users/all')}
          >
            <Option value="STUDENT">学生</Option>
            <Option value="GUEST">访客</Option>
          </Select>
          <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
            搜索
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            添加用户
          </Button>
          <Popconfirm
            title="确定重置所有用户的 AI 额度吗？"
            onOk={handleResetAllAiQuota}
          >
            <Button icon={<IconRefresh />}>
              全部重置AI额度
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Table
        loading={loading}
        columns={columns}
        data={users}
        pagination={{
          total,
          current: page,
          pageSize,
          onChange: setPage,
          showTotal: true,
        }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        style={{ width: 600 }}
      >
        <Form
          form={form}
          onSubmit={handleSubmit}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
        >
          <FormItem
            label="用户名"
            field="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" disabled={!!editingUser} />
          </FormItem>

          <FormItem
            label="显示名称"
            field="displayName"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="显示名称" />
          </FormItem>

          <FormItem label="学号" field="studentNo">
            <Input placeholder="学号（可选）" />
          </FormItem>

          <FormItem
            label="邮箱"
            field="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="邮箱" />
          </FormItem>

          <FormItem
            label="角色"
            field="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="选择角色">
              <Option value="STUDENT">学生</Option>
              <Option value="GUEST">访客</Option>
            </Select>
          </FormItem>

          {!editingUser && (
            <FormItem
              label="密码"
              field="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="密码" />
            </FormItem>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
