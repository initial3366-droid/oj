import { Button, Card, Form, Input, Message, Modal, Popconfirm, Select, Space, Table, Tag } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { useCallback, useEffect, useState } from 'react';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';

const FormItem = Form.Item;

interface Major {
  id: number;
  code: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  teacherCount: number;
}

interface MajorForm {
  code: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
}

export function AdminMajorManagementPage() {
  const [rows, setRows] = useState<Major[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<Major | null>(null);
  const [form] = Form.useForm<MajorForm>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      setRows(await adminGet<Major[]>(`/api/admin/v1/majors?${params.toString()}`));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '专业列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => { load(); }, [load]);

  function open(item?: Major) {
    setEditing(item ?? null);
    form.setFieldsValue(item ? { code: item.code, name: item.name, status: item.status } : { code: '', name: '', status: 'ACTIVE' });
    setVisible(true);
  }

  async function submit(values: MajorForm) {
    try {
      if (editing) await adminPut(`/api/admin/v1/majors/${editing.id}`, values);
      else await adminPost('/api/admin/v1/majors', values);
      Message.success(editing ? '专业已更新' : '专业已创建');
      setVisible(false);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function remove(id: number) {
    try {
      await adminDelete(`/api/admin/v1/majors/${id}`);
      Message.success('专业已删除');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search style={{ width: 280 }} value={keyword} onChange={setKeyword} placeholder="搜索专业编码或名称" searchButton={<IconSearch />} />
        <Button type="primary" icon={<IconPlus />} onClick={() => open()}>新增专业</Button>
      </Space>
      <Table rowKey="id" loading={loading} data={rows} pagination={{ pageSize: 20, showTotal: true }} columns={[
        { title: '编码', dataIndex: 'code', width: 160 },
        { title: '专业名称', dataIndex: 'name' },
        { title: '教师数', dataIndex: 'teacherCount', width: 100 },
        { title: '状态', dataIndex: 'status', width: 100, render: (value: Major['status']) => <Tag color={value === 'ACTIVE' ? 'green' : 'gray'}>{value === 'ACTIVE' ? '启用' : '停用'}</Tag> },
        { title: '操作', width: 180, render: (_: unknown, item: Major) => <Space>
          <Button size="mini" icon={<IconEdit />} onClick={() => open(item)}>编辑</Button>
          <Popconfirm title="确认删除该专业？" onOk={() => remove(item.id)}><Button size="mini" status="danger" icon={<IconDelete />}>删除</Button></Popconfirm>
        </Space> },
      ]} />
      <Modal title={editing ? '编辑专业' : '新增专业'} visible={visible} onCancel={() => setVisible(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" requiredSymbol={false} onSubmit={submit}>
          <FormItem label="专业编码" field="code" rules={[{ required: true, message: '请输入专业编码' }]}><Input maxLength={64} /></FormItem>
          <FormItem label="专业名称" field="name" rules={[{ required: true, message: '请输入专业名称' }]}><Input maxLength={120} /></FormItem>
          <FormItem label="状态" field="status"><Select><Select.Option value="ACTIVE">启用</Select.Option><Select.Option value="DISABLED">停用</Select.Option></Select></FormItem>
        </Form>
      </Modal>
    </Card>
  );
}
