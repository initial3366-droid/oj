import { adminPath } from '../../../utils/adminPath';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Modal,
  Popconfirm,
  Radio,
  Result,
  Space,
  Spin,
  Steps,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import {
  IconCode,
  IconDelete,
  IconEdit,
  IconFile,
  IconLeft,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
} from '@arco-design/web-react/icon';
import {
  clearContestDraft,
  createAdminContest,
  deleteAdminContest,
  fetchAdminClasses,
  fetchAdminContest,
  fetchAdminContests,
  fetchAdminProblemTestCases,
  fetchAdminProblems,
  fetchContestDraft,
  saveContestDraft,
  updateAdminContest,
  type AdminContest,
  type AdminOrganizationOption,
  type ContestDraftPayload,
  type ContestPayload,
  type ContestProblemPayload,
  type ProblemTestCasePayload,
} from '../../../data/apiClient';
import type { Problem } from '../../../data/types';
import { adminGet } from '../../api/adminClient';

const { Row, Col } = Grid;
const FormItem = Form.Item;
const Step = Steps.Step;
const TextArea = Input.TextArea;
const RadioGroup = Radio.Group;
const CheckboxGroup = Checkbox.Group;

type ContestMode = 'add' | 'edit' | 'list' | 'rankings';
type Audience = 'ALL' | 'CLASS';
type ContestType = 'ACM' | 'OI';

const emptyDraft: ContestDraftPayload = {
  title: '',
  durationMinutes: 180,
  startTime: '',
  description: '',
  type: 'ACM',
  audience: 'ALL',
  audienceTypes: ['ALL'],
  classIds: [],
  frozen: false,
  freezeTime: null,
  enableRollingScoreboard: false,
  goldRatio: 10,
  silverRatio: 20,
  bronzeRatio: 30,
  allowAfterEndSubmit: false,
  allowAfterEndViewProblem: true,
  allowAfterEndViewCode: false,
  publicScoreboardEnabled: true,
  showClassOnScoreboard: false,
  allowStarRegistration: false,
  allowViewAllSubmissions: true,
  registrationPassword: '',
  totalScore: 100,
  problems: [],
};

function adminToken() {
  return window.localStorage.getItem('qoj.adminAccessToken') ?? '';
}

function routeMode(pathname: string): ContestMode {
  if (pathname.endsWith('/new')) return 'add';
  if (pathname.endsWith('/edit')) return 'edit';
  if (pathname.endsWith('/rankings')) return 'rankings';
  return 'list';
}

function numericProblemId(id: string) {
  const match = id.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function nowLocalInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIsoLocal(value: string) {
  return value.length === 16 ? `${value}:00` : value.slice(0, 19);
}

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 19);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return nowLocalInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function defaultFreezeTime(draft: ContestDraftPayload) {
  const start = new Date(draft.startTime || nowLocalInput());
  const duration = Number(draft.durationMinutes ?? 180);
  const offsetMinutes = duration > 60 ? duration - 60 : Math.max(1, Math.floor(duration * 2 / 3));
  return toLocalInputValue(new Date(start.getTime() + offsetMinutes * 60 * 1000)).slice(0, 16);
}

function labelOf(index: number) {
  return String.fromCharCode(65 + index);
}

function statusText(status: AdminContest['status']) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

function statusColor(status: AdminContest['status']) {
  if (status === 'RUNNING') return 'green';
  if (status === 'ENDED') return 'gray';
  return 'blue';
}

function audienceText(contest: Pick<AdminContest, 'audience' | 'audiences'>) {
  if (contest.audiences?.length) {
    const types = new Set(contest.audiences.map((item) => item.audienceType));
    if (types.has('ALL')) return '所有人';
    if (types.has('CLASS')) return '班级';
  }
  if (contest.audience === 'CLASS') return '班级';
  return '所有人';
}

function distributeScores(totalScore: number, problems: ContestProblemPayload[]) {
  if (problems.length === 0) return [];
  const base = Math.floor(totalScore / problems.length);
  let rest = totalScore - base * problems.length;
  return problems.map((item) => {
    const score = base + (rest > 0 ? 1 : 0);
    rest -= 1;
    return { ...item, score };
  });
}

function distributeCaseScores(problemScore: number, cases: ProblemTestCasePayload[]) {
  if (cases.length === 0) return [];
  const base = Math.floor(problemScore / cases.length);
  let rest = problemScore - base * cases.length;
  return cases.map((item) => {
    const score = base + (rest > 0 ? 1 : 0);
    rest -= 1;
    return { caseNo: item.caseNo ?? 1, score };
  });
}

function distributeRemainingCaseScores(
  problemScore: number,
  currentScores: { caseNo: number; score: number }[],
  fixedCaseNo: number,
  fixedScore: number,
) {
  const normalizedFixedScore = Math.max(0, Math.min(problemScore, fixedScore));
  const others = currentScores.filter((item) => item.caseNo !== fixedCaseNo);
  const remaining = Math.max(0, problemScore - normalizedFixedScore);
  const base = others.length === 0 ? 0 : Math.floor(remaining / others.length);
  let rest = remaining - base * others.length;
  return currentScores.map((item) => {
    if (item.caseNo === fixedCaseNo) {
      return { ...item, score: normalizedFixedScore };
    }
    const score = base + (rest > 0 ? 1 : 0);
    rest -= 1;
    return { ...item, score };
  });
}

