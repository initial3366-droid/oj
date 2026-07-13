import { useState, useEffect } from 'react';
import {
  Button,
  Card,
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
  fetchPinnedAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
  type AnnouncementCreateRequest,
  type AnnouncementUpdateRequest,
} from '../../api/announcement';
import { sanitizeAnnouncementHtml, stripHtmlForPreview } from '../../../utils/html';

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
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<Announcement | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [pinnedModalVisible, setPinnedModalVisible] = useState(false);
  const [pinnedSubmitLoading, setPinnedSubmitLoading] = useState(false);

  const [form] = Form.useForm<AnnouncementCreateRequest | AnnouncementUpdateRequest>();
  const [pinnedForm] = Form.useForm<AnnouncementCreateRequest | AnnouncementUpdateRequest>();

  // 加载普通公告列表数据
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

  const loadPinnedData = async () => {
    setPinnedLoading(true);
    try {
      const result = await fetchPinnedAnnouncement();
      setPinnedAnnouncement(result);
    } catch (error) {
      console.error('加载置顶公告失败:', error);
      Message.error(error instanceof Error ? error.message : '加载置顶公告失败');
    } finally {
      setPinnedLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadPinnedData();
  }, []);

  // 打开新增普通公告弹窗
  const handleCreate = () => {
    setModalType('create');
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ isVisible: true });
    setModalVisible(true);
  };

  // 打开编辑普通公告弹窗
  const handleEdit = (record: Announcement) => {
    setModalType('edit');
    setEditingRecord(record);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      isVisible: record.isVisible,
      isPinned: false,
    });
    setModalVisible(true);
  };

  // 提交普通公告表单
  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setSubmitLoading(true);
      const payload = { ...values, isPinned: false };

      if (modalType === 'create') {
        await createAnnouncement(payload as AnnouncementCreateRequest);
        Message.success('创建公告成功');
        loadData(1);
      } else if (editingRecord) {
        await updateAnnouncement(editingRecord.id, payload as AnnouncementUpdateRequest);
        Message.success('更新公告成功');
        loadData();
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

  const handlePinnedEdit = () => {
    pinnedForm.resetFields();
    pinnedForm.setFieldsValue({
      title: pinnedAnnouncement?.title || '',
      content: pinnedAnnouncement?.content || '',
      isVisible: pinnedAnnouncement?.isVisible ?? true,
      isPinned: true,
    });
    setPinnedModalVisible(true);
  };

  const handlePinnedSubmit = async () => {
    try {
      const values = await pinnedForm.validate();
      setPinnedSubmitLoading(true);
      const payload = {
        title: values.title,
        content: values.content,
        isVisible: values.isVisible ?? true,
        isPinned: true,
      };

      if (pinnedAnnouncement) {
        await updateAnnouncement(pinnedAnnouncement.id, payload);
        Message.success('置顶公告更新成功');
      } else {
        await createAnnouncement(payload as AnnouncementCreateRequest);
        Message.success('置顶公告创建成功');
      }

      setPinnedModalVisible(false);
      pinnedForm.resetFields();
      await Promise.all([loadPinnedData(), loadData()]);
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setPinnedSubmitLoading(false);
    }
  };

  const handlePinnedVisibilityToggle = async () => {
    if (!pinnedAnnouncement) {
      return;
    }
    try {
      await updateAnnouncement(pinnedAnnouncement.id, {
        isVisible: !pinnedAnnouncement.isVisible,
        isPinned: true,
      });
      Message.success(pinnedAnnouncement.isVisible ? '置顶公告已隐藏' : '置顶公告已显示');
      await Promise.all([loadPinnedData(), loadData()]);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '更新置顶公告失败');
    }
  };

  const handlePinnedDelete = async () => {
    if (!pinnedAnnouncement) {
      return;
    }
    try {
      await deleteAnnouncement(pinnedAnnouncement.id);
      Message.success('置顶公告已删除');
      await Promise.all([loadPinnedData(), loadData()]);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除置顶公告失败');
    }
  };

  // 删除普通公告
  const handleDelete = async (id: number) => {
    try {
      await deleteAnnouncement(id);
      Message.success('删除公告成功');

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

  // 定义普通公告表格列
  const columns: TableColumnProps[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 54,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      width: 160,
      render: (title: string) => (
        <span className="admin-announcement-one-line" title={stripHtmlForPreview(title)}>
          {stripHtmlForPreview(title)}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'isPinned',
      width: 72,
      render: (isPinned: boolean) => (
        <Tag color={isPinned ? 'orange' : 'gray'} size="small">
          {isPinned ? '置顶' : '普通'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isVisible',
      width: 72,
      render: (isVisible: boolean) => (
        <Tag color={isVisible ? 'green' : 'gray'} size="small">
          {isVisible ? '显示' : '隐藏'}
        </Tag>
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      width: 170,
      render: (content: string) => (
        <div className="admin-announcement-content-preview" title={stripHtmlForPreview(content)}>
          {stripHtmlForPreview(content)}
        </div>
      ),
    },
    {
      title: '发布者',
      dataIndex: 'authorName',
      width: 92,
      render: (authorName: string) => (
        <span className="admin-announcement-one-line" title={authorName}>
          {authorName || '-'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 138,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 112,
      render: (_: any, record: Announcement) => (
        <Space size={4} wrap={false} className="admin-announcement-actions">
          <Button
            type="text"
            size="mini"
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
              size="mini"
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
    <>
      <style>{`
        .admin-pinned-card {
          margin-bottom: 16px;
        }

        .admin-pinned-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .admin-pinned-title-preview {
          display: block;
          min-width: 0;
          max-width: 520px;
          height: 30px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 30px;
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-1);
        }

        .admin-pinned-title-preview * {
          display: inline !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 30px !important;
          font-size: inherit !important;
          max-height: 30px !important;
        }

        .admin-pinned-card-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
          padding-left: 12px;
          padding-right: 8px;
          white-space: nowrap;
        }

        .admin-announcement-table {
          width: 100%;
          min-width: 0;
        }

        .admin-announcement-table .arco-table,
        .admin-announcement-table .arco-table-container,
        .admin-announcement-table .arco-table-content,
        .admin-announcement-table .arco-table-body {
          width: 100% !important;
          min-width: 0 !important;
          overflow-x: hidden !important;
        }

        .admin-announcement-table table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
        }

        .admin-announcement-table .arco-table-th,
        .admin-announcement-table .arco-table-td {
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        .admin-announcement-one-line {
          display: block;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-announcement-content-preview {
          display: block;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--color-text-2);
          line-height: 1.55;
        }

        .admin-announcement-actions {
          white-space: nowrap;
        }

        @media (max-width: 1200px) {
          .admin-announcement-table .arco-table-th,
          .admin-announcement-table .arco-table-td {
            padding-left: 6px !important;
            padding-right: 6px !important;
          }
        }
      `}</style>

      <Card
        className="admin-pinned-card"
        title="置顶公告"
        bordered={false}
        loading={pinnedLoading}
        extra={
          <div className="admin-pinned-card-actions">
            <Button type="primary" size="small" icon={pinnedAnnouncement ? <IconEdit /> : <IconPlus />} onClick={handlePinnedEdit}>
              {pinnedAnnouncement ? '编辑置顶' : '新建置顶'}
            </Button>
            {pinnedAnnouncement && (
              <>
                <Button size="small" onClick={handlePinnedVisibilityToggle}>
                  {pinnedAnnouncement.isVisible ? '隐藏' : '显示'}
                </Button>
                <Popconfirm
                  title="确认删除"
                  content="删除后首页将不再显示置顶公告，确定删除吗？"
                  onOk={handlePinnedDelete}
                  okButtonProps={{ status: 'danger' }}
                >
                  <Button size="small" status="danger" icon={<IconDelete />}>
                    删除
                  </Button>
                </Popconfirm>
              </>
            )}
          </div>
        }
      >
        {pinnedAnnouncement ? (
          <div className="admin-pinned-title-row">
            <Tag color={pinnedAnnouncement.isVisible ? 'green' : 'gray'}>
              {pinnedAnnouncement.isVisible ? '前台显示' : '已隐藏'}
            </Tag>
            <div
              className="admin-pinned-title-preview"
              title={stripHtmlForPreview(pinnedAnnouncement.title)}
              dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(pinnedAnnouncement.title) }}
            />
          </div>
        ) : (
          <div style={{ color: '#86909c' }}>
            暂无置顶公告。点击「新建置顶」添加首页导航栏下方的置顶标题卡片。
          </div>
        )}
      </Card>

      <AdminPageContainer
        title="普通公告管理"
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
          className="admin-announcement-table"
          loading={loading}
          columns={columns}
          data={dataSource}
          rowKey="id"
          tableLayoutFixed
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

        {/* 新增/编辑普通公告弹窗 */}
        <Modal
          title={modalType === 'create' ? '新增公告' : '编辑公告'}
          visible={modalVisible}
          onOk={handleSubmit}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          confirmLoading={submitLoading}
          style={{ width: 720 }}
        >
          <Form
            form={form}
            layout="vertical"
            autoComplete="off"
          >
            <FormItem
              label="公告标题（支持 HTML）"
              field="title"
              rules={[
                { required: true, message: '请输入公告标题' },
                { maxLength: 200, message: '标题长度不能超过200个字符' },
              ]}
            >
              <Input placeholder="请输入公告标题，可填写 HTML，例如：<strong>重要</strong>" />
            </FormItem>

            <FormItem
              label="公告内容（支持 HTML）"
              field="content"
              rules={[
                { required: true, message: '请输入公告内容' },
                { maxLength: 5000, message: '内容长度不能超过5000个字符' },
              ]}
            >
              <Textarea
                placeholder="请输入公告内容，可填写 HTML，例如：<strong>重要通知</strong>"
                autoSize={{ minRows: 8, maxRows: 16 }}
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

        {/* 置顶公告弹窗 */}
        <Modal
          title={pinnedAnnouncement ? '编辑置顶公告' : '新建置顶公告'}
          visible={pinnedModalVisible}
          onOk={handlePinnedSubmit}
          onCancel={() => {
            setPinnedModalVisible(false);
            pinnedForm.resetFields();
          }}
          confirmLoading={pinnedSubmitLoading}
          style={{ width: 720 }}
        >
          <Form
            form={pinnedForm}
            layout="vertical"
            autoComplete="off"
          >
            <FormItem
              label="置顶标题（支持 HTML）"
              field="title"
              rules={[
                { required: true, message: '请输入置顶标题' },
                { maxLength: 200, message: '标题长度不能超过200个字符' },
              ]}
              extra="前台卡片内只显示标题，超出会自动省略。"
            >
              <Input placeholder="例如：<div align='center'><red>重要通知</red></div>" />
            </FormItem>

            <FormItem
              label="公告详情（支持 HTML）"
              field="content"
              rules={[
                { required: true, message: '请输入公告详情' },
                { maxLength: 5000, message: '内容长度不能超过5000个字符' },
              ]}
            >
              <Textarea
                placeholder="点击前台置顶标题后，会在弹窗中显示这里的详细内容。"
                autoSize={{ minRows: 8, maxRows: 16 }}
              />
            </FormItem>

            <FormItem
              label="前台显示"
              field="isVisible"
              triggerPropName="checked"
              initialValue={true}
              extra="关闭后保留置顶公告，但首页不展示。"
            >
              <Switch />
            </FormItem>
          </Form>
        </Modal>
      </AdminPageContainer>
    </>
  );
}
