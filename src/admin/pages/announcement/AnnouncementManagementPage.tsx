import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Message,
  Tag,
  Popconfirm,
  TableColumnProps,
} from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete, IconRefresh } from '@arco-design/web-react/icon';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import {
  fetchAnnouncementList,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
  type AnnouncementCreateRequest,
  type AnnouncementUpdateRequest,
} from '../../api/announcement';

const FormItem = Form.Item;
const Textarea = Input.TextArea;

export function AnnouncementManagementPage() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<Announcement | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [form] = Form.useForm<AnnouncementCreateRequest | AnnouncementUpdateRequest>();

  // 加载列表数据
  const loadData = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const result = await fetchAnnouncementList(page, size);
      setDataSource(result.list);
      setTotal(result.total);
      setCurrentPage(page);
    } catch (error) {
      console.error('加载公告列表失败:', error);
      Message.error(error instanceof Error ? error.message : '加载公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 打开新增弹窗
  const handleCreate = () => {
    setModalType('create');
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ isVisible: true }); // 默认可见
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Announcement) => {
    setModalType('edit');
    setEditingRecord(record);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      isVisible: record.isVisible,
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setSubmitLoading(true);

      if (modalType === 'create') {
        await createAnnouncement(values as AnnouncementCreateRequest);
        Message.success('创建公告成功');
        loadData(1); // 重新加载第一页
      } else if (editingRecord) {
        await updateAnnouncement(editingRecord.id, values as AnnouncementUpdateRequest);
        Message.success('更新公告成功');
        loadData(); // 刷新当前页
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  // 删除公告
  const handleDelete = async (id: number) => {
    try {
      await deleteAnnouncement(id);
      Message.success('删除公告成功');

      // 如果当前页只有一条数据且不是第一页，则返回上一页
      if (dataSource.length === 1 && currentPage > 1) {
        loadData(currentPage - 1);
      } else {
        loadData();
      }
    } catch (error) {
      console.error('删除公告失败:', error);
      Message.error(error instanceof Error ? error.message : '删除公告失败');
    }
  };

  // 定义表格列
  const columns: TableColumnProps[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      width: 250,
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      render: (content: string) => (
        <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {content}
        </div>
      ),
    },
    {
      title: '发布者',
      dataIndex: 'authorName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'isVisible',
      width: 100,
      render: (isVisible: boolean) => (
        <Tag color={isVisible ? 'green' : 'gray'}>
          {isVisible ? '显示' : '隐藏'}
        </Tag>
      ),
    },
    {
      title: '浏览次数',
      dataIndex: 'viewCount',
      width: 100,
      sorter: (a: Announcement, b: Announcement) => a.viewCount - b.viewCount,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Announcement) => (
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
            title="确认删除"
            content="删除后将无法恢复，确定要删除这条公告吗？"
            onOk={() => handleDelete(record.id)}
            okButtonProps={{ status: 'danger' }}
          >
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminPageContainer
      title="公告管理"
      extra={
        <Space>
          <Button icon={<IconRefresh />} onClick={() => loadData()}>
            刷新
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新增公告
          </Button>
        </Space>
      }
    >
      <Table
        loading={loading}
        columns={columns}
        data={dataSource}
        rowKey="id"
        pagination={{
          total,
          current: currentPage,
          pageSize,
          showTotal: true,
          showJumper: true,
          sizeCanChange: true,
          onChange: (page, size) => {
            setPageSize(size);
            loadData(page, size);
          },
        }}
        border={{
          wrapper: true,
          cell: true,
        }}
        noDataElement={
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#86909c' }}>
            暂无数据
          </div>
        }
      />

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalType === 'create' ? '新增公告' : '编辑公告'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={submitLoading}
        style={{ width: 600 }}
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
        >
          <FormItem
            label="公告标题"
            field="title"
            rules={[
              { required: true, message: '请输入公告标题' },
              { maxLength: 100, message: '标题长度不能超过100个字符' },
            ]}
          >
            <Input placeholder="请输入公告标题" />
          </FormItem>

          <FormItem
            label="公告内容"
            field="content"
            rules={[
              { required: true, message: '请输入公告内容' },
              { maxLength: 5000, message: '内容长度不能超过5000个字符' },
            ]}
          >
            <Textarea
              placeholder="请输入公告内容"
              autoSize={{ minRows: 6, maxRows: 12 }}
            />
          </FormItem>

          <FormItem
            label="是否可见"
            field="isVisible"
            triggerPropName="checked"
            initialValue={true}
          >
            <Switch />
          </FormItem>
        </Form>
      </Modal>
    </AdminPageContainer>
  );
}