function initialAudienceTypes(draft: ContestDraftPayload): Audience[] {
  const types = draft.audienceTypes?.filter((item): item is Audience => item === 'ALL' || item === 'CLASS') ?? [];
  if (types.length) return types;
  return draft.audience === 'CLASS' ? ['CLASS'] : ['ALL'];
}

function normalizeSelectedProblems(problems: ContestProblemPayload[]) {
  return problems.map((item, index) => ({
    ...item,
    label: labelOf(index),
    displayOrder: index + 1,
  }));
}

export function AdminContestManagementPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { contestId } = useParams();
  const mode = routeMode(location.pathname);
  const numericContestId = Number(contestId ?? 0) || undefined;
  const token = useMemo(adminToken, []);
  const isEditing = mode === 'edit';

  const [draft, setDraft] = useState<ContestDraftPayload>(emptyDraft);
  const [step, setStep] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contests, setContests] = useState<AdminContest[]>([]);
  const [classes, setClasses] = useState<AdminOrganizationOption[]>([]);
  const [pendingClassIds, setPendingClassIds] = useState<number[]>([]);
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [folders, setFolders] = useState<Array<{ id: number; name: string; problems: Problem[] }>>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const [testCasesByProblem, setTestCasesByProblem] = useState<Record<number, ProblemTestCasePayload[]>>({});
  const [keyword, setKeyword] = useState('');
  const [listKeyword, setListKeyword] = useState('');
  const [editingHasPassword, setEditingHasPassword] = useState(false);
  const saveTimer = useRef<number | null>(null);

  async function fetchFoldersWithProblems() {
    const result = await adminGet<Array<{ id: number; name: string; problems: Array<{ id: number; title: string; difficulty: number; timeLimit: number; memoryLimit: number; testCaseCount?: number }> }>>('/api/admin/v1/problem-folders');
    return result.map((folder) => ({
      id: folder.id,
      name: folder.name,
      problems: folder.problems.map((p): Problem => ({
        id: `p${p.id}`,
        title: p.title,
        summary: '',
        statement: '',
        inputFormat: '',
        outputFormat: '',
        samples: [],
        difficulty: p.difficulty === 1 ? '入门' : p.difficulty === 2 ? '简单' : p.difficulty === 3 ? '中等' : p.difficulty === 4 ? '困难' : '地狱',
        tags: [],
        timeLimit: p.timeLimit,
        memoryLimit: p.memoryLimit,
        acRate: 0,
        owner: '',
        ownerName: '',
        testCaseCount: p.testCaseCount ?? 0,
        createdAt: '',
        updatedAt: '',
        attemptStatus: null,
        score: 100,
      })),
    }));
  }

  const selectedProblems = draft.problems ?? [];
  const selectedProblemIds = useMemo(
    () => new Set(selectedProblems.map((item) => item.problemId)),
    [selectedProblems],
  );
  const selectedAudienceTypes = initialAudienceTypes(draft);
  const currentAudience: Audience = selectedAudienceTypes.includes('ALL')
    ? 'ALL'
    : 'CLASS';

  const filteredProblems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return problems;
    return problems.filter((item) => item.title.toLowerCase().includes(normalized));
  }, [keyword, problems]);

  const filteredContests = useMemo(() => {
    const normalized = listKeyword.trim().toLowerCase();
    if (!normalized) return contests;
    return contests.filter((item) => item.title.toLowerCase().includes(normalized));
  }, [contests, listKeyword]);

  useEffect(() => {
    if (!token) return;
    if (mode !== 'list' && mode !== 'rankings') return;
    loadContests();
  }, [mode, token]);

  useEffect(() => {
    if (!token) return;
    if (mode !== 'add') return;
    setLoading(true);
    setDraftLoaded(false);
    Promise.all([fetchContestDraft(token), fetchAdminClasses(token), fetchFoldersWithProblems()])
      .then(([remoteDraft, classList, folderList]) => {
        const mergedDraft = { ...emptyDraft, ...(remoteDraft ?? {}) };
        setDraft({
          ...mergedDraft,
          audience: mergedDraft.audience === 'CLASS' ? 'CLASS' : 'ALL',
          audienceTypes: initialAudienceTypes(mergedDraft),
          startTime: mergedDraft.startTime || nowLocalInput(),
        });
        setPendingClassIds(remoteDraft?.classIds ?? []);
        setClasses(classList);
        setFolders(folderList);
        const allProblems = folderList.flatMap((f) => f.problems);
        setProblems(allProblems);
        setEditingHasPassword(false);
        setStep(0);
      })
      .catch((error) => {
        Message.error(error instanceof Error ? error.message : '比赛新增数据加载失败');
      })
      .finally(() => {
        setDraftLoaded(true);
        setLoading(false);
      });
  }, [mode, token]);

  useEffect(() => {
    if (!token || !numericContestId) return;
    if (mode !== 'edit') return;
    setLoading(true);
    setDraftLoaded(false);
    Promise.all([fetchAdminContest(token, numericContestId), fetchAdminClasses(token), fetchFoldersWithProblems()])
      .then(([contest, classList, folderList]) => {
        const classIds = contest.audiences
          .filter((item) => item.audienceType === 'CLASS' && item.audienceId > 0)
          .map((item) => item.audienceId);
        const audienceTypes = contest.audiences.some((item) => item.audienceType === 'ALL')
          ? ['ALL' as const]
          : Array.from(new Set(contest.audiences.map((item) => item.audienceType).filter((item): item is Audience => item === 'ALL' || item === 'CLASS')));

        setDraft({
          title: contest.title,
          durationMinutes: contest.durationMinutes || 180,
          startTime: toDateTimeLocal(contest.startTime),
          description: contest.description || '',
          type: contest.type,
          audience: contest.audience === 'CLASS' ? 'CLASS' : 'ALL',
          audienceTypes: audienceTypes.length ? audienceTypes : [contest.audience === 'CLASS' ? 'CLASS' : 'ALL'],
          classIds,
          frozen: contest.frozen,
          freezeTime: contest.freezeTime ? toDateTimeLocal(contest.freezeTime) : null,
          enableRollingScoreboard: contest.enableRollingScoreboard,
          goldRatio: contest.goldRatio,
          silverRatio: contest.silverRatio,
          bronzeRatio: contest.bronzeRatio,
          allowAfterEndSubmit: contest.allowAfterEndSubmit,
          allowAfterEndViewProblem: contest.allowAfterEndViewProblem,
          allowAfterEndViewCode: contest.allowAfterEndViewCode ?? false,
          publicScoreboardEnabled: contest.publicScoreboardEnabled,
          showClassOnScoreboard: contest.showClassOnScoreboard ?? false,
          allowStarRegistration: contest.allowStarRegistration,
          allowViewAllSubmissions: contest.allowViewAllSubmissions ?? true,
          registrationPassword: '',
          totalScore: contest.problems.reduce((sum, item) => sum + Number(item.score ?? 0), 0) || 100,
          problems: contest.problems.map((item, index) => ({
            contestProblemId: item.contestProblemId,
            problemId: item.problemId,
            label: item.label || labelOf(index),
            score: item.score ?? 0,
            displayOrder: item.displayOrder ?? index + 1,
            caseScores: item.caseScores ?? [],
          })),
        });
        setPendingClassIds(classIds);
        setClasses(classList);
        setFolders(folderList);
        const allProblems = folderList.flatMap((f) => f.problems);
        setProblems(allProblems);
        setEditingHasPassword(contest.hasPassword);
        setStep(0);
      })
      .catch((error) => {
        Message.error(error instanceof Error ? error.message : '比赛编辑数据加载失败');
      })
      .finally(() => {
        setDraftLoaded(true);
        setLoading(false);
      });
  }, [mode, numericContestId, token]);

  useEffect(() => {
    if (mode !== 'add' || !token || !draftLoaded) return;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      setSavingDraft(true);
      saveContestDraft(token, draft)
        .catch((error) => Message.error(error instanceof Error ? error.message : '比赛草稿保存失败'))
        .finally(() => setSavingDraft(false));
    }, 500);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [draft, draftLoaded, mode, token]);

  function updateDraft(next: ContestDraftPayload) {
    setDraft({ ...emptyDraft, ...next });
  }

  async function loadContests() {
    setLoading(true);
    try {
      const result = await fetchAdminContests(token, 1, 200);
      setContests(result.list);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '比赛列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  function chooseAudience(value: Audience) {
    if (value === 'ALL') {
      updateDraft({ ...draft, audience: 'ALL', audienceTypes: ['ALL'], classIds: [] });
      setPendingClassIds([]);
      return;
    }
    setAudienceTypeEnabled(value, true);
  }

  function openClassPicker() {
    setPendingClassIds(draft.classIds ?? []);
    setClassModalVisible(true);
  }

  function setAudienceTypeEnabled(value: Exclude<Audience, 'ALL'>, checked: boolean) {
    if (!checked) {
      const nextTypes = selectedAudienceTypes.filter((item) => item !== 'ALL' && item !== value);
      updateDraft({
        ...draft,
        audience: nextTypes[0] ?? 'ALL',
        audienceTypes: nextTypes.length ? nextTypes : ['ALL'],
        classIds: value === 'CLASS' ? [] : draft.classIds,
      });
      if (value === 'CLASS') setPendingClassIds([]);
      return;
    }

    const nextTypes = Array.from(new Set([...selectedAudienceTypes.filter((item) => item !== 'ALL'), value]));
    updateDraft({
      ...draft,
      audience: value,
      audienceTypes: nextTypes,
    });
    if (value === 'CLASS') {
      openClassPicker();
    }
  }

  function confirmClassPicker() {
    const nextTypes = Array.from(new Set([...selectedAudienceTypes.filter((item) => item !== 'ALL'), 'CLASS' as const]));
    updateDraft({
      ...draft,
      audience: 'CLASS',
      audienceTypes: nextTypes,
      classIds: pendingClassIds,
    });
    setClassModalVisible(false);
  }

  async function clearAll() {
    try {
      if (mode === 'add') {
        await clearContestDraft(token);
      }
      setDraft({ ...emptyDraft, startTime: nowLocalInput() });
      setPendingClassIds([]);
      setEditingHasPassword(false);
      setStep(0);
      Message.success(mode === 'add' ? '比赛草稿已清空' : '比赛表单已清空');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '清空失败');
    }
  }

  function validateBasic() {
    if (!draft.title?.trim()) {
      Message.warning('请填写比赛标题');
      return false;
    }
    if (!draft.startTime) {
      Message.warning('请选择比赛开始时间');
      return false;
    }
    if (!Number(draft.durationMinutes)) {
      Message.warning('请填写比赛时长');
      return false;
    }
    const start = new Date(draft.startTime);
    const duration = Number(draft.durationMinutes ?? 180);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    if (draft.frozen) {
      if (!draft.freezeTime) {
        Message.warning('开启封榜后必须设置封榜时间');
        return false;
      }
      const freeze = new Date(draft.freezeTime);
      if (Number.isNaN(freeze.getTime()) || freeze < start || freeze > end) {
        Message.warning('封榜时间必须在比赛开始和结束时间之间');
        return false;
      }
    }
    const gold = Number(draft.goldRatio ?? 10);
    const silver = Number(draft.silverRatio ?? 20);
    const bronze = Number(draft.bronzeRatio ?? 30);
    if ([gold, silver, bronze].some((value) => value < 0 || value > 100) || gold > silver || silver > bronze) {
      Message.warning('奖牌比例必须在 0 到 100 之间，并满足金牌 ≤ 银牌 ≤ 铜牌');
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateBasic()) return;
    setStep(1);
  }

  async function toggleProblem(problem: Problem) {
    const id = numericProblemId(problem.id);
    if (!id) return;

    const exists = selectedProblemIds.has(id);
    let nextProblems = exists
      ? selectedProblems.filter((item) => item.problemId !== id)
      : [
          ...selectedProblems,
          {
            problemId: id,
            label: labelOf(selectedProblems.length),
            score: 0,
            displayOrder: selectedProblems.length + 1,
            caseScores: [],
          },
        ];

    nextProblems = normalizeSelectedProblems(nextProblems);
    if (draft.type === 'OI') {
      nextProblems = distributeScores(Number(draft.totalScore ?? 100), nextProblems);
    }

    if (!exists && !testCasesByProblem[id]) {
      try {
        const cases = await fetchAdminProblemTestCases(token, id);
        setTestCasesByProblem((current) => ({ ...current, [id]: cases }));
        if (draft.type === 'OI') {
          const problemScore = nextProblems.find((item) => item.problemId === id)?.score ?? 0;
          nextProblems = nextProblems.map((item) =>
            item.problemId === id
              ? { ...item, caseScores: distributeCaseScores(Number(problemScore), cases) }
              : item,
          );
        }
      } catch (error) {
        Message.error(error instanceof Error ? error.message : '测试点加载失败');
      }
    }

    updateDraft({ ...draft, problems: nextProblems });
  }

  function changeContestType(type: ContestType) {
    const nextProblems = type === 'OI'
      ? distributeScores(Number(draft.totalScore ?? 100), selectedProblems)
      : selectedProblems.map((item) => ({ ...item, score: item.score ?? 0 }));
    updateDraft({ ...draft, type, problems: nextProblems });
  }

  function setTotalScore(totalScore: number) {
    const nextProblems = draft.type === 'OI' ? distributeScores(totalScore, selectedProblems) : selectedProblems;
    updateDraft({ ...draft, totalScore, problems: nextProblems });
  }

  function setProblemScore(problemId: number, score: number) {
    updateDraft({
      ...draft,
      problems: selectedProblems.map((item) => {
        if (item.problemId !== problemId) return item;
        const cachedCases = testCasesByProblem[problemId] ?? [];
        const caseScores = cachedCases.length > 0
          ? distributeCaseScores(score, cachedCases)
          : (item.caseScores ?? []);
        return { ...item, score, caseScores };
      }),
    });
  }

  function setCaseScore(problemId: number, caseNo: number, score: number) {
    updateDraft({
      ...draft,
      problems: selectedProblems.map((item) => {
        if (item.problemId !== problemId) return item;
        const current = item.caseScores ?? [];
        const problemScore = Number(item.score ?? 0);
        return {
          ...item,
          caseScores: distributeRemainingCaseScores(problemScore, current, caseNo, score),
        };
      }),
    });
  }

  async function submitContest() {
    if (!validateBasic()) {
      setStep(0);
      return;
    }
    if (selectedProblems.length === 0) {
      Message.warning('请选择比赛题目');
      return;
    }

    setSubmitting(true);
    try {
      const currentStartTime = draft.startTime || nowLocalInput();
      const start = new Date(currentStartTime);
      const duration = Number(draft.durationMinutes ?? 180);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const audienceTypes = selectedAudienceTypes.includes('ALL')
        ? ['ALL' as const]
        : selectedAudienceTypes.filter((item) => item !== 'ALL');
      const audiences: NonNullable<ContestPayload['audiences']> = [];

      for (const type of audienceTypes) {
        if (type === 'ALL') {
          audiences.push({ audienceType: 'ALL', audienceId: 0 });
          continue;
        }
        for (const id of draft.classIds?.length ? draft.classIds : [0]) {
          audiences.push({ audienceType: 'CLASS', audienceId: id });
        }
      }

      const registrationPassword = draft.registrationPassword?.trim() ?? '';
      const payload = {
        title: draft.title?.trim() ?? '',
        description: draft.description,
        durationMinutes: duration,
        startTime: toIsoLocal(currentStartTime),
        endTime: toLocalInputValue(end),
        type: draft.type ?? 'ACM',
        audience: audiences[0]?.audienceType ?? 'ALL',
        audienceId: audiences[0]?.audienceId ?? 0,
        audiences,
        registrationType: registrationPassword || editingHasPassword ? 'PASSWORD' : 'PUBLIC',
        ...(registrationPassword ? { registrationPassword } : {}),
        frozen: Boolean(draft.frozen),
        freezeTime: draft.frozen && draft.freezeTime ? toIsoLocal(draft.freezeTime) : null,
        enableRollingScoreboard: Boolean(draft.frozen && draft.enableRollingScoreboard),
        goldRatio: Number(draft.goldRatio ?? 10),
        silverRatio: Number(draft.silverRatio ?? 20),
        bronzeRatio: Number(draft.bronzeRatio ?? 30),
        allowFullscreen: false,
        antiCheatEnabled: false,
        maxSwitches: 3,
        allowAfterEndSubmit: Boolean(draft.allowAfterEndSubmit),
        allowAfterEndViewProblem: draft.allowAfterEndViewProblem !== false,
        allowAfterEndViewCode: Boolean(draft.allowAfterEndViewCode),
        publicScoreboardEnabled: draft.publicScoreboardEnabled !== false,
        showClassOnScoreboard: Boolean(draft.showClassOnScoreboard),
        allowStarRegistration: Boolean(draft.allowStarRegistration),
        allowViewAllSubmissions: draft.allowViewAllSubmissions !== false,
        problems: normalizeSelectedProblems(selectedProblems),
      } satisfies ContestPayload;

      if (isEditing && numericContestId) {
        await updateAdminContest(token, numericContestId, payload);
      } else {
        await createAdminContest(token, payload);
        await clearContestDraft(token);
      }
      Message.success(isEditing ? '比赛已更新' : '比赛已保存');
      navigate(adminPath('/contests'));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeContest(id: number) {
    try {
      await deleteAdminContest(token, id);
      Message.success('删除成功');
      loadContests();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  function problemTitle(problemId: number) {
    return problems.find((problem) => numericProblemId(problem.id) === problemId)?.title ?? String(problemId);
  }

  function openPublicScoreboard(contestIdValue: number) {
    window.open(`/contests/${contestIdValue}/public-scoreboard`, '_blank');
  }

  if (!token) {
    return <Result status="403" title="请先登录后台" />;
  }

  if (mode === 'list' || mode === 'rankings') {
    const columns = [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
        align: 'center' as const,
      },
      {
        title: '比赛名称',
        dataIndex: 'title',
        width: 260,
        render: (_: unknown, record: AdminContest) => (
          <Space direction="vertical" size={2}>
            <Typography.Text bold>{record.title}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.ownerName || `用户 ${record.ownerId}`}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '赛制',
        dataIndex: 'type',
        width: 90,
        align: 'center' as const,
        render: (value: ContestType) => <Tag color={value === 'OI' ? 'purple' : 'arcoblue'}>{value}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        align: 'center' as const,
        render: (value: AdminContest['status']) => <Tag color={statusColor(value)}>{statusText(value)}</Tag>,
      },
      {
        title: '面向群体',
        width: 110,
        align: 'center' as const,
        render: (_: unknown, record: AdminContest) => audienceText(record),
      },
      {
        title: '开始时间',
        dataIndex: 'startTime',
        width: 180,
        render: (value: string) => value ? value.replace('T', ' ').slice(0, 16) : '-',
      },
      {
        title: '时长',
        dataIndex: 'durationMinutes',
        width: 100,
        align: 'center' as const,
        render: (value: number) => `${value} 分钟`,
      },
      {
        title: '参赛 / 提交',
        width: 120,
        align: 'center' as const,
        render: (_: unknown, record: AdminContest) => `${record.participantCount} / ${record.submissionCount}`,
      },
      {
        title: '操作',
        width: mode === 'rankings' ? 180 : 280,
        fixed: 'right' as const,
        align: 'center' as const,
        render: (_: unknown, record: AdminContest) => (
          <Space>
            {mode === 'list' ? (
              <>
                <Button
                  type="text"
                  size="small"
                  icon={<IconFile />}
                  onClick={() => navigate(`/admin/contests/${record.id}`)}
                >
                  查看
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<IconEdit />}
                  onClick={() => navigate(`/admin/contests/${record.id}/edit`)}
                >
                  编辑
                </Button>
              </>
            ) : null}
            <Button type="text" size="small" onClick={() => openPublicScoreboard(record.id)}>
              外榜
            </Button>
            {mode === 'list' ? (
              <Popconfirm title="确定要删除该比赛吗？" onOk={() => removeContest(record.id)}>
                <Button type="text" size="small" status="danger" icon={<IconDelete />}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ];

    return (
      <Card
        title={mode === 'rankings' ? '比赛排行榜' : '比赛列表'}
        extra={
          <Space>
            <Button icon={<IconRefresh />} onClick={loadContests} loading={loading}>
              刷新
            </Button>
            {mode === 'list' ? (
              <Button type="primary" icon={<IconPlus />} onClick={() => navigate(adminPath('/contests/new'))}>
                添加比赛
              </Button>
            ) : null}
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            style={{ width: 320 }}
            placeholder="搜索比赛名称"
            prefix={<IconSearch />}
            allowClear
            value={listKeyword}
            onChange={setListKeyword}
          />
        </div>
        <Table
          loading={loading}
          columns={columns}
          data={filteredContests}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showTotal: true,
          }}
        />
      </Card>
    );
  }

  const problemColumns = [
    {
      title: '题目',
      dataIndex: 'title',
      render: (_: unknown, record: Problem) => (
        <Space direction="vertical" size={2}>
          <Typography.Text bold>{record.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.timeLimit}ms / {record.memoryLimit}MB
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 100,
      align: 'center' as const,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '测试点',
      dataIndex: 'testCaseCount',
      width: 100,
      align: 'center' as const,
      render: (value: number) => value ?? 0,
    },
    {
      title: '操作',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: Problem) => {
        const problemId = numericProblemId(record.id);
        const selected = selectedProblemIds.has(problemId);
        return (
          <Button
            size="small"
            type={selected ? 'outline' : 'primary'}
            status={selected ? 'warning' : 'default'}
            onClick={() => toggleProblem(record)}
          >
            {selected ? '移除' : '选择'}
          </Button>
        );
      },
    },
  ];

  const selectedColumns = [
    {
      title: '编号',
      dataIndex: 'label',
      width: 80,
      align: 'center' as const,
      render: (value: string) => <Tag color="arcoblue">{value}</Tag>,
    },
    {
      title: '题目名称',
      dataIndex: 'problemId',
      render: (value: number) => problemTitle(value),
    },
    {
      title: '测试点',
      dataIndex: 'problemId',
      width: 100,
      align: 'center' as const,
      render: (value: number) => {
        const problem = problems.find((p) => numericProblemId(p.id) === value);
        return problem?.testCaseCount ?? 0;
      },
    },
    {
      title: '分数',
      dataIndex: 'score',
      width: draft.type === 'OI' ? 160 : 100,
      align: 'center' as const,
      render: (_: unknown, record: ContestProblemPayload) => draft.type === 'OI' ? (
        <InputNumber
          min={0}
          value={record.score ?? 0}
          style={{ width: 120 }}
          onChange={(value) => setProblemScore(record.problemId, Number(value) || 0)}
        />
      ) : '-',
    },
    {
      title: '测试点分数',
      width: draft.type === 'OI' ? 360 : 120,
      render: (_: unknown, record: ContestProblemPayload) => {
        if (draft.type !== 'OI') return '-';
        if (!record.caseScores?.length) return <Typography.Text type="secondary">暂无测试点分数</Typography.Text>;
        return (
          <Space wrap>
            {record.caseScores.map((caseScore) => (
              <Space key={caseScore.caseNo} size={4}>
                <Typography.Text type="secondary">#{caseScore.caseNo}</Typography.Text>
                <InputNumber
                  min={0}
                  size="small"
                  value={caseScore.score}
                  style={{ width: 72 }}
                  onChange={(value) => setCaseScore(record.problemId, caseScore.caseNo, Number(value) || 0)}
                />
              </Space>
            ))}
          </Space>
        );
      },
    },
    {
      title: '操作',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: ContestProblemPayload) => (
        <Button
          type="text"
          size="small"
          status="danger"
          icon={<IconDelete />}
          onClick={() => toggleProblem({ id: `p${record.problemId}` } as Problem)}
        >
          移除
        </Button>
      ),
    },
  ];

  return (
    <Spin loading={loading} style={{ width: '100%' }}>
      <Card
        title={isEditing ? '编辑比赛' : '添加比赛'}
        extra={
          <Space>
            <Typography.Text type="secondary">
              {isEditing ? '编辑模式' : savingDraft ? '草稿保存中...' : '草稿自动保存到 Redis'}
            </Typography.Text>
            <Button icon={<IconLeft />} onClick={() => navigate(adminPath('/contests'))}>
              返回列表
            </Button>
          </Space>
        }
      >
        <Steps current={step} style={{ maxWidth: 720, marginBottom: 24 }}>
          <Step title="比赛信息" description="标题、时间、赛制、范围" />
          <Step title="选择题目" description="配置题目与分数" />
        </Steps>

        {step === 0 ? (
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={12}>
                <FormItem label="比赛标题" required>
                  <Input
                    placeholder="请输入比赛标题"
                    value={draft.title ?? ''}
                    onChange={(value) => updateDraft({ ...draft, title: value })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="比赛开始时间" required>
                  <input
                    className="arco-input"
                    type="datetime-local"
                    value={draft.startTime || ''}
                    onChange={(event) => updateDraft({ ...draft, startTime: event.target.value })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="比赛时长（分钟）" required>
                  <InputNumber
                    min={1}
                    style={{ width: '100%' }}
                    value={draft.durationMinutes ?? 180}
                    onChange={(value) => updateDraft({ ...draft, durationMinutes: Number(value) || 1 })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="赛制" required>
                  <RadioGroup
                    type="button"
                    value={draft.type ?? 'ACM'}
                    onChange={(value) => changeContestType(value as ContestType)}
                  >
                    <Radio value="ACM">ACM / ICPC</Radio>
                    <Radio value="OI">OI</Radio>
                  </RadioGroup>
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="是否封榜">
                  <Switch
                    checked={Boolean(draft.frozen)}
                    checkedText="开启"
                    uncheckedText="关闭"
                    onChange={(checked) => updateDraft({
                      ...draft,
                      frozen: checked,
                      freezeTime: checked ? (draft.freezeTime || defaultFreezeTime(draft)) : null,
                      enableRollingScoreboard: checked ? draft.enableRollingScoreboard : false,
                    })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="封榜时间">
                  <input
                    className="arco-input"
                    type="datetime-local"
                    disabled={!draft.frozen}
                    value={draft.freezeTime ?? ''}
                    onChange={(event) => updateDraft({ ...draft, freezeTime: event.target.value })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="启用滚榜">
                  <Switch
                    disabled={!draft.frozen}
                    checked={Boolean(draft.frozen && draft.enableRollingScoreboard)}
                    checkedText="开启"
                    uncheckedText="关闭"
                    onChange={(checked) => updateDraft({ ...draft, enableRollingScoreboard: checked })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="奖牌比例（%）">
                  <Space>
                    <Typography.Text>金</Typography.Text>
                    <InputNumber
                      min={0}
                      max={100}
                      value={draft.goldRatio ?? 10}
                      style={{ width: 86 }}
                      onChange={(value) => updateDraft({ ...draft, goldRatio: Number(value) || 0 })}
                    />
                    <Typography.Text>银</Typography.Text>
                    <InputNumber
                      min={0}
                      max={100}
                      value={draft.silverRatio ?? 20}
                      style={{ width: 86 }}
                      onChange={(value) => updateDraft({ ...draft, silverRatio: Number(value) || 0 })}
                    />
                    <Typography.Text>铜</Typography.Text>
                    <InputNumber
                      min={0}
                      max={100}
                      value={draft.bronzeRatio ?? 30}
                      style={{ width: 86 }}
                      onChange={(value) => updateDraft({ ...draft, bronzeRatio: Number(value) || 0 })}
                    />
                  </Space>
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="赛后允许提交">
                  <Switch
                    checked={Boolean(draft.allowAfterEndSubmit)}
                    checkedText="允许"
                    uncheckedText="禁止"
                    onChange={(checked) => updateDraft({ ...draft, allowAfterEndSubmit: checked })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="赛后查看题目">
                  <Switch
                    checked={draft.allowAfterEndViewProblem !== false}
                    checkedText="允许"
                    uncheckedText="关闭"
                    onChange={(checked) => updateDraft({ ...draft, allowAfterEndViewProblem: checked })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="赛后查看他人代码">
                  <Switch
                    checked={Boolean(draft.allowAfterEndViewCode)}
                    checkedText="允许"
                    uncheckedText="关闭"
                    onChange={(checked) => updateDraft({ ...draft, allowAfterEndViewCode: checked })}
                  />
                  <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
                    开启后，比赛结束后参赛者可在前台所有提交列表查看他人代码
                  </div>
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="公共榜单">
                  <Switch
                    checked={draft.publicScoreboardEnabled !== false}
                    checkedText="开启"
                    uncheckedText="关闭"
                    onChange={(checked) => updateDraft({ ...draft, publicScoreboardEnabled: checked })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="榜单显示班级">
                  <Switch
                    checked={Boolean(draft.showClassOnScoreboard)}
                    checkedText="显示"
                    uncheckedText="隐藏"
                    onChange={(checked) => updateDraft({ ...draft, showClassOnScoreboard: checked })}
                  />
                  <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
                    开启后，比赛详情页榜单与公开榜单将显示参赛者所在班级
                  </div>
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="允许打星报名">
                  <Switch
                    checked={Boolean(draft.allowStarRegistration)}
                    checkedText="允许"
                    uncheckedText="关闭"
                    onChange={(checked) => updateDraft({ ...draft, allowStarRegistration: checked })}
                  />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="查看他人提交状态">
                  <Switch
                    checked={draft.allowViewAllSubmissions !== false}
                    checkedText="允许"
                    uncheckedText="隐藏"
                    onChange={(checked) => updateDraft({ ...draft, allowViewAllSubmissions: checked })}
                  />
                  <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
                    关闭后，比赛期间参赛者只能看到自己的提交状态，他人状态显示为"等待中"
                  </div>
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="比赛密码（可选）">
                  <Input.Password
                    placeholder={isEditing && editingHasPassword ? '留空则保持原密码' : '不填则公开报名'}
                    value={draft.registrationPassword ?? ''}
                    onChange={(value) => updateDraft({ ...draft, registrationPassword: value })}
                  />
                </FormItem>
              </Col>
              <Col span={24}>
                <FormItem label="面向群体" required>
                  <Space direction="vertical" size={8}>
                    <Space wrap>
                      <Radio
                        checked={selectedAudienceTypes.includes('ALL')}
                        onChange={() => chooseAudience('ALL')}
                      >
                        所有人
                      </Radio>
                      <Checkbox
                        checked={selectedAudienceTypes.includes('CLASS')}
                        onChange={(checked) => setAudienceTypeEnabled('CLASS', Boolean(checked))}
                      >
                        班级
                      </Checkbox>
                    </Space>
                    {currentAudience === 'ALL' ? (
                      <Typography.Text type="secondary">所有用户可参赛。</Typography.Text>
                    ) : (
                      <Space size={8} wrap>
                        <Typography.Text type="secondary">
                          已选择 {draft.classIds?.length ?? 0} 个班级；未选择具体班级时，默认所有班级可参赛。
                        </Typography.Text>
                        <Button size="mini" type="text" onClick={openClassPicker}>
                          选择班级
                        </Button>
                      </Space>
                    )}
                  </Space>
                </FormItem>
              </Col>
              <Col span={24}>
                <FormItem label="比赛介绍">
                  <TextArea
                    rows={7}
                    placeholder="请输入比赛介绍"
                    value={draft.description ?? ''}
                    onChange={(value) => updateDraft({ ...draft, description: value })}
                  />
                </FormItem>
              </Col>
            </Row>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button status="danger" icon={<IconDelete />} onClick={clearAll}>
                清空
              </Button>
              <Button type="primary" onClick={goNext}>
                下一步
              </Button>
            </div>
          </Form>
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              {draft.type === 'OI' ? (
                <Space>
                  <Typography.Text>OI 总分</Typography.Text>
                  <InputNumber
                    min={0}
                    value={draft.totalScore ?? 100}
                    style={{ width: 140 }}
                    onChange={(value) => setTotalScore(Number(value) || 0)}
                  />
                </Space>
              ) : <span />}
              <Input.Search
                style={{ width: 320 }}
                placeholder="搜索题目"
                prefix={<IconSearch />}
                allowClear
                value={keyword}
                onChange={setKeyword}
              />
            </Space>

            {/* 文件夹分组选题 */}
            <Card title="按文件夹选题" style={{ maxHeight: 500, overflow: 'auto' }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {folders.map((folder) => {
                  const isExpanded = expandedFolderIds.has(folder.id);
                  const folderProblems = keyword.trim()
                    ? folder.problems.filter((p) => p.title.toLowerCase().includes(keyword.trim().toLowerCase()))
                    : folder.problems;
                  if (folderProblems.length === 0 && keyword.trim()) return null;

                  return (
                    <Card
                      key={folder.id}
                      size="small"
                      style={{ border: '1px solid #e5e6eb' }}
                      headerStyle={{ padding: '8px 16px', cursor: 'pointer' }}
                      title={
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
                          onClick={() => {
                            setExpandedFolderIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(folder.id)) {
                                next.delete(folder.id);
                              } else {
                                next.add(folder.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <Space>
                            <IconFile />
                            <Typography.Text style={{ fontWeight: 600 }}>{folder.name}</Typography.Text>
                            <Tag color="blue" size="small">{folderProblems.length} 题</Tag>
                          </Space>
                          <Button
                            size="mini"
                            type="text"
                            icon={isExpanded ? <IconCode /> : <IconPlus />}
                          >
                            {isExpanded ? '收起' : '展开'}
                          </Button>
                        </div>
                      }
                      bodyStyle={{ padding: 0, display: isExpanded ? 'block' : 'none' }}
                    >
                      <Table
                        columns={problemColumns}
                        data={folderProblems}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    </Card>
                  );
                })}
              </Space>
            </Card>

            <div>
              <Typography.Title heading={6} style={{ marginTop: 0 }}>
                已选题目
              </Typography.Title>
              <Table
                columns={selectedColumns}
                data={selectedProblems}
                rowKey="problemId"
                pagination={false}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setStep(0)}>上一步</Button>
              <Button type="primary" icon={<IconSave />} loading={submitting} onClick={submitContest}>
                {isEditing ? '更新比赛' : '保存比赛'}
              </Button>
            </div>
          </Space>
        )}
      </Card>

      <Modal
        title="选择班级"
        visible={classModalVisible}
        onCancel={() => setClassModalVisible(false)}
        onOk={confirmClassPicker}
        style={{ width: 720 }}
      >
        <CheckboxGroup
          value={pendingClassIds}
          onChange={(values) => setPendingClassIds(values.map((value) => Number(value)))}
          style={{ width: '100%' }}
        >
          <Row gutter={[16, 16]}>
            {classes.map((item) => (
              <Col span={12} key={item.id}>
                <Checkbox value={item.id}>
                  <Space direction="vertical" size={2}>
                    <Typography.Text>{item.name}（{item.id}）</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {item.description || '班级'}
                    </Typography.Text>
                  </Space>
                </Checkbox>
              </Col>
            ))}
          </Row>
        </CheckboxGroup>
      </Modal>
    </Spin>
  );
}
