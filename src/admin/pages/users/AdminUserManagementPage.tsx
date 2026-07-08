import { adminPath } from '../../../utils/adminPath';
import { useState, useEffect, useRef } from 'react';
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
  Avatar,
} from '@arco-design/web-react';
import { IconPlus, IconSearch, IconEdit, IconDelete, IconRefresh, IconEye } from '@arco-design/web-react/icon';
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
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

interface PageResult<T> {
  list: T[];
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

interface AdminSubmission {
  id: number;
  userId: number;
  problemId: number | null;
  problemTitle: string | null;
  contestId?: number | null;
  contestTitle?: string | null;
  practiceId?: number | null;
  practiceTitle?: string | null;
  language: string | null;
  status: string | null;
  score: number | null;
  timeUsed: number | null;
  memoryUsed: number | null;
  submitTime: string | null;
  createdAt: string | null;
}

const ACTIVE_USER_ROLES = new Set(['STUDENT', 'GUEST']);
const DETAIL_SUBMISSION_PAGE_SIZE = 10;

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function dash(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function roleText(role?: string | null) {
  const map: Record<string, string> = {
    SUPER_ADMIN: '系统管理员',
    TEACHER: '教师',
    STUDENT: '学生',
    GUEST: '访客',
  };
  return role ? (map[role] || role) : '-';
}

function statusColor(status?: string | null) {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
  if (['PENDING', 'WAITING', 'JUDGING', 'COMPILING', 'RUNNING', 'REJUDGE_PENDING'].includes(normalized)) return 'blue';
  if (normalized === 'TLE' || normalized === 'MLE') return 'orange';
  if (normalized === 'SE' || normalized === 'FAILED') return 'gray';
  return 'red';
}


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
  const [uploadingAvatarId, setUploadingAvatarId] = useState<number | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [detailSubmissions, setDetailSubmissions] = useState<AdminSubmission[]>([]);
  const [detailSubmissionTotal, setDetailSubmissionTotal] = useState(0);
  const [detailSubmissionPage, setDetailSubmissionPage] = useState(1);
  const [detailSubmissionLoading, setDetailSubmissionLoading] = useState(false);

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

      const result = await adminGet<PageResult<User>>(`/api/admin/v1/users?${params.toString()}`);
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


  async function handleAvatarUpload(userId: number, file: File) {
    if (!file.type.startsWith('image/')) {
      Message.error('请选择图片文件');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setUploadingAvatarId(userId);
    try {
      const result = await adminPost<{ avatarUrl: string }>(`/api/admin/v1/users/${userId}/avatar`, formData);
      setUsers((items) => items.map((item) => item.id === userId ? { ...item, avatarUrl: result.avatarUrl } : item));
      setEditingUser((user) => user && user.id === userId ? { ...user, avatarUrl: result.avatarUrl } : user);
      setViewingUser((user) => user && user.id === userId ? { ...user, avatarUrl: result.avatarUrl } : user);
      Message.success('头像已更新');
      loadUsers();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setUploadingAvatarId(null);
    }
  }

  async function loadUserDetail(userId: number) {
    setDetailLoading(true);
    try {
      setViewingUser(await adminGet<User>(`/api/admin/v1/users/${userId}`));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '用户详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadUserSubmissions(userId: number, nextPage = detailSubmissionPage) {
    setDetailSubmissionLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(DETAIL_SUBMISSION_PAGE_SIZE),
        userId: String(userId),
        sortBy: 'submitTime',
        sortOrder: 'desc',
      });
      const result = await adminGet<PageResult<AdminSubmission>>(`/api/admin/v1/submissions?${params.toString()}`);
      setDetailSubmissions(result.list || []);
      setDetailSubmissionTotal(result.total || 0);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '最近提交记录加载失败');
    } finally {
      setDetailSubmissionLoading(false);
    }
  }

  function handleView(user: User) {
    setViewingUser(user);
    setDetailSubmissions([]);
    setDetailSubmissionTotal(0);
    setDetailSubmissionPage(1);
    setDetailVisible(true);
    loadUserDetail(user.id);
    loadUserSubmissions(user.id, 1);
  }

  function renderUserAvatar(user: Pick<User, 'avatarUrl' | 'displayName' | 'username'>, size = 32) {
    const name = user.displayName || user.username || '用户';
    return (
      <Avatar size={size} style={{ backgroundColor: '#165dff' }}>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : name.charAt(0)}
      </Avatar>
    );
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
      await loadQuotas();
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
      width: 210,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
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
          {editingUser && (
            <FormItem label="头像">
              <Space>
                {renderUserAvatar(editingUser, 56)}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (file) handleAvatarUpload(editingUser.id, file);
                  }}
                />
                <Button
                  loading={uploadingAvatarId === editingUser.id}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  修改头像
                </Button>
              </Space>
            </FormItem>
          )}
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

      <Modal
        title="查看用户"
        visible={detailVisible}
        footer={null}
        onCancel={() => setDetailVisible(false)}
        style={{ width: 1000 }}
      >
        <Card title="个人信息" loading={detailLoading} style={{ marginBottom: 16 }}>
          {viewingUser ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {renderUserAvatar(viewingUser, 72)}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{viewingUser.displayName || '-'}</div>
                  <div style={{ color: 'var(--color-text-3)' }}>@{viewingUser.username}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 24px' }}>
                <div><b>ID：</b>{viewingUser.id}</div>
                <div><b>用户名：</b>{dash(viewingUser.username)}</div>
                <div><b>显示名称：</b>{dash(viewingUser.displayName)}</div>
                <div><b>角色：</b>{roleText(viewingUser.role)}</div>
                <div><b>学号：</b>{dash(viewingUser.studentNo)}</div>
                <div><b>邮箱：</b>{dash(viewingUser.email)}</div>
                <div><b>班级：</b>{dash(viewingUser.className)}</div>
                <div>
                  <b>AI 额度：</b>
                  {quotaMap[viewingUser.id]
                    ? `${quotaMap[viewingUser.id].remaining}/${quotaMap[viewingUser.id].remaining + quotaMap[viewingUser.id].used}`
                    : '-'}
                  <Popconfirm
                    title="确定重置该用户的 AI 额度吗？"
                    onOk={() => handleResetAiQuota(viewingUser.id)}
                  >
                    <Button type="text" size="small" icon={<IconRefresh />} style={{ marginLeft: 8 }}>
                      重置AI额度
                    </Button>
                  </Popconfirm>
                </div>
                <div><b>头像地址：</b>{viewingUser.avatarUrl ? <a href={viewingUser.avatarUrl} target="_blank" rel="noopener noreferrer">查看头像</a> : '-'}</div>
                <div><b>创建时间：</b>{formatDate(viewingUser.createdAt)}</div>
                <div><b>更新时间：</b>{formatDate(viewingUser.updatedAt)}</div>
              </div>
            </div>
          ) : null}
        </Card>

        <Card title="最近提交记录">
          <Table
            rowKey="id"
            loading={detailSubmissionLoading}
            data={detailSubmissions}
            pagination={{
              total: detailSubmissionTotal,
              current: detailSubmissionPage,
              pageSize: DETAIL_SUBMISSION_PAGE_SIZE,
              onChange: (nextPage) => {
                setDetailSubmissionPage(nextPage);
                if (viewingUser) loadUserSubmissions(viewingUser.id, nextPage);
              },
              showTotal: true,
            }}
            columns={[
              { title: '提交ID', dataIndex: 'id', width: 90, align: 'center' },
              { title: '题目', dataIndex: 'problemTitle', render: (value) => dash(value) },
              { title: '语言', dataIndex: 'language', width: 100, align: 'center', render: (value) => dash(value) },
              {
                title: '状态',
                dataIndex: 'status',
                width: 110,
                align: 'center',
                render: (value) => value ? <Tag color={statusColor(value)}>{value}</Tag> : '-',
              },
              { title: '分数', dataIndex: 'score', width: 90, align: 'center', render: (value) => dash(value) },
              { title: '时间', dataIndex: 'timeUsed', width: 100, align: 'center', render: (value) => value == null ? '-' : `${value} ms` },
              { title: '内存', dataIndex: 'memoryUsed', width: 110, align: 'center', render: (value) => value == null ? '-' : `${value} KB` },
              { title: '提交时间', dataIndex: 'submitTime', width: 180, render: (value) => formatDate(value) },
            ]}
          />
        </Card>
      </Modal>
    </Card>
  );
}
