/**
 * 公告Management页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
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
  Tabs,
  Message,
  Tag,
  Popconfirm,
  TableColumnProps,
} from '@arco-design/web-react';
import { IconPlus, IconEdit, IconRefresh } from '@arco-design/web-react/icon';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import { AnnouncementContent, announcementPlainText } from '../../../components/AnnouncementContent';
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

const FormItem = Form.Item;
const Textarea = Input.TextArea;
const TabPane = Tabs.TabPane;

/**
 * 渲染公告Management页面，并协调其数据加载、状态和交互。
 */
export function AnnouncementManagementPage() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<Announcement[]>([]);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<Announcement | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<Announcement | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [editorKind, setEditorKind] = useState<'ordinary' | 'pinned'>('ordinary');

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

  /**
   * 读取Pinned并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const loadPinned = async () => {
    try {
      setPinnedAnnouncement(await fetchPinnedAnnouncement());
    } catch (error) {
      console.error('加载置顶公告失败:', error);
      Message.error(error instanceof Error ? error.message : '加载置顶公告失败');
    }
  };

  useEffect(() => {
    loadData();
    loadPinned();
  }, []);

  // 打开新增弹窗
  const handleCreate = () => {
    setEditorKind('ordinary');
    setModalType('create');
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ isVisible: true, isPinned: false });
    setPreviewContent('');
    setPreviewTitle('');
    setModalVisible(true);
  };

  /**
   * 处理PinnedEdit。会更新 React 状态并触发重新渲染。
   */
  const handlePinnedEdit = () => {
    setEditorKind('pinned');
    setModalType(pinnedAnnouncement ? 'edit' : 'create');
    setEditingRecord(pinnedAnnouncement);
    form.resetFields();
    form.setFieldsValue({
      title: pinnedAnnouncement?.title ?? '',
      content: pinnedAnnouncement?.content ?? '',
      isVisible: pinnedAnnouncement?.isVisible ?? true,
      isPinned: true,
    });
    setPreviewTitle(pinnedAnnouncement?.title ?? '');
    setPreviewContent(pinnedAnnouncement?.content ?? '');
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Announcement) => {
    setEditorKind('ordinary');
    setModalType('edit');
    setEditingRecord(record);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      isVisible: record.isVisible,
      isPinned: record.isPinned,
    });
    setPreviewContent(record.content);
    setPreviewTitle(record.title);
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setSubmitLoading(true);
      const payload = { ...values, isPinned: editorKind === 'pinned' };

      if (modalType === 'create') {
        await createAnnouncement(payload as AnnouncementCreateRequest);
        Message.success('创建公告成功');
        await Promise.all([loadData(1), loadPinned()]);
      } else if (editingRecord) {
        await updateAnnouncement(editingRecord.id, payload as AnnouncementUpdateRequest);
        Message.success('更新公告成功');
        await Promise.all([loadData(), loadPinned()]);
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

  /**
   * 处理Unpin。包含异步流程并由调用方处理完成或失败状态。
   */
  const handleUnpin = async () => {
    if (!pinnedAnnouncement) return;
    try {
      await updateAnnouncement(pinnedAnnouncement.id, { isPinned: false });
      Message.success('已取消置顶，公告已移入普通公告列表');
      await Promise.all([loadPinned(), loadData(1)]);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '取消置顶失败');
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
      width: '6%',
      align: 'center',
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      width: '24%',
      render: (title: string) => (
        <AnnouncementContent content={title} className="admin-announcement-table-title" />
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      width: '26%',
      render: (content: string) => (
        <div style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {announcementPlainText(content)}
        </div>
      ),
    },
    {
      title: '添加者',
      dataIndex: 'authorName',
      width: '10%',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'isVisible',
      width: '8%',
      align: 'center',
      render: (isVisible: boolean) => (
        <Tag color={isVisible ? 'green' : 'gray'}>
          {isVisible ? '显示' : '隐藏'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: '14%',
      render: (time: string, record: Announcement) =>
        new Date(time || record.createdAt).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: '12%',
      align: 'center',
      render: (_: any, record: Announcement) => (
        <Space size="mini">
          <Button
            type="text"
            size="small"
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
          <Button icon={<IconRefresh />} onClick={() => void Promise.all([loadData(), loadPinned()])}>
            刷新
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新增公告
          </Button>
        </Space>
      }
    >
      <Card
        title="置顶公告"
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            {pinnedAnnouncement ? (
              <Popconfirm
                title="取消置顶"
                content="取消后，这条公告会回到普通公告列表。"
                onOk={handleUnpin}
              >
                <Button type="text">取消置顶</Button>
              </Popconfirm>
            ) : null}
            <Button type="primary" icon={<IconEdit />} onClick={handlePinnedEdit}>
              {pinnedAnnouncement ? '编辑置顶公告' : '设置置顶公告'}
            </Button>
          </Space>
        }
      >
        {pinnedAnnouncement ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <AnnouncementContent content={pinnedAnnouncement.title} className="admin-pinned-title" />
            <div style={{ color: 'var(--color-text-3)', fontSize: 13 }}>
              添加者：{pinnedAnnouncement.authorName} · 更新时间：
              {new Date(pinnedAnnouncement.updatedAt || pinnedAnnouncement.createdAt).toLocaleString('zh-CN')}
            </div>
            <Space>
              <Tag color={pinnedAnnouncement.isVisible ? 'green' : 'gray'}>
                {pinnedAnnouncement.isVisible ? '前台显示' : '前台隐藏'}
              </Tag>
              <span style={{ color: 'var(--color-text-2)' }}>
                {announcementPlainText(pinnedAnnouncement.content)}
              </span>
            </Space>
          </div>
        ) : (
          <div style={{ padding: '12px 0', color: 'var(--color-text-3)' }}>当前未设置置顶公告</div>
        )}
      </Card>

      <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>普通公告</div>
      <div className="admin-announcement-table-shell">
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
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#86909c' }}>
              暂无普通公告
            </div>
          }
        />
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editorKind === 'pinned'
          ? (modalType === 'create' ? '设置置顶公告' : '编辑置顶公告')
          : (modalType === 'create' ? '新增普通公告' : '编辑普通公告')}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={submitLoading}
        style={{ width: 900, maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          onValuesChange={(changedValues) => {
            if (typeof changedValues.title === 'string') {
              setPreviewTitle(changedValues.title);
            }
            if (typeof changedValues.content === 'string') {
              setPreviewContent(changedValues.content);
            }
          }}
        >
          <FormItem
            label="公告标题"
            field="title"
            rules={[
              { required: true, message: '请输入公告标题' },
              { maxLength: 200, message: '标题长度不能超过200个字符' },
            ]}
          >
            <Input placeholder={'支持安全 HTML，例如：<strong style="color:#165dff">公告标题</strong>'} />
          </FormItem>

          <Tabs defaultActiveTab="edit" type="line" style={{ marginBottom: 20 }}>
            <TabPane key="edit" title="HTML 编辑">
              <FormItem
                label="公告内容"
                field="content"
                rules={[
                  { required: true, message: '请输入公告内容' },
                  { maxLength: 5000, message: '内容长度不能超过5000个字符' },
                ]}
              >
                <Textarea
                  placeholder={'支持安全 HTML，例如：<div align="center" style="color:red">公告内容</div>'}
                  autoSize={{ minRows: 10, maxRows: 18 }}
                  style={{ fontFamily: 'SFMono-Regular, Consolas, monospace' }}
                />
              </FormItem>
            </TabPane>
            <TabPane key="preview" title="效果预览">
              <div
                style={{
                  minHeight: 240,
                  maxHeight: 480,
                  overflowY: 'auto',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 6,
                  background: 'var(--color-bg-1)',
                  padding: 20,
                }}
              >
                <AnnouncementContent content={previewTitle} emptyText="请输入公告标题" className="admin-announcement-preview-title" />
                <AnnouncementContent content={previewContent} emptyText="输入 HTML 后可在这里查看前台效果" />
              </div>
            </TabPane>
          </Tabs>

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
      <style>{`
        .admin-pinned-title,
        .admin-announcement-preview-title {
          font-size: 16px;
          font-weight: 600;
          line-height: 1.5;
        }
        .admin-announcement-table-title {
          overflow: hidden;
          font-size: 14px;
          line-height: 22px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .admin-announcement-table-title > * {
          display: block;
          width: 100%;
          overflow: hidden;
          margin: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .admin-announcement-table-shell {
          width: 100%;
          overflow: hidden;
        }
        .admin-announcement-table-shell .arco-table-body {
          max-height: none !important;
          overflow-x: hidden !important;
          overflow-y: hidden !important;
        }
        .admin-announcement-table-shell .arco-table-content-inner,
        .admin-announcement-table-shell .arco-table-header,
        .admin-announcement-table-shell .arco-table-content-scroll {
          max-width: 100% !important;
          overflow-x: hidden !important;
        }
        .admin-announcement-table-shell table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
        }
        .admin-announcement-table-shell .arco-table-th,
        .admin-announcement-table-shell .arco-table-td {
          vertical-align: middle;
        }
        .admin-announcement-table-shell .arco-table-th-item,
        .admin-announcement-table-shell .arco-table-td {
          padding-left: 12px;
          padding-right: 12px;
        }
        .admin-announcement-table-shell .arco-table-pagination {
          margin-bottom: 0;
        }
        .admin-pinned-title > *,
        .admin-announcement-preview-title > * {
          margin: 0;
        }
        .admin-announcement-preview-title {
          margin-bottom: 18px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--color-border-2);
        }
      `}</style>
    </AdminPageContainer>
  );
}
