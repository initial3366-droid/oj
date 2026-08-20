/**
 * 用户Center页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Avatar, Button, Typography, Tabs, Table, Tag, Input, Modal, Spin, Select, message as antdMessage } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CodeViewer } from '../components/common/CodeViewer';
import './UserCenterPage.css';
import {
  applyToClass,
  fetchMe,
  fetchMySubmissions,
  fetchPractices,
  fetchSubmissionDetail,
  updatePassword,
  updateProfile,
  uploadMyAvatar,
  type Practice,
  type SubmissionRecord,
  type UpdateProfilePayload,
} from '../data/apiClient';
import type { UserProfile } from '../data/types';
import { useOjData } from '../data/OjDataProvider';
import { fetchMyContests, type Contest } from '../api/contest';
import { ContestStatusTag } from '../components/common/ContestStatusTag';

/**
 * 格式化DateTime。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 封装提交Time相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function submissionTime(record: SubmissionRecord) {
  return record.submitTime || record.createdAt;
}

/**
 * 渲染用户Center页面，并协调其数据加载、状态和交互。
 */
export function UserCenterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateState } = useOjData();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('submissions');

  // 设置相关状态
  const [profileForm, setProfileForm] = useState({
    username: '',
    displayName: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<UpdateProfilePayload | null>(null);
  const [classJoinForm, setClassJoinForm] = useState({
    classId: '',
    reason: '',
  });
  const [classJoinLoading, setClassJoinLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [classPractices, setClassPractices] = useState<Practice[]>([]);
  const [classPracticeTotal, setClassPracticeTotal] = useState(0);
  const [classPracticePage, setClassPracticePage] = useState(1);
  const [classPracticePageSize, setClassPracticePageSize] = useState(20);

  // 代码查看弹窗
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [codeModalLoading, setCodeModalLoading] = useState(false);
  const [codeModalCode, setCodeModalCode] = useState('');
  const [codeModalLanguage, setCodeModalLanguage] = useState('');
  const [codeModalTitle, setCodeModalTitle] = useState('');

  // 提交列表筛选和分页
  const [subKeyword, setSubKeyword] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [subLangFilter, setSubLangFilter] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(20);
  const [classPracticeKeyword, setClassPracticeKeyword] = useState('');
  const [classPracticeLoading, setClassPracticeLoading] = useState(false);

  // 我的比赛：列表、分页与加载状态
  const [myContests, setMyContests] = useState<Contest[]>([]);
  const [myContestsTotal, setMyContestsTotal] = useState(0);
  const [myContestsPage, setMyContestsPage] = useState(1);
  const [myContestsLoading, setMyContestsLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('qoj.accessToken');
    if (!token) {
      setUser(null);
      return;
    }
    Promise.all([fetchMe(token), fetchMySubmissions(1, 500)])
      .then(([data, submissionData]) => {
        setUser(data);
        setSubmissions(submissionData);
        setMessage('');
        // 初始化表单
        setProfileForm({
          username: data.username,
          displayName: data.displayName,
        });
      })
      .catch((error) => {
        setUser(null);
        setSubmissions([]);
        setMessage(error instanceof Error ? error.message : '用户信息加载失败');
      });
  }, []);

  // 根据 URL 参数设置活动选项卡和提交筛选
  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'overview' ? 'submissions' : (tab || 'submissions'));
    const sp = searchParams.get('subPage');
    if (sp) setSubPage(Number(sp) || 1);
    const ss = searchParams.get('subStatus');
    if (ss) setSubStatusFilter(ss);
    const sl = searchParams.get('subLang');
    if (sl) setSubLangFilter(sl);
    const sk = searchParams.get('subSearch');
    if (sk) setSubKeyword(sk);
  }, [searchParams]);

  // 更新 URL 以反映当前 tab 和提交筛选状态
  const updateSubUrl = (overrides: Record<string, string | number> = {}) => {
    const params = new URLSearchParams(searchParams);
    const merged = {
      tab: activeTab,
      subPage: subPage,
      subStatus: subStatusFilter,
      subLang: subLangFilter,
      subSearch: subKeyword,
      ...overrides,
    };
    // 只保留非默认值
    params.set('tab', merged.tab);
    if (merged.subPage && merged.subPage !== 1) params.set('subPage', String(merged.subPage));
    else params.delete('subPage');
    if (merged.subStatus) params.set('subStatus', merged.subStatus);
    else params.delete('subStatus');
    if (merged.subLang) params.set('subLang', merged.subLang);
    else params.delete('subLang');
    if (merged.subSearch) params.set('subSearch', merged.subSearch);
    else params.delete('subSearch');
    navigate(`/user-center?${params.toString()}`, { replace: true });
  };

  // 筛选后的提交列表
  const filteredSubmissions = useMemo(() => {
    let list = submissions;
    if (subKeyword) {
      const kw = subKeyword.toLowerCase();
      list = list.filter(s =>
        String(s.problemId).includes(kw) ||
        (s.problemTitle || '').toLowerCase().includes(kw)
      );
    }
    if (subStatusFilter) {
      list = list.filter(s => s.status.toUpperCase() === subStatusFilter.toUpperCase());
    }
    if (subLangFilter) {
      list = list.filter(s => s.language.toLowerCase() === subLangFilter.toLowerCase());
    }
    return list;
  }, [submissions, subKeyword, subStatusFilter, subLangFilter]);

  // 分页后的提交列表
  const pagedSubmissions = useMemo(() => {
    const start = (subPage - 1) * subPageSize;
    return filteredSubmissions.slice(start, start + subPageSize);
  }, [filteredSubmissions, subPage, subPageSize]);

  // 重置页码当筛选变化时
  useEffect(() => {
    setSubPage(1);
  }, [subKeyword, subStatusFilter, subLangFilter]);

  // 我的比赛：仅在进入该 Tab 时按页加载
  useEffect(() => {
    if (activeTab !== 'my-contests') return;
    setMyContestsLoading(true);
    fetchMyContests(myContestsPage, 10)
      .then(({ total, list }) => {
        setMyContestsTotal(total);
        setMyContests(list);
      })
      .catch(() => {
        setMyContestsTotal(0);
        setMyContests([]);
      })
      .finally(() => setMyContestsLoading(false));
  }, [activeTab, myContestsPage]);

  // 我的比赛列定义
  const myContestColumns = useMemo<TableColumnsType<Contest>>(() => [
    {
      title: '比赛名称',
      dataIndex: 'title',
      render: (title: string, record) => (
        <button
          type="button"
          className="uc-contest-button"
          onClick={() => navigate(`/contests/${record.id}`)}
        >
          {title}
        </button>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'ACM' ? 'blue' : 'purple'} style={{ fontWeight: 500 }}>
          {type}
        </Tag>
      ),
    },
    {
      title: '比赛时间',
      dataIndex: 'startTime',
      width: 340,
      render: (start: string, record) => `${formatDateTime(start)} ~ ${formatDateTime(record.endTime)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => <ContestStatusTag status={status} size="small" />,
    },
  ], [navigate]);

  // 邮箱验证码倒计时
  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  // 获取图形验证码
  const fetchCaptcha = async () => {
    try {
      const response = await fetch('/api/v1/captcha/image');
      const result = await response.json();
      if (result.code === 200) {
        setCaptchaImage(result.data.image);
        setCaptchaId(result.data.captchaId);
      }
    } catch (error) {
      antdMessage.error('验证码加载失败');
    }
  };

  // 发送邮箱验证码
  const sendEmailCode = async () => {
    if (!captchaInput || !captchaId) {
      antdMessage.error('请先输入图形验证码');
      return;
    }
    if (!user?.email) {
      antdMessage.error('您的账号未绑定邮箱');
      return;
    }
    try {
      const response = await fetch('/api/v1/captcha/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          captchaId: captchaId,
          captcha: captchaInput
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        antdMessage.success('验证码已发送到您的邮箱');
        setEmailCountdown(result.data.remainingSeconds || 60);
        fetchCaptcha();
      } else {
        antdMessage.error(result.message || '发送失败');
        fetchCaptcha();
      }
    } catch (error) {
      antdMessage.error('发送失败，请稍后重试');
      fetchCaptcha();
    }
  };


  /**
   * 处理头像FileChange。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
   */
  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      antdMessage.error('请选择图片文件');
      return;
    }
    try {
      const token = window.localStorage.getItem('qoj.accessToken');
      if (!token) return;
      setAvatarUploading(true);
      await uploadMyAvatar(file, token);
      const newUser = await fetchMe(token);
      setUser(newUser);
      const userId = Number(newUser.id.replace(/^u/, ''));
      updateState((current) => ({
        ...current,
        activeUser: newUser,
        ratings: current.ratings.map((rating) =>
          rating.userId === userId
            ? { ...rating, avatarUrl: newUser.avatarUrl }
            : rating,
        ),
      }));
      antdMessage.success('头像已更新');
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : '头像上传失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  // 提交个人信息修改
  const handleProfileSubmit = () => {
    const payload: UpdateProfilePayload = {
      emailVerificationCode: '',
    };

    const username = profileForm.username.trim();
    const displayName = profileForm.displayName.trim();

    if (username !== user?.username) {
      if (profileForm.username.length < 3 || profileForm.username.length > 15) {
        antdMessage.error('用户名长度必须在3-15之间');
        return;
      }
      payload.username = username;
    }

    if (displayName !== user?.displayName) {
      if (!displayName) {
        antdMessage.error('显示名称不能为空');
        return;
      }
      payload.displayName = displayName;
    }

    if (!payload.username && !payload.displayName) {
      antdMessage.warning('没有修改任何信息');
      return;
    }

    // 打开邮箱验证码弹窗
    setPendingProfileUpdate(payload);
    setEmailModalVisible(true);
    fetchCaptcha();
  };

  // 确认修改个人信息
  const confirmProfileUpdate = async () => {
    if (!pendingProfileUpdate || !emailCode) {
      antdMessage.error('请输入邮箱验证码');
      return;
    }

    try {
      const token = window.localStorage.getItem('qoj.accessToken');
      if (!token) return;

      await updateProfile({
        ...pendingProfileUpdate,
        emailVerificationCode: emailCode,
      }, token);

      antdMessage.success('修改成功');
      setEmailModalVisible(false);
      setEmailCode('');
      setCaptchaInput('');
      setPendingProfileUpdate(null);

      // 重新加载用户信息
      const newUser = await fetchMe(token);
      setUser(newUser);
      updateState((current) => ({ ...current, activeUser: newUser }));
      setProfileForm({
        username: newUser.username,
        displayName: newUser.displayName,
      });
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : '修改失败');
    }
  };

  // 提交密码修改
  const handlePasswordSubmit = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      antdMessage.error('请填写完整信息');
      return;
    }

    if (passwordForm.newPassword.length < 6 || passwordForm.newPassword.length > 20) {
      antdMessage.error('新密码长度必须在6-20之间');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      antdMessage.error('两次密码不一致');
      return;
    }

    try {
      const token = window.localStorage.getItem('qoj.accessToken');
      if (!token) return;

      await updatePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      }, token);

      antdMessage.success('密码修改成功');
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : '修改失败');
    }
  };

  useEffect(() => {
    if (activeTab !== 'class-practices' || !user?.classId) {
      return;
    }
    let cancelled = false;
    setClassPracticeLoading(true);
    fetchPractices(classPracticePage, classPracticePageSize, 'class')
      .then((data) => {
        if (!cancelled) {
          setClassPractices(data.list);
          setClassPracticeTotal(data.total);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          antdMessage.error(error instanceof Error ? error.message : '班级题单加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClassPracticeLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, user?.classId, classPracticePage, classPracticePageSize]);

  /**
   * 处理ApplyTo班级。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const handleApplyToClass = async () => {
    const classId = Number(classJoinForm.classId);
    if (!Number.isInteger(classId) || classId <= 0) {
      antdMessage.error('请输入有效的班级 ID');
      return;
    }
    setClassJoinLoading(true);
    setApplySuccess(false);
    try {
      await applyToClass(classId, { reason: classJoinForm.reason.trim() || undefined });
      antdMessage.success('入班申请已发送，请等待教师审核');
      setClassJoinForm({ classId: '', reason: '' });
      setApplySuccess(true);
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : '申请发送失败');
    } finally {
      setClassJoinLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="uc-login-card">
        <div className="uc-login-title">请先登录</div>
        <div className="uc-login-desc">{message || '登录后查看真实用户信息和提交数据。'}</div>
        <div className="uc-login-actions">
          <Button type="primary" onClick={() => { window.location.href = '/login'; }}>登录</Button>
          <Button type="text" onClick={() => { window.location.href = '/register'; }}>注册</Button>
        </div>
      </div>
    );
  }

  const acRatio = user.totalSubmissions ? Math.round((user.totalSolved / user.totalSubmissions) * 100) : 0;
  /**
   * 读取状态Color并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getStatusColor = (status: string): 'green' | 'red' | 'orange' | 'blue' | 'default' => {
    const normalized = status.toUpperCase();
    if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
    if (normalized === 'WA' || normalized === 'WRONG_ANSWER' || normalized === 'RE' || normalized === 'RUNTIME_ERROR' || normalized === 'CE' || normalized === 'COMPILE_ERROR') return 'red';
    if (normalized === 'TLE' || normalized === 'TIME_LIMIT_EXCEEDED' || normalized === 'MLE' || normalized === 'MEMORY_LIMIT_EXCEEDED') return 'orange';
    if (['WAITING', 'PENDING', 'QUEUED', 'REJUDGE_PENDING', 'JUDGING', 'COMPILING', 'RUNNING'].includes(normalized)) return 'blue';
    return 'default';
  };

  /**
   * 读取状态Label并返回给调用方。将后端返回的状态缩写映射为英文全称。
   */
  const statusLabel = (status: string): string => {
    const normalized = status.toUpperCase();
    const labels: Record<string, string> = {
      AC: 'Accepted',
      ACCEPTED: 'Accepted',
      WA: 'Wrong Answer',
      WRONG_ANSWER: 'Wrong Answer',
      TLE: 'Time Limit Exceeded',
      TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
      MLE: 'Memory Limit Exceeded',
      MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
      RE: 'Runtime Error',
      RUNTIME_ERROR: 'Runtime Error',
      CE: 'Compile Error',
      COMPILE_ERROR: 'Compile Error',
      COMPILATION_ERROR: 'Compile Error',
      SE: 'System Error',
      SYSTEM_ERROR: 'System Error',
      WAITING: 'Waiting',
      PENDING: 'Pending',
      QUEUED: 'Pending',
      REJUDGE_PENDING: 'Rejudge Pending',
      COMPILING: 'Compiling',
      JUDGING: 'Judging',
      RUNNING: 'Running',
    };
    return labels[normalized] ?? status;
  };

  /**
   * 封装open编码Modal相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const openCodeModal = async (submission: SubmissionRecord) => {
    setCodeModalTitle(submission.problemTitle || `题目 ${submission.problemId}`);
    setCodeModalLanguage(submission.language);
    setCodeModalCode('');
    setCodeModalVisible(true);
    setCodeModalLoading(true);
    try {
      const detail = await fetchSubmissionDetail(submission.id);
      setCodeModalCode(detail.code || '// 代码不可用');
      setCodeModalLanguage(detail.language || submission.language);
    } catch (error) {
      setCodeModalCode(`// ${error instanceof Error ? error.message : '加载失败'}`);
    } finally {
      setCodeModalLoading(false);
    }
  };

  const submissionColumns: TableColumnsType<SubmissionRecord> = [
    {
      title: '题目',
      dataIndex: 'problemTitle',
      render: (title: string, record: SubmissionRecord) => (
        <Typography.Text
          style={{ fontSize: 14, color: '#2563eb', cursor: 'pointer' }}
          onClick={() => openCodeModal(record)}
        >
          {title || `题目 ${record.problemId}`}
        </Typography.Text>
      ),
    },
    {
      title: '结果',
      dataIndex: 'status',
      width: 200,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} style={{ fontSize: 12 }}>
          {statusLabel(status)}
        </Tag>
      ),
    },
    {
      title: '语言',
      dataIndex: 'language',
      width: 100,
      render: (language: string) => <Typography.Text style={{ fontSize: 14 }}>{language}</Typography.Text>,
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      width: 180,
      render: (_time: string, record: SubmissionRecord) => (
        <Typography.Text type="secondary" style={{ fontSize: 14 }}>
          {formatDateTime(submissionTime(record))}
        </Typography.Text>
      ),
    },
  ];

  const filteredClassPractices = classPracticeKeyword.trim()
    ? classPractices.filter((practice) => {
        const query = classPracticeKeyword.trim().toLowerCase();
        return practice.title.toLowerCase().includes(query) || practice.description.toLowerCase().includes(query);
      })
    : classPractices;

  const classPracticeColumns: TableColumnsType<Practice> = [
    {
      title: '题单名称',
      dataIndex: 'title',
      render: (title: string, record: Practice) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ tooltip: <span>{title}</span> }}>{title}</Typography.Text>
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 1, tooltip: <span>{record.description || '暂无说明'}</span> }} style={{ margin: '4px 0 0', fontSize: 13 }}>
            {record.description || '暂无说明'}
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: '题目',
      dataIndex: 'problems',
      width: 100,
      render: (problems: Practice['problems']) => `${problems.length} 题`,
    },
    {
      title: '权限',
      dataIndex: 'hasPassword',
      width: 100,
      render: (hasPassword: boolean) => hasPassword ? <Tag color="orange">密码</Tag> : <Tag color="green">可进入</Tag>,
    },
    {
      title: '操作',
      width: 120,
      render: (_value: unknown, record: Practice) => (
        <Button
          className="uc-practice-view-button"
          size="small"
          type="primary"
          onClick={() => navigate(`/practice/${record.id}`)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="uc-page">
      {/* Profile card */}
      <div className="uc-profile-card">
        <div className="uc-profile-inner">
          <div className="uc-avatar-section">
            <Avatar size={64} src={user.avatarUrl || undefined} style={{ backgroundColor: '#3b82f6' }}>
              {!user.avatarUrl && (user.name?.charAt(0).toUpperCase() || 'U')}
            </Avatar>
            <div>
              <div className="uc-avatar-name">{user.displayName || user.username}</div>
              <div className="uc-avatar-handle">
                @{user.username}{user.studentNo ? ` · ${user.studentNo}` : ''}
              </div>
              <Tag color="blue" className="uc-role-tag">{user.role}</Tag>
              <div className="uc-avatar-actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                  style={{ display: 'none' }}
                  onChange={handleAvatarFileChange}
                />
                <Button
                  className="uc-avatar-button"
                  size="small"
                  type="primary"
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  修改头像
                </Button>
              </div>
            </div>
          </div>

          <div className="uc-stats">
            <div className="uc-stat-card uc-stat-card--rate">
              <div className="uc-stat-label">通过率</div>
              <div className="uc-stat-value">{acRatio}%</div>
            </div>
            <div className="uc-stat-card uc-stat-card--ac">
              <div className="uc-stat-label">非比赛 AC</div>
              <div className="uc-stat-value">{user.totalSolved}</div>
            </div>
            <div className="uc-stat-card uc-stat-card--sub">
              <div className="uc-stat-label">非比赛提交</div>
              <div className="uc-stat-value">{user.totalSubmissions}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs card */}
      <div className="uc-tabs-card">
        <Tabs
          type="line"
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            const params = new URLSearchParams(searchParams);
            params.set('tab', key);
            if (key !== 'submissions') {
              params.delete('subPage');
              params.delete('subStatus');
              params.delete('subLang');
              params.delete('subSearch');
            }
            navigate(`/user-center?${params.toString()}`, { replace: true });
          }}
          items={[
            {
              key: 'submissions',
              label: '最近提交',
              children: (
                <>
                  <div className="uc-filter-bar">
                    <Input
                      placeholder="搜索题目 ID 或名称"
                      value={subKeyword}
                      onChange={(e) => { const v = e.target.value; setSubKeyword(v); updateSubUrl({ subSearch: v, subPage: 1 }); }}
                      style={{ width: 200 }}
                      allowClear
                    />
                    <Select
                      placeholder="状态筛选"
                      value={subStatusFilter || undefined}
                      onChange={(v) => { const val = (typeof v === 'string' ? v : '') as string; setSubStatusFilter(val); updateSubUrl({ subStatus: val, subPage: 1 }); }}
                      style={{ width: 200 }}
                      allowClear
                      options={[
                        { label: statusLabel('AC'), value: 'AC' },
                        { label: statusLabel('WA'), value: 'WA' },
                        { label: statusLabel('TLE'), value: 'TLE' },
                        { label: statusLabel('MLE'), value: 'MLE' },
                        { label: statusLabel('RE'), value: 'RE' },
                        { label: statusLabel('CE'), value: 'CE' },
                        { label: statusLabel('SE'), value: 'SE' },
                      ]}
                    />
                    <Select
                      placeholder="语言筛选"
                      value={subLangFilter || undefined}
                      onChange={(v) => { const val = (typeof v === 'string' ? v : '') as string; setSubLangFilter(val); updateSubUrl({ subLang: val, subPage: 1 }); }}
                      style={{ width: 130 }}
                      allowClear
                      options={
                        Array.from(new Set(submissions.map(s => s.language)))
                          .sort()
                          .map(lang => ({ label: lang, value: lang }))
                      }
                    />
                  </div>
                  <Table
                    columns={submissionColumns}
                    dataSource={pagedSubmissions}
                    rowKey="id"
                    pagination={{
                      current: subPage,
                      pageSize: subPageSize,
                      total: filteredSubmissions.length,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50],
                      showTotal: (total) => `共 ${total} 条`,
                      onChange: (page) => { setSubPage(page); updateSubUrl({ subPage: page }); },
                      onShowSizeChange: (_current, size) => { setSubPageSize(size); setSubPage(1); updateSubUrl({ subPage: 1 }); },
                    }}
                    locale={{ emptyText: <div className="uc-empty">{subKeyword || subStatusFilter || subLangFilter ? '没有匹配的记录' : '暂无提交记录'}</div> }}
                  />
                </>
              ),
            },
            {
              key: 'my-contests',
              label: '我的比赛',
              children: (
                <Table
                  columns={myContestColumns}
                  dataSource={myContests}
                  rowKey="id"
                  loading={myContestsLoading}
                  pagination={{
                    current: myContestsPage,
                    pageSize: 10,
                    total: myContestsTotal,
                    showSizeChanger: false,
                    showTotal: (total) => `共 ${total} 场`,
                    onChange: (page) => setMyContestsPage(page),
                  }}
                  locale={{ emptyText: <div className="uc-empty">暂无比赛记录</div> }}
                />
              ),
            },
            ...(user.classId
              ? [
                  {
                    key: 'class-practices',
                    label: '班级题单',
                    children: (
                      <>
                        <div className="uc-filter-bar">
                          <Input
                            placeholder="筛选题单"
                            value={classPracticeKeyword}
                            onChange={(e) => setClassPracticeKeyword(e.target.value)}
                            style={{ width: 240 }}
                          />
                        </div>
                        <Table
                          columns={classPracticeColumns}
                          dataSource={filteredClassPractices}
                          rowKey="id"
                          loading={classPracticeLoading}
                          pagination={{
                            current: classPracticePage,
                            pageSize: classPracticePageSize,
                            total: classPracticeTotal,
                            showSizeChanger: true,
                            pageSizeOptions: [10, 20, 50],
                            showTotal: (total) => `共 ${total} 条`,
                            onChange: (page) => setClassPracticePage(page),
                            onShowSizeChange: (_current, size) => {
                              setClassPracticePageSize(size);
                              setClassPracticePage(1);
                            },
                          }}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'my-class',
                    label: '我的班级',
                    children: (
                      <div className="uc-form-section">
                        <div className="uc-form-title">我的班级</div>
                        <div className="uc-class-card">
                          <div className="uc-class-icon">🏫</div>
                          <div>
                            <div className="uc-class-name">{user.className || `班级 #${user.classId}`}</div>
                            <div className="uc-class-id">班级 ID：{user.classId}</div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ]
              : [
                  {
                    key: 'join-class',
                    label: '加入班级',
                    children: (
                      <div className="uc-form-section">
                        <div className="uc-form-title">发送入班申请</div>

                        {applySuccess && (
                          <div className="uc-success-banner">
                            申请已发送成功！请等待教师审核，审核结果会在此页面显示。
                          </div>
                        )}

                        <div className="uc-form-group">
                          <div>
                            <label className="uc-field-label">班级 ID <span className="uc-required">*</span></label>
                            <Input
                              placeholder="请输入班级 ID"
                              value={classJoinForm.classId}
                              onChange={(e) => setClassJoinForm({ ...classJoinForm, classId: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="uc-field-label">申请备注</label>
                            <Input.TextArea
                              placeholder="可以简单说明你的姓名、学号或加入原因"
                              value={classJoinForm.reason}
                              autoSize={{ minRows: 3, maxRows: 6 }}
                              maxLength={500}
                              showCount
                              onChange={(e) => setClassJoinForm({ ...classJoinForm, reason: e.target.value })}
                            />
                          </div>
                          <Button type="primary" loading={classJoinLoading} onClick={handleApplyToClass}>
                            发送申请
                          </Button>
                        </div>
                      </div>
                    ),
                  },
                ]),
            {
              key: 'settings',
              label: '设置',
              children: (
                <div className="uc-settings">
                  <div className="uc-settings-section">
                    <div className="uc-settings-title">个人信息</div>
                    <div className="uc-settings-form">
                      <div>
                        <label className="uc-field-label">用户名</label>
                        <Input
                          placeholder="请输入用户名（3-15个字符）"
                          value={profileForm.username}
                          onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="uc-field-label">显示名称</label>
                        <Input
                          placeholder="请输入显示名称"
                          value={profileForm.displayName}
                          onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                        />
                      </div>
                      <Button type="primary" className="uc-btn-primary" onClick={handleProfileSubmit}>
                        保存个人信息
                      </Button>
                    </div>
                  </div>

                  <div className="uc-settings-section">
                    <div className="uc-settings-title">修改密码</div>
                    <div className="uc-settings-form">
                      <div>
                        <label className="uc-field-label">旧密码</label>
                        <Input
                          type="password"
                          placeholder="请输入旧密码"
                          value={passwordForm.oldPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="uc-field-label">新密码</label>
                        <Input
                          type="password"
                          placeholder="请输入新密码（6-20个字符）"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="uc-field-label">确认新密码</label>
                        <Input
                          type="password"
                          placeholder="请再次输入新密码"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        />
                      </div>
                      <Button type="primary" className="uc-btn-primary" onClick={handlePasswordSubmit}>
                        修改密码
                      </Button>
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* 邮箱验证码弹窗 */}
      <Modal
        title="邮箱验证码"
        open={emailModalVisible}
        onOk={confirmProfileUpdate}
        onCancel={() => {
          setEmailModalVisible(false);
          setEmailCode('');
          setCaptchaInput('');
          setPendingProfileUpdate(null);
        }}
        okText="确认修改"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 120px' }}>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>验证码</Typography.Text>
              <Input placeholder="请输入验证码" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} />
            </div>
            {captchaImage && (
              <img src={captchaImage} alt="验证码" style={{ marginTop: 28, height: 40, borderRadius: 6, border: '1px solid var(--qoj-color-border)', cursor: 'pointer' }} onClick={fetchCaptcha} />
            )}
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr auto' }}>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>邮箱验证码</Typography.Text>
              <Input placeholder="请输入邮箱验证码" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
            </div>
            <Button style={{ marginTop: 28, height: 40, minWidth: 120 }} onClick={sendEmailCode} disabled={emailCountdown > 0}>
              {emailCountdown > 0 ? `${emailCountdown}秒后重试` : '发送验证码'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 提交代码查看弹窗 */}
      <Modal
        title={codeModalTitle}
        open={codeModalVisible}
        onCancel={() => setCodeModalVisible(false)}
        footer={null}
        width="60%"
        style={{ top: 40 }}
        styles={{ body: { padding: '16px 24px 24px' } }}
      >
        {codeModalLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400, gap: 8 }}>
            <Spin size="large" />
            <Typography.Text type="secondary">加载代码中...</Typography.Text>
          </div>
        ) : (
          <CodeViewer code={codeModalCode} language={codeModalLanguage} height="60vh" />
        )}
      </Modal>
    </div>
  );
}
