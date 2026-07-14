/**
 * 练习Assignment页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Button, Card, Divider, Input, Table, Tag, Typography } from "@douyinfe/semi-ui";
import { IconLock } from "@douyinfe/semi-icons";
import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { fetchPracticeDetail, type Practice } from "../data/apiClient";
import { difficultyColor } from "../lib/format";

/**
 * 渲染练习Assignment页面，并协调其数据加载、状态和交互。
 */
export function PracticeAssignmentPage() {
  const { practiceId } = useParams();
  const navigate = useNavigate();
  const numericPracticeId = Number(practiceId);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!numericPracticeId) {
      return;
    }
    let cancelled = false;
    fetchPracticeDetail(numericPracticeId)
      .then((data) => {
        if (!cancelled) {
          setPractice(data);
          setMessage("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "题单加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [numericPracticeId]);

  if (practiceId?.startsWith("p")) {
    return <Navigate to={`/practice/problem/${practiceId}`} replace />;
  }

  /**
   * 封装unlock相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!numericPracticeId) {
      return;
    }
    try {
      const data = await fetchPracticeDetail(numericPracticeId, password);
      setPractice(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "题单加载失败");
    }
  };

  if (!practice && message) {
    return (
      <div className="grid min-h-[520px] place-items-center">
        <Card
          className="w-full max-w-md border border-slate-200 shadow-soft"
          bodyStyle={{ padding: 0 }}
        >
          <div className="px-6 py-5">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
              <IconLock style={{ fontSize: 22 }} />
            </div>
            <Typography.Title heading={4} style={{ margin: 0 }}>
              题单访问
            </Typography.Title>
            <Typography.Text type="tertiary" style={{ marginTop: 8, display: "block", fontSize: 14 }}>
              {message}
            </Typography.Text>
          </div>
          <Divider />
          <div className="px-6 py-5">
            <form className="grid gap-4" onSubmit={unlock}>
              <label className="grid gap-2">
                <Typography.Text strong>题单密码</Typography.Text>
                <Input
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
              </label>
              <Button type="primary" theme="solid" htmlType="submit" block>
                进入题单
              </Button>
              <Button theme="light" block onClick={() => navigate("/practice")}>
                返回题单列表
              </Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  if (!practice) {
    return <div className="py-16 text-center text-slate-500">题单加载中...</div>;
  }

  const problemColumns = [
    {
      title: "题目",
      dataIndex: "title",
      width: 300,
      render: (_: string, problem: Practice["problems"][number]) => (
        <span style={{ fontWeight: 600, fontSize: 14 }}>{problem.title}</span>
      ),
    },
    {
      title: "标签",
      dataIndex: "tags",
      width: 250,
      render: (_: unknown, problem: Practice["problems"][number]) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(problem.tags ?? []).map((tag) => (
            <Tag key={tag} size="small" type="ghost">{tag}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      width: 100,
      render: (_: string, problem: Practice["problems"][number]) => (
        <Tag color={difficultyColor(problem.difficulty)} size="small">
          {problem.difficulty}
        </Tag>
      ),
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 100,
      render: (_: unknown, problem: Practice["problems"][number]) => (
        <Button
          type="primary"
          theme="light"
          size="small"
          onClick={() => navigate(`/practice/problem/${problem.id}?practiceId=${practice.id}`)}
        >
          写代码
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <Card className="border border-slate-200 shadow-soft" bodyStyle={{ padding: 0 }}>
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">{practice.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {practice.description || "暂无说明"}
            </p>
          </div>
          <div className="flex gap-3">
            <Tag>{practice.problems.length} 题</Tag>
            {practice.hasPassword ? <Tag color="orange">已验证</Tag> : null}
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-soft" bodyStyle={{ padding: 0 }}>
        <Table
          aria-label="题单题目"
          columns={problemColumns}
          dataSource={practice.problems}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
