import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Divider,
  Typography,
  InputNumber,
  Table,
  Modal,
  Space,
  Popconfirm,
  Tag,
  TableColumnProps,
  Select,
} from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconRefresh, IconSave } from '@arco-design/web-react/icon';
import { adminDelete, adminGet, adminPost, adminPut } from '../../api/adminClient';
import { toast } from '../../utils/toast';

const FormItem = Form.Item;
const { Title, Text, Paragraph } = Typography;
const Option = Select.Option;

type SettingsSection = 'frontend' | 'register' | 'judge' | 'system';

interface AdminSystemSettingsPageProps {
  section: SettingsSection;
}

interface FrontendSettings {
  siteTitle: string;
  siteLogo: string;
  maintenanceMode: boolean;
  footerText: string;
  icpNumber: string;
  footerLink1Text: string;
  footerLink1Url: string;
  footerLink2Text: string;
  footerLink2Url: string;
}

interface JudgeSettings {
  enabled: boolean;
  mode: 'domjudge' | 'docker' | 'unsafe-local';
  contestMode: 'domjudge' | 'docker' | 'unsafe-local';
  enableUnsafeLocalJudge: boolean;
  enableSandbox: boolean;
  maxConcurrent: number;
  threadPoolSize: number;
  queueBatchSize: number;
  pollIntervalMs: number;
  domjudgeBaseUrl: string;
  domjudgeApiKey?: string;
  hasDomjudgeApiKey?: boolean;
  domjudgeContestId: string;
  domjudgePollIntervalMs: number;
}

interface AgentSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxCodeChars: number;
}

interface OssSettings {
  enabled: boolean;
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  accessKeySecret?: string;
  publicBaseUrl: string;
  dir: string;
  maxSizeMb: number;
}

interface EmailConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  useSsl: boolean;
  subject?: string;
  content?: string;
}

interface RegisterSettings {
  enabled: boolean;
  emailVerification?: boolean;
  emailConfig: EmailConfig;
}

interface CarouselSlide {
  id: number;
  title: string;
  imageUrl: string;
  displayOrder: number;
  enabled: boolean;
}

type CarouselSlideForm = Omit<CarouselSlide, 'id'>;

const emptyCarouselSlide: CarouselSlideForm = {
  title: '',
  imageUrl: '',
  displayOrder: 1,
  enabled: true,
};

