import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Grid,
  Input,
  Message,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconLeft, IconSend } from '@arco-design/web-react/icon';
import { adminGet, adminPost } from '../../admin/api/adminClient';
import { teacherGet, teacherPost } from '../../teacher/teacherApi';
import { adminPath } from '../../utils/adminPath';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

type Variant = 'admin' | 'teacher';
type StudentAccessMode = 'ALL' | 'SELECTED_CLASSES';

interface Problem {
  id: number;
  title: string;
  difficulty?: number;
}

interface Practice {
  id: number;
  title: string;
  description?: string;
  problems: Problem[];
  canPublish: boolean;
}

interface ClassOption {
  id: number;
  name: string;
}

interface PageResult<T> {
  total: number;
  list: T[];
}

interface PublishForm {
  title: string;
  description?: string;
  studentAccessMode: StudentAccessMode;
  classIds?: number[];
  password?: string;
}

const difficultyText: Record<number, string> = {
  1: '入门',
  2: '简单',
  3: '中等',
  4: '困难',
  5: '地狱',
};

export function PracticePublishPage({ variant }: { variant: Variant }) {
  const navigate = useNavigate();
  const { practiceId } = useParams();
  const sourceId = Number(practiceId);
  const [form] = Form.useForm<PublishForm>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [studentAccessMode, setStudentAccessMode] = useState<StudentAccessMode>('ALL');
  const [visibility, setVisibility] = useState<Record<number, boolean>>({});

  const listPath = variant === 'teacher' ? '/teacher/practices' : adminPath('/practices');

  useEffect(() => {
    if (!Number.isFinite(sourceId)) {
      Message.error('题单参数无效');
      navigate(listPath, { replace: true });
      return;
    }
    void load();
  }, [sourceId, variant]);

  async function load() {
    setLoading(true);
    try {
      const practiceRequest = variant === 'teacher'
        ? teacherGet<PageResult<Practice>>('/api/admin/v1/practices?page=1&pageSize=200')
        : adminGet<PageResult<Practice>>('/api/admin/v1/practices?page=1&pageSize=200');
      const classRequest = variant === 'teacher'
        ? teacherGet<ClassOption[]>('/api/teacher/v1/classes')
        : adminGet<ClassOption[]>('/api/admin/v1/classes');
      const [practiceResult, classResult] = await Promise.all([practiceRequest, classRequest]);
      const source = practiceResult.list.find((item) => item.id === sourceId);
      if (!source || !source.canPublish) {
        throw new Error('题单不存在或无权发布');
      }
      setPractice(source);
      setClasses(classResult);
      setVisibility(Object.fromEntries((source.problems ?? []).map((problem) => [problem.id, true])));
      form.setFieldsValue({
        title: source.title,
        description: source.description ?? '',
        studentAccessMode: 'ALL',
        classIds: [],
        password: '',
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '发布数据加载失败');
      navigate(listPath, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!practice) return;
    try {
      const values = await form.validate();
      if (values.studentAccessMode === 'SELECTED_CLASSES' && !values.classIds?.length) {
        Message.warning('请选择至少一个班级');
        return;
      }
      if (!Object.values(visibility).some(Boolean)) {
        Message.warning('至少公开一道题目后才能发布');
        return;
      }
      setSubmitting(true);
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        studentAccessMode: values.studentAccessMode,
        classIds: values.studentAccessMode === 'SELECTED_CLASSES' ? values.classIds : [],
        password: values.password?.trim() || undefined,
        problems: practice.problems.map((problem) => ({
          problemId: problem.id,
          visibility: visibility[problem.id] ? 'VISIBLE' : 'HIDDEN',
        })),
      };
      if (variant === 'teacher') {
        await teacherPost(`/api/admin/v1/practices/${practice.id}/publications`, payload);
      } else {
        await adminPost(`/api/admin/v1/practices/${practice.id}/publications`, payload);
      }
      Message.success('题单已发布');
      navigate(listPath);
    } catch (error) {
      if (error instanceof Error) Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const visibleCount = useMemo(
    () => Object.values(visibility).filter(Boolean).length,
    [visibility],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title="发布题单"
        loading={loading}
        extra={(
          <Space>
            <Button icon={<IconLeft />} onClick={() => navigate(listPath)}>返回列表</Button>
            <Button type="primary" icon={<IconSend />} loading={submitting} onClick={submit}>确认发布</Button>
          </Space>
        )}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ studentAccessMode: 'ALL' }}
          onValuesChange={(_, values) => setStudentAccessMode(values.studentAccessMode ?? 'ALL')}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <FormItem label="发布标题" field="title" rules={[{ required: true, message: '请输入发布标题' }]}>
                <Input maxLength={100} />
              </FormItem>
            </Col>
            <Col xs={24} md={12}>
              <FormItem label="学生开放范围" field="studentAccessMode">
                <Radio.Group type="button">
                  <Radio value="ALL">所有学生</Radio>
                  <Radio value="SELECTED_CLASSES">指定班级</Radio>
                </Radio.Group>
              </FormItem>
            </Col>
            {studentAccessMode === 'SELECTED_CLASSES' && (
              <Col xs={24} md={12}>
                <FormItem label="可访问班级" field="classIds" rules={[{ required: true, message: '请选择班级' }]}>
                  <Select mode="multiple" allowClear placeholder="选择一个或多个班级">
                    {classes.map((item) => (
                      <Select.Option key={item.id} value={item.id}>{item.name}（{item.id}）</Select.Option>
                    ))}
                  </Select>
                </FormItem>
              </Col>
            )}
            <Col xs={24} md={12}>
              <FormItem label="访问密码" field="password">
                <Input.Password maxLength={100} placeholder="不填写则无需密码" />
              </FormItem>
            </Col>
            <Col span={24}>
              <FormItem label="发布说明" field="description">
                <TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} showWordLimit />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        bordered={false}
        title="题目公开设置"
        extra={<Tag color="arcoblue">公开 {visibleCount} / {practice?.problems.length ?? 0}</Tag>}
      >
        <Table
          rowKey="id"
          pagination={false}
          data={practice?.problems ?? []}
          columns={[
            { title: '顺序', width: 80, align: 'center' as const, render: (_: unknown, __: Problem, index: number) => index + 1 },
            { title: '题目', render: (_: unknown, problem: Problem) => <Space><Typography.Text code>#{problem.id}</Typography.Text><Typography.Text>{problem.title}</Typography.Text></Space> },
            { title: '难度', width: 100, render: (_: unknown, problem: Problem) => difficultyText[problem.difficulty ?? 0] ?? '未知' },
            {
              title: '学生可见',
              width: 150,
              align: 'center' as const,
              render: (_: unknown, problem: Problem) => (
                <Switch
                  checked={Boolean(visibility[problem.id])}
                  checkedText="公开"
                  uncheckedText="隐藏"
                  onChange={(checked) => setVisibility((current) => ({ ...current, [problem.id]: checked }))}
                />
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
