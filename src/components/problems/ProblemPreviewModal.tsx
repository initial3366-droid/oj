/**
 * 题目预览弹窗。后台/教师题目列表点击「查看」后打开，展示题目预览后的完整信息
 * （题面、输入输出格式、样例、评测限制）以及创建时间、最后编辑时间、通过率、测试点数等管理信息。
 * 通过 get 属性复用调用方各自的 API 客户端（adminGet / teacherGet）。
 */
import { useEffect, useState } from 'react';
import { Modal, Spin, Tag, Descriptions, Empty } from '@arco-design/web-react';
import { HtmlMath } from '../HtmlMath';
import { MarkdownMath } from '../MarkdownMath';

/**
 * 样例接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface SampleCase {
  caseNo?: number;
  input: string;
  output: string;
  explanation?: string;
}

/**
 * 题目预览数据接口，兼容管理员（AdminProblemVO）与只读（PublicProblemVO）两种返回。
 */
export interface ProblemPreviewDetail {
  id: number;
  title: string;
  statement?: string;
  inputFormat?: string;
  outputFormat?: string;
  timeLimit?: number;
  memoryLimit?: number;
  difficulty?: number;
  tags?: string[];
  folderName?: string;
  acRate?: number;
  submissionCount?: number;
  acceptedCount?: number;
  createdAt?: string;
  updatedAt?: string;
  samples?: SampleCase[];
  testCaseCount?: number;
  ownerName?: string;
  accessScope?: 'ALL' | 'MAJOR' | 'PRIVATE';
  majorName?: string | null;
  studentPublishStatus?: 'DRAFT' | 'PUBLISHED';
}

/**
 * 题目预览弹窗Props接口。
 */
interface ProblemPreviewModalProps {
  visible: boolean;
  problemId: number | null;
  onClose: () => void;
  get: <T>(url: string) => Promise<T>;
}

const DIFFICULTY_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '入门', color: 'arcoblue' },
  2: { text: '简单', color: 'green' },
  3: { text: '中等', color: 'orange' },
  4: { text: '困难', color: 'red' },
  5: { text: '地狱', color: 'purple' },
};

/**
 * 格式化访问范围文案。
 */
function scopeText(detail: ProblemPreviewDetail) {
  if (detail.accessScope === 'ALL') return '所有人';
  if (detail.accessScope === 'MAJOR') return detail.majorName || '本专业';
  return '私有';
}

/**
 * 格式化时间，缺失时返回占位符。
 */
function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 渲染题目预览弹窗，并协调详情数据加载。
 */
export function ProblemPreviewModal({ visible, problemId, onClose, get }: ProblemPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ProblemPreviewDetail | null>(null);

  useEffect(() => {
    if (!visible || problemId == null) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoading(true);
    get<ProblemPreviewDetail>(`/api/admin/v1/problems/${problemId}`)
      .then((result) => { if (active) setDetail(result); })
      .catch(() => { if (active) setDetail(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, problemId, get]);

  const difficultyInfo = detail?.difficulty != null
    ? DIFFICULTY_MAP[detail.difficulty] || { text: '未知', color: 'gray' }
    : null;
  const samples = detail?.samples ?? [];

  return (
    <Modal
      title={detail ? `题目预览 · ${detail.title}` : '题目预览'}
      visible={visible}
      onCancel={onClose}
      footer={null}
      style={{ width: 900, maxWidth: '92vw' }}
      unmountOnExit
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
        <Spin loading={loading} style={{ display: 'block', width: '100%' }}>
          {!detail && !loading ? (
            <Empty description="暂无题目信息" />
          ) : detail ? (
            <div style={{ wordBreak: 'break-word' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ color: 'var(--color-text-3)' }}>#{detail.id}</span>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{detail.title}</span>
                {difficultyInfo && <Tag color={difficultyInfo.color}>{difficultyInfo.text}</Tag>}
              </div>

              <Descriptions
                column={2}
                size="small"
                border
                style={{ marginBottom: 20 }}
                labelStyle={{ width: 96, whiteSpace: 'nowrap' }}
                data={[
                  { label: '创建者', value: detail.ownerName || '-' },
                  { label: '所属文件夹', value: detail.folderName || '-' },
                  { label: '开放范围', value: scopeText(detail) },
                  {
                    label: '学生题库',
                    value: (
                      <Tag color={detail.studentPublishStatus === 'PUBLISHED' ? 'green' : 'gray'}>
                        {detail.studentPublishStatus === 'PUBLISHED' ? '已发布' : '未发布'}
                      </Tag>
                    ),
                  },
                  { label: '通过率', value: detail.acRate != null ? `${detail.acRate}% (${detail.acceptedCount ?? 0}/${detail.submissionCount ?? 0})` : '-' },
                  { label: '测试点', value: detail.testCaseCount != null ? `${detail.testCaseCount} 个` : '-' },
                  { label: '时间限制', value: detail.timeLimit != null ? `${detail.timeLimit} ms` : '-' },
                  { label: '内存限制', value: detail.memoryLimit != null ? `${detail.memoryLimit} MB` : '-' },
                  { label: '创建时间', value: formatTime(detail.createdAt) },
                  { label: '最后编辑', value: formatTime(detail.updatedAt) },
                ]}
              />

              {detail.tags && detail.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {detail.tags.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}
                </div>
              )}

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>题目描述</h3>
                <HtmlMath value={detail.statement || ''} emptyText="暂无题目描述" />
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>输入格式</h3>
                <HtmlMath value={detail.inputFormat || ''} emptyText="无" />
              </section>

              <section style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>输出格式</h3>
                <HtmlMath value={detail.outputFormat || ''} emptyText="无" />
              </section>

              {samples.length > 0 && (
                <section>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>样例</h3>
                  {samples.map((sample, index) => (
                    <div
                      key={`${sample.caseNo ?? index}-${index}`}
                      style={{ border: '1px solid var(--color-border-2)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}
                    >
                      <div style={{ padding: '6px 12px', fontWeight: 600, background: 'var(--color-fill-2)' }}>样例 {index + 1} · 输入</div>
                      <pre style={{ margin: 0, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>{sample.input}</pre>
                      <div style={{ padding: '6px 12px', fontWeight: 600, background: 'var(--color-fill-2)' }}>输出</div>
                      <pre style={{ margin: 0, padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>{sample.output}</pre>
                      {sample.explanation ? (
                        <>
                          <div style={{ padding: '6px 12px', fontWeight: 600, background: 'var(--color-fill-2)' }}>说明</div>
                          <div style={{ padding: '10px 12px' }}><MarkdownMath value={sample.explanation} /></div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </section>
              )}
            </div>
          ) : null}
        </Spin>
      </div>
    </Modal>
  );
}