export function AdminSystemSettingsPage({ section }: AdminSystemSettingsPageProps) {
  const [loading, setLoading] = useState(false);
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [carouselModalVisible, setCarouselModalVisible] = useState(false);
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [carouselSubmitting, setCarouselSubmitting] = useState(false);
  const [registerSaving, setRegisterSaving] = useState(false);
  const [frontendForm] = Form.useForm<FrontendSettings>();
  const [registerForm] = Form.useForm<RegisterSettings>();
  const [judgeForm] = Form.useForm<JudgeSettings>();
  const [agentForm] = Form.useForm<AgentSettings>();
  const [ossForm] = Form.useForm<OssSettings>();
  const [judgeThreadPoolSize, setJudgeThreadPoolSize] = useState(2);
  const [passwordForm] = Form.useForm();
  const [carouselForm] = Form.useForm<CarouselSlideForm>();

  useEffect(() => {
    loadSettings();
  }, [section]);

  async function loadSettings() {
    setLoading(true);
    try {
      if (section === 'frontend') {
        const frontendSettings = await adminGet<FrontendSettings>('/api/admin/v1/settings/frontend');
        frontendForm.setFieldsValue(frontendSettings);
        await loadCarouselSlides();
        return;
      }

      if (section === 'judge') {
        const judgeSettings = await adminGet<JudgeSettings>('/api/admin/v1/settings/judge');
        setJudgeThreadPoolSize(judgeSettings.threadPoolSize ?? 2);
        judgeForm.setFieldsValue({
          enabled: judgeSettings.enabled ?? true,
          mode: judgeSettings.mode ?? 'unsafe-local',
          contestMode: judgeSettings.contestMode ?? 'domjudge',
          enableUnsafeLocalJudge: judgeSettings.enableUnsafeLocalJudge ?? true,
          enableSandbox: judgeSettings.enableSandbox ?? true,
          maxConcurrent: judgeSettings.maxConcurrent ?? 2,
          threadPoolSize: judgeSettings.threadPoolSize ?? 2,
          queueBatchSize: judgeSettings.queueBatchSize ?? 2,
          pollIntervalMs: judgeSettings.pollIntervalMs ?? 1000,
          domjudgeBaseUrl: judgeSettings.domjudgeBaseUrl || 'http://127.0.0.1:8081',
          domjudgeApiKey: '',
          hasDomjudgeApiKey: judgeSettings.hasDomjudgeApiKey ?? false,
          domjudgeContestId: judgeSettings.domjudgeContestId || '',
          domjudgePollIntervalMs: judgeSettings.domjudgePollIntervalMs ?? 2000,
        });
        return;
      }

      if (section === 'system') {
        const [agentResult, ossResult] = await Promise.allSettled([
          adminGet<AgentSettings>('/api/admin/v1/settings/system/agent'),
          adminGet<OssSettings>('/api/admin/v1/settings/system/oss'),
        ]);
        if (agentResult.status === 'rejected' || ossResult.status === 'rejected') {
          const failedMessages = [
            agentResult.status === 'rejected'
              ? `AI 助手配置：${agentResult.reason instanceof Error ? agentResult.reason.message : '加载失败'}`
              : '',
            ossResult.status === 'rejected'
              ? `OSS 配置：${ossResult.reason instanceof Error ? ossResult.reason.message : '加载失败'}`
              : '',
          ].filter(Boolean);
          throw new Error(failedMessages.join('；'));
        }
        const agentSettings = agentResult.value;
        const ossSettings = ossResult.value;
        agentForm.setFieldsValue({
          enabled: agentSettings.enabled ?? false,
          baseUrl: agentSettings.baseUrl || '',
          apiKey: '',
          model: agentSettings.model || '',
          timeoutMs: agentSettings.timeoutMs ?? 30000,
          maxCodeChars: agentSettings.maxCodeChars ?? 12000,
        });
        ossForm.setFieldsValue({
          enabled: ossSettings.enabled ?? false,
          endpoint: ossSettings.endpoint || '',
          bucket: ossSettings.bucket || '',
          region: ossSettings.region || '',
          accessKeyId: ossSettings.accessKeyId || '',
          accessKeySecret: '',
          publicBaseUrl: ossSettings.publicBaseUrl || '',
          dir: ossSettings.dir || 'avatars/',
          maxSizeMb: ossSettings.maxSizeMb ?? 5,
        });
        return;
      }

      const registerSettings = await adminGet<RegisterSettings>('/api/admin/v1/settings/register');
      registerForm.setFieldsValue({
        enabled: registerSettings.enabled,
        emailVerification: registerSettings.emailVerification ?? false,
        emailConfig: {
          host: registerSettings.emailConfig?.host || '',
          port: registerSettings.emailConfig?.port || 587,
          username: registerSettings.emailConfig?.username || '',
          password: '',
          useSsl: registerSettings.emailConfig?.useSsl ?? true,
          subject: registerSettings.emailConfig?.subject || '',
          content: registerSettings.emailConfig?.content || '',
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载设置失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCarouselSlides() {
    setCarouselLoading(true);
    try {
      const slides = await adminGet<CarouselSlide[]>('/api/admin/v1/home/carousel');
      setCarouselSlides(slides);
    } catch (error) {
      toast.error('加载轮播图失败');
      console.error(error);
    } finally {
      setCarouselLoading(false);
    }
  }

  async function handleSaveFrontend(values: FrontendSettings) {
    try {
      await adminPut('/api/admin/v1/settings/frontend', {
        siteTitle: values.siteTitle,
        siteLogo: values.siteLogo || '',
        maintenanceMode: values.maintenanceMode,
        footerText: values.footerText || '',
        icpNumber: values.icpNumber || '',
        footerLink1Text: values.footerLink1Text || '',
        footerLink1Url: values.footerLink1Url || '',
        footerLink2Text: values.footerLink2Text || '',
        footerLink2Url: values.footerLink2Url || '',
      });
      toast.success('前端设置保存成功');
      loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  function hasEmailConfigInput(emailConfig?: EmailConfig) {
    if (!emailConfig) {
      return false;
    }
    return Boolean(
      emailConfig.host?.trim()
      || emailConfig.username?.trim()
      || emailConfig.password?.trim()
      || emailConfig.subject?.trim()
      || emailConfig.content?.trim()
    );
  }

  function validateEmailConfig(emailConfig?: EmailConfig) {
    const host = emailConfig?.host?.trim() || '';
    const username = emailConfig?.username?.trim() || '';
    const port = emailConfig?.port;

    if (!host) {
      toast.error('请填写 SMTP 服务器');
      return false;
    }
    if (!port || port < 1 || port > 65535) {
      toast.error('请填写 1-65535 之间的 SMTP 端口');
      return false;
    }
    if (!username) {
      toast.error('请填写发件邮箱');
      return false;
    }
    return true;
  }

  async function handleRegisterSaveClick() {
    const values = registerForm.getFieldsValue() as RegisterSettings;
    await handleSaveRegister(values);
  }

  async function handleSaveRegister(values: RegisterSettings) {
    const emailVerificationEnabled = Boolean(values.emailVerification);
    const shouldSaveEmailConfig = emailVerificationEnabled || hasEmailConfigInput(values.emailConfig);

    if (shouldSaveEmailConfig && !validateEmailConfig(values.emailConfig)) {
      return;
    }

    setRegisterSaving(true);
    try {
      if (shouldSaveEmailConfig) {
        await adminPut('/api/admin/v1/settings/register/email-config', {
          host: values.emailConfig.host.trim(),
          port: values.emailConfig.port,
          username: values.emailConfig.username.trim(),
          password: values.emailConfig.password || '',
          useSsl: values.emailConfig.useSsl ?? true,
          subject: values.emailConfig.subject?.trim() || undefined,
          content: values.emailConfig.content?.trim() ? values.emailConfig.content : undefined,
        });
      }
      await adminPut('/api/admin/v1/settings/register/enabled', { enabled: values.enabled });
      await adminPut('/api/admin/v1/settings/register/email-verification', { enabled: emailVerificationEnabled });

      toast.success('注册设置保存成功');
      loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setRegisterSaving(false);
    }
  }

  async function handleSaveJudge(values: JudgeSettings) {
    try {
      await adminPut('/api/admin/v1/settings/judge', {
        enabled: values.enabled ?? false,
        mode: values.mode || 'unsafe-local',
        contestMode: values.contestMode || 'domjudge',
        enableUnsafeLocalJudge: values.enableUnsafeLocalJudge ?? false,
        enableSandbox: values.enableSandbox ?? false,
        maxConcurrent: values.maxConcurrent ?? 2,
        threadPoolSize: values.threadPoolSize ?? 2,
        queueBatchSize: values.queueBatchSize ?? 2,
        pollIntervalMs: values.pollIntervalMs ?? 1000,
        domjudgeBaseUrl: values.domjudgeBaseUrl?.trim() || '',
        domjudgeApiKey: values.domjudgeApiKey?.trim() || '',
        domjudgeContestId: values.domjudgeContestId?.trim() || '',
        domjudgePollIntervalMs: values.domjudgePollIntervalMs ?? 2000,
      });
      toast.success('判题配置保存成功');
      loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function handleSaveAgent(values: AgentSettings) {
    try {
      await adminPut('/api/admin/v1/settings/system/agent', {
        enabled: values.enabled ?? false,
        baseUrl: values.baseUrl?.trim() || '',
        apiKey: values.apiKey?.trim() || '',
        model: values.model?.trim() || '',
        timeoutMs: values.timeoutMs ?? 30000,
        maxCodeChars: values.maxCodeChars ?? 12000,
      });
      toast.success('AI 助手配置保存成功');
      loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function handleSaveOss(values: OssSettings) {
    try {
      await adminPut('/api/admin/v1/settings/system/oss', {
        enabled: values.enabled ?? false,
        endpoint: values.endpoint?.trim() || '',
        bucket: values.bucket?.trim() || '',
        region: values.region?.trim() || '',
        accessKeyId: values.accessKeyId?.trim() || '',
        accessKeySecret: values.accessKeySecret?.trim() || '',
        publicBaseUrl: values.publicBaseUrl?.trim() || '',
        dir: values.dir?.trim() || 'avatars/',
        maxSizeMb: values.maxSizeMb ?? 5,
      });
      toast.success('OSS 配置保存成功');
      loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function handleChangePassword(values: any) {
    try {
      await adminPut('/api/admin/v1/settings/admin/password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      toast.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '密码修改失败');
    }
  }

  function openCreateCarouselModal() {
    setEditingSlide(null);
    carouselForm.setFieldsValue({
      ...emptyCarouselSlide,
      displayOrder: carouselSlides.length + 1,
    });
    setCarouselModalVisible(true);
  }

  function openEditCarouselModal(slide: CarouselSlide) {
    setEditingSlide(slide);
    carouselForm.setFieldsValue({
      title: slide.title,
      imageUrl: slide.imageUrl,
      displayOrder: slide.displayOrder,
      enabled: slide.enabled,
    });
    setCarouselModalVisible(true);
  }

  async function handleSaveCarouselSlide() {
    try {
      const values = await carouselForm.validate();
      setCarouselSubmitting(true);
      const payload: CarouselSlideForm = {
        ...values,
        enabled: values.enabled ?? true,
      };

      if (editingSlide) {
        await adminPut<CarouselSlide>(`/api/admin/v1/home/carousel/${editingSlide.id}`, payload);
        toast.success('轮播图更新成功');
      } else {
        await adminPost<CarouselSlide>('/api/admin/v1/home/carousel', payload);
        toast.success('轮播图创建成功');
      }

      setCarouselModalVisible(false);
      carouselForm.resetFields();
      loadCarouselSlides();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setCarouselSubmitting(false);
    }
  }

  async function handleDeleteCarouselSlide(id: number) {
    try {
      await adminDelete(`/api/admin/v1/home/carousel/${id}`);
      toast.success('轮播图删除成功');
      loadCarouselSlides();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  const carouselColumns: TableColumnProps[] = [
    {
      title: '排序',
      dataIndex: 'displayOrder',
      width: 70,
      align: 'center',
    },
    {
      title: '预览',
      dataIndex: 'imageUrl',
      width: 140,
      render: (imageUrl: string, record: CarouselSlide) => (
        <img
          src={imageUrl}
          alt={record.title}
          style={{ width: 120, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e6eb' }}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 160,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      align: 'center',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'gray'}>{enabled ? '启用' : '隐藏'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: CarouselSlide) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => openEditCarouselModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            content="删除后首页将不再展示这张轮播图。"
            okButtonProps={{ status: 'danger' }}
            onOk={() => handleDeleteCarouselSlide(record.id)}
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  function renderFrontendSettings() {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', overflowX: 'hidden' }}>
        <Card
          title="前端配置"
          style={{ marginBottom: 24 }}
          bordered={false}
          extra={
            <Button
              type="primary"
              icon={<IconSave />}
              onClick={() => frontendForm.submit()}
              loading={loading}
            >
              保存
            </Button>
          }
        >
          <Form
            form={frontendForm}
            onSubmit={handleSaveFrontend}
            labelCol={{ span: 5 }}
            wrapperCol={{ span: 16 }}
            labelAlign="right"
            requiredSymbol={{ position: 'end' }}
          >
            <FormItem
              label="站点标题"
              field="siteTitle"
              rules={[{ required: true, message: '请输入站点标题' }]}
            >
              <Input placeholder="QOJ 校园 Online Judge" />
            </FormItem>

            <FormItem
              label="站点图标"
              field="siteLogo"
              extra="显示在左上角的 Logo 图片地址（可选），留空则显示默认图标"
            >
              <Input placeholder="/banners/logo.svg 或 https://example.com/logo.png" />
            </FormItem>

            <FormItem
              label="维护模式"
              field="maintenanceMode"
              triggerPropName="checked"
              extra="开启后，普通用户将无法访问系统"
            >
              <Switch />
            </FormItem>

            <FormItem
              label="底部文案"
              field="footerText"
              extra="显示在前台页面底部中间的一句话"
            >
              <Input placeholder="例如：专注算法训练与程序设计竞赛" />
            </FormItem>

            <FormItem
              label="备案号"
              field="icpNumber"
              extra="显示在前台页面底部，可填写 ICP 备案号或公安备案号"
            >
              <Input placeholder="例如：粤ICP备xxxxxxxx号" />
            </FormItem>

            <Divider orientation="left">
              <Text>底部右侧文字地址</Text>
            </Divider>

            <FormItem label="地址一文字" field="footerLink1Text">
              <Input placeholder="例如：隐私政策" />
            </FormItem>

            <FormItem label="地址一链接" field="footerLink1Url">
              <Input placeholder="例如：/privacy 或 https://example.com/privacy" />
            </FormItem>

            <FormItem label="地址二文字" field="footerLink2Text">
              <Input placeholder="例如：服务条款" />
            </FormItem>

            <FormItem label="地址二链接" field="footerLink2Url">
              <Input placeholder="例如：/terms 或 https://example.com/terms" />
            </FormItem>
          </Form>
        </Card>

        <Card
          title="轮播图管理"
          bordered={false}
          extra={
            <Space>
              <Button icon={<IconRefresh />} onClick={loadCarouselSlides} loading={carouselLoading}>
                刷新
              </Button>
              <Button type="primary" icon={<IconPlus />} onClick={openCreateCarouselModal}>
                新建轮播图
              </Button>
            </Space>
          }
        >
          <Table
            loading={carouselLoading}
            columns={carouselColumns}
            data={carouselSlides}
            rowKey="id"
            pagination={false}
            scroll={{ x: '100%' }}
            noDataElement={
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#86909c' }}>
                暂无轮播图
              </div>
            }
          />
        </Card>

        <Modal
          title={editingSlide ? '编辑轮播图' : '新建轮播图'}
          visible={carouselModalVisible}
          onOk={handleSaveCarouselSlide}
          onCancel={() => {
            setCarouselModalVisible(false);
            carouselForm.resetFields();
          }}
          confirmLoading={carouselSubmitting}
          style={{ width: 640 }}
        >
          <Form form={carouselForm} layout="vertical" autoComplete="off">
            <FormItem
              label="标题"
              field="title"
              rules={[{ required: true, message: '请输入轮播图标题' }]}
            >
              <Input placeholder="例如：题库训练" />
            </FormItem>

            <FormItem
              label="图片地址"
              field="imageUrl"
              rules={[{ required: true, message: '请输入图片地址' }]}
            >
              <Input placeholder="/banners/problem-bank.svg" />
            </FormItem>

            <FormItem
              label="显示顺序"
              field="displayOrder"
              rules={[{ required: true, message: '请输入显示顺序' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </FormItem>

            <FormItem label="启用" field="enabled" triggerPropName="checked">
              <Switch />
            </FormItem>
          </Form>
        </Modal>
      </div>
    );
  }

  function renderJudgeSettings() {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', overflowX: 'hidden' }}>
        <Card
          title="判题配置"
          style={{ marginBottom: 24 }}
          bordered={false}
          extra={
            <Button
              type="primary"
              icon={<IconSave />}
              onClick={() => judgeForm.submit()}
              loading={loading}
            >
              保存
            </Button>
          }
        >
          <Form
            form={judgeForm}
            onSubmit={handleSaveJudge}
            labelCol={{ span: 5 }}
            wrapperCol={{ span: 12 }}
            labelAlign="right"
            requiredSymbol={{ position: 'end' }}
          >
            <FormItem
              label="判题开关"
              field="enabled"
              triggerPropName="checked"
              extra="关闭后，用户无法提交记录和调试运行；已进入队列的任务在开关重新打开后自动恢复判题"
            >
              <Switch />
            </FormItem>

            <FormItem
              label="判题模式"
              field="mode"
              rules={[{ required: true, message: '请选择判题模式' }]}
            >
              <Select>
                <Option value="unsafe-local">本地判题</Option>
                <Option value="docker">Docker 判题</Option>
                <Option value="domjudge">DOMjudge</Option>
              </Select>
            </FormItem>

            <FormItem
              label="比赛模式"
              field="contestMode"
              rules={[{ required: true, message: '请选择比赛判题模式' }]}
              extra="比赛提交使用此模式，普通练习继续使用上面的判题模式"
            >
              <Select>
                <Option value="domjudge">DOMjudge</Option>
                <Option value="docker">Docker 判题</Option>
                <Option value="unsafe-local">本地判题</Option>
              </Select>
            </FormItem>

            <FormItem label="本地判题" field="enableUnsafeLocalJudge" triggerPropName="checked">
              <Switch />
            </FormItem>

            <FormItem label="沙箱调试" field="enableSandbox" triggerPropName="checked">
              <Switch />
            </FormItem>

            <FormItem
              label="线程池大小"
              field="threadPoolSize"
              rules={[{ required: true, message: '请输入判题线程池大小' }]}
            >
              <InputNumber
                min={1}
                max={64}
                step={1}
                style={{ width: '100%' }}
                onChange={(value) => setJudgeThreadPoolSize(Number(value) || 1)}
              />
            </FormItem>

            <FormItem
              label="最大并发数"
              field="maxConcurrent"
              rules={[{ required: true, message: '请输入判题最大并发数' }]}
              extra={`单轮最大并发判题数，取值范围 1 ~ ${judgeThreadPoolSize}`}
            >
              <InputNumber min={1} max={judgeThreadPoolSize} step={1} style={{ width: '100%' }} />
            </FormItem>

            <FormItem
              label="队列批量数"
              field="queueBatchSize"
              rules={[{ required: true, message: '请输入队列批量数' }]}
            >
              <InputNumber min={1} max={100} step={1} style={{ width: '100%' }} />
            </FormItem>

            <FormItem
              label="队列轮询"
              field="pollIntervalMs"
              rules={[{ required: true, message: '请输入队列轮询间隔' }]}
            >
              <InputNumber min={200} max={60000} step={100} suffix="ms" style={{ width: '100%' }} />
            </FormItem>

            <Divider />

            <FormItem
              label="DOMjudge 地址"
              field="domjudgeBaseUrl"
            >
              <Input placeholder="http://127.0.0.1:8081" />
            </FormItem>

            <FormItem
              label="DOMjudge Key"
              field="domjudgeApiKey"
              extra="留空时保留已保存的 API Key"
            >
              <Input.Password placeholder="留空保留原值" />
            </FormItem>

            <FormItem
              label="默认比赛 ID"
              field="domjudgeContestId"
            >
              <Input placeholder="1" />
            </FormItem>

            <FormItem
              label="结果轮询"
              field="domjudgePollIntervalMs"
              rules={[{ required: true, message: '请输入 DOMjudge 结果轮询间隔' }]}
            >
              <InputNumber min={500} max={60000} step={100} suffix="ms" style={{ width: '100%' }} />
            </FormItem>
          </Form>

          <Divider />
          <Paragraph style={{ margin: 0, fontSize: 13, color: '#86909c' }}>
            判题配置保存到数据库，保存后调度器与 DOMjudge 接入配置会按新值生效。
            线程池大小会在后端重启后按数据库配置重新初始化。
          </Paragraph>
        </Card>
      </div>
    );
  }

  function renderRegisterSettings() {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', overflowX: 'hidden' }}>
        <Card
          title="注册配置"
          style={{ marginBottom: 24 }}
          bordered={false}
          extra={
            <Button
              type="primary"
              icon={<IconSave />}
              onClick={handleRegisterSaveClick}
              loading={loading || registerSaving}
            >
              保存
            </Button>
          }
        >
          <Form
            form={registerForm}
            onSubmit={handleSaveRegister}
            layout="vertical"
            requiredSymbol={{ position: 'end' }}
          >
            <FormItem
              label="开放注册"
              field="enabled"
              triggerPropName="checked"
              extra="关闭后，新用户将无法注册"
            >
              <Switch />
            </FormItem>

            <FormItem
              label="邮箱验证"
              field="emailVerification"
              triggerPropName="checked"
              extra="开启后，注册时需要通过邮箱验证码"
            >
              <Switch />
            </FormItem>

            <Divider orientation="left">
              <Text>邮箱配置</Text>
            </Divider>

            <FormItem
              label="SMTP 服务器"
              field="emailConfig.host"
            >
              <Input placeholder="smtp.example.com" />
            </FormItem>

            <FormItem
              label="SMTP 端口"
              field="emailConfig.port"
            >
              <InputNumber placeholder="587" style={{ width: '100%' }} min={1} max={65535} />
            </FormItem>

            <FormItem
              label="发件邮箱"
              field="emailConfig.username"
            >
              <Input placeholder="noreply@example.com" />
            </FormItem>

            <FormItem
              label="邮箱密码"
              field="emailConfig.password"
              extra="不修改密码请留空"
            >
              <Input.Password placeholder="留空则不修改密码" />
            </FormItem>

            <FormItem
              label="启用 SSL/TLS"
              field="emailConfig.useSsl"
              triggerPropName="checked"
              extra="大多数邮件服务需要启用"
            >
              <Switch />
            </FormItem>

            <Divider />

            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f7f8fa', borderRadius: 4 }}>
              <Paragraph style={{ margin: 0, fontSize: 13, color: '#4e5969' }}>
                <strong>邮件模板变量：</strong>使用以下变量来自定义邮件内容
              </Paragraph>
              <Paragraph style={{ margin: '8px 0 0', fontSize: 13, color: '#86909c' }}>
                • <code>{'{{code}}'}</code> - 验证码（自动生成的6位数字）<br/>
                • <code>{'{{username}}'}</code> - 用户名<br/>
                • <code>{'{{email}}'}</code> - 邮箱地址
              </Paragraph>
            </div>

            <FormItem
              label="邮件标题"
              field="emailConfig.subject"
              extra="邮件主题，支持变量"
            >
              <Input placeholder="QOJ 注册验证码" />
            </FormItem>

            <FormItem
              label="邮件内容"
              field="emailConfig.content"
              extra="邮件正文，支持变量"
            >
              <Input.TextArea
                placeholder={'您好，\n\n您的验证码是: {{code}}\n\n验证码将在10分钟后过期，请勿泄露给他人。\n\nQOJ Online Judge System'}
                rows={6}
              />
            </FormItem>
          </Form>
        </Card>

        <Card title="安全设置" bordered={false}>
          <Form
            form={passwordForm}
            onSubmit={handleChangePassword}
            layout="vertical"
            requiredSymbol={{ position: 'end' }}
          >
            <Title heading={6} style={{ marginBottom: 16 }}>
              修改管理员密码
            </Title>

            <FormItem
              label="当前密码"
              field="oldPassword"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="当前密码" />
            </FormItem>

            <FormItem
              label="新密码"
              field="newPassword"
              rules={[
                { required: true, message: '请输入新密码' },
                { minLength: 6, message: '密码长度至少6位' },
              ]}
            >
              <Input.Password placeholder="新密码" />
            </FormItem>

            <FormItem
              label="确认密码"
              field="confirmPassword"
              rules={[
                { required: true, message: '请确认新密码' },
                {
                  validator: (value, callback) => {
                    const newPassword = passwordForm.getFieldValue('newPassword');
                    if (value !== newPassword) {
                      callback('两次密码输入不一致');
                    }
                  },
                },
              ]}
            >
              <Input.Password placeholder="确认新密码" />
            </FormItem>

            <FormItem>
              <Button type="primary" htmlType="submit">
                修改密码
              </Button>
            </FormItem>
          </Form>
        </Card>
      </div>
    );
  }

  function renderSystemSettings() {
    return (
      <div style={{ maxWidth: 920, margin: '0 auto', overflowX: 'hidden' }}>
        <Card
          title="AI 助手配置"
          style={{ marginBottom: 24 }}
          bordered={false}
          extra={
            <Button type="primary" icon={<IconSave />} onClick={() => agentForm.submit()} loading={loading}>
              保存
            </Button>
          }
        >
          <Form
            form={agentForm}
            onSubmit={handleSaveAgent}
            labelCol={{ span: 5 }}
            wrapperCol={{ span: 16 }}
            labelAlign="right"
            requiredSymbol={{ position: 'end' }}
          >
            <FormItem label="启用助手" field="enabled" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="服务地址" field="baseUrl" extra="OpenAI 兼容接口地址，例如 https://api.example.com/v1">
              <Input placeholder="https://api.example.com/v1" />
            </FormItem>
            <FormItem label="API Key" field="apiKey" extra="不修改请留空">
              <Input.Password placeholder="留空则不修改" />
            </FormItem>
            <FormItem label="模型名称" field="model">
              <Input placeholder="deepseek-chat" />
            </FormItem>
            <FormItem label="请求超时" field="timeoutMs" extra="单位毫秒，范围 1000-120000">
              <InputNumber min={1000} max={120000} step={1000} style={{ width: '100%' }} />
            </FormItem>
            <FormItem label="代码上下文" field="maxCodeChars" extra="发送给 AI 的最大代码字符数，范围 1000-50000">
              <InputNumber min={1000} max={50000} step={1000} style={{ width: '100%' }} />
            </FormItem>
          </Form>
        </Card>

        <Card
          title="OSS 信息配置"
          bordered={false}
          extra={
            <Button type="primary" icon={<IconSave />} onClick={() => ossForm.submit()} loading={loading}>
              保存
            </Button>
          }
        >
          <Form
            form={ossForm}
            onSubmit={handleSaveOss}
            labelCol={{ span: 5 }}
            wrapperCol={{ span: 16 }}
            labelAlign="right"
            requiredSymbol={{ position: 'end' }}
          >
            <FormItem label="启用 OSS" field="enabled" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="Endpoint" field="endpoint">
              <Input placeholder="https://oss-cn-hangzhou.aliyuncs.com" />
            </FormItem>
            <FormItem label="Bucket" field="bucket">
              <Input placeholder="qoj-assets" />
            </FormItem>
            <FormItem label="Region" field="region">
              <Input placeholder="oss-cn-hangzhou" />
            </FormItem>
            <FormItem label="AccessKey ID" field="accessKeyId">
              <Input placeholder="AccessKey ID" />
            </FormItem>
            <FormItem label="AccessKey Secret" field="accessKeySecret" extra="不修改请留空">
              <Input.Password placeholder="留空则不修改" />
            </FormItem>
            <FormItem label="公开地址" field="publicBaseUrl" extra="用于拼接头像访问地址，例如 https://cdn.example.com">
              <Input placeholder="https://cdn.example.com" />
            </FormItem>
            <FormItem label="头像目录" field="dir">
              <Input placeholder="avatars/" />
            </FormItem>
            <FormItem label="头像大小" field="maxSizeMb" extra="单位 MB，范围 1-20">
              <InputNumber min={1} max={20} step={1} style={{ width: '100%' }} />
            </FormItem>
          </Form>
        </Card>
      </div>
    );
  }

  return (
    section === 'frontend' ? renderFrontendSettings()
    : section === 'register' ? renderRegisterSettings()
    : section === 'system' ? renderSystemSettings()
    : renderJudgeSettings()
  );
}
