/**
 * 用户Center页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Avatar, Button, Progress, Typography, Tabs, TabPane, Table, Tag, Input, Modal, Toast, TextArea, Spin, Select } from '@douyinfe/semi-ui';
import { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
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
  const [activeTab, setActiveTab] = useState('overview');

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
    if (tab) {
      setActiveTab(tab);
    }
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
      Toast.error('验证码加载失败');
    }
  };

  // 发送邮箱验证码
  const sendEmailCode = async () => {
    if (!captchaInput || !captchaId) {
      Toast.error('请先输入图形验证码');
      return;
    }
    if (!user?.email) {
      Toast.error('您的账号未绑定邮箱');
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
        Toast.success('验证码已发送到您的邮箱');
        setEmailCountdown(result.data.remainingSeconds || 60);
        fetchCaptcha();
      } else {
        Toast.error(result.message || '发送失败');
        fetchCaptcha();
      }
    } catch (error) {
      Toast.error('发送失败，请稍后重试');
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
      Toast.error('请选择图片文件');
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
      Toast.success('头像已更新');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '头像上传失败');
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
        Toast.error('用户名长度必须在3-15之间');
        return;
      }
      payload.username = username;
    }

    if (displayName !== user?.displayName) {
      if (!displayName) {
        Toast.error('显示名称不能为空');
        return;
      }
      payload.displayName = displayName;
    }

    if (!payload.username && !payload.displayName) {
      Toast.warning('没有修改任何信息');
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
      Toast.error('请输入邮箱验证码');
      return;
    }

    try {
      const token = window.localStorage.getItem('qoj.accessToken');
      if (!token) return;

      await updateProfile({
        ...pendingProfileUpdate,
        emailVerificationCode: emailCode,
      }, token);

      Toast.success('修改成功');
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
      Toast.error(error instanceof Error ? error.message : '修改失败');
    }
  };

  // 提交密码修改
  const handlePasswordSubmit = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      Toast.error('请填写完整信息');
      return;
    }

    if (passwordForm.newPassword.length < 6 || passwordForm.newPassword.length > 20) {
      Toast.error('新密码长度必须在6-20之间');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Toast.error('两次密码不一致');
      return;
    }

    try {
      const token = window.localStorage.getItem('qoj.accessToken');
      if (!token) return;

      await updatePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      }, token);

      Toast.success('密码修改成功');
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '修改失败');
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
          Toast.error(error instanceof Error ? error.message : '班级题单加载失败');
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
      Toast.error('请输入有效的班级 ID');
      return;
    }
    setClassJoinLoading(true);
    setApplySuccess(false);
    try {
      await applyToClass(classId, { reason: classJoinForm.reason.trim() || undefined });
      Toast.success('入班申请已发送，请等待教师审核');
      setClassJoinForm({ classId: '', reason: '' });
      setApplySuccess(true);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '申请发送失败');
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
          <Button theme="borderless" onClick={() => { window.location.href = '/register'; }}>注册</Button>
        </div>
      </div>
    );
  }

  const acRatio = user.totalSubmissions ? Math.round((user.totalSolved / user.totalSubmissions) * 100) : 0;
  const favoriteLanguage = submissions.reduce<Record<string, number>>((count, submission) => {
    count[submission.language] = (count[submission.language] ?? 0) + 1;
    return count;
  }, {});
  const topLanguage = Object.entries(favoriteLanguage).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '暂无';

  /**
   * 读取状态Color并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getStatusColor = (status: string): 'green' | 'red' | 'orange' | 'blue' | 'grey' => {
    const normalized = status.toUpperCase();
    if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
    if (normalized === 'WA' || normalized === 'WRONG_ANSWER' || normalized === 'RE' || normalized === 'RUNTIME_ERROR' || normalized === 'CE' || normalized === 'COMPILE_ERROR') return 'red';
    if (normalized === 'TLE' || normalized === 'TIME_LIMIT_EXCEEDED' || normalized === 'MLE' || normalized === 'MEMORY_LIMIT_EXCEEDED') return 'orange';
    if (['WAITING', 'PENDING', 'QUEUED', 'REJUDGE_PENDING', 'JUDGING', 'COMPILING', 'RUNNING'].includes(normalized)) return 'blue';
    return 'grey';
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

  const submissionColumns: ColumnProps<SubmissionRecord>[] = [
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
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} size="small">
          {status}
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
        <Typography.Text type="tertiary" style={{ fontSize: 14 }}>
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

  const classPracticeColumns: ColumnProps<Practice>[] = [
    {
      title: '题单名称',
      dataIndex: 'title',
      render: (title: string, record: Practice) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ showTooltip: true }}>{title}</Typography.Text>
          <Typography.Paragraph type="tertiary" ellipsis={{ rows: 1, showTooltip: true }} style={{ margin: '4px 0 0', fontSize: 13 }}>
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
          theme="solid"
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
            <Avatar size="extra-large" color="blue" src={user.avatarUrl || undefined}>
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
                  theme="solid"
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  修改头像
                </Button>
              </div>
            </div>
          </div>

          <div className="uc-stats">
            <div className="uc-stat-card uc-stat-card--lang">
              <div className="uc-stat-label">常用语言</div>
              <div className="uc-stat-value">{topLanguage}</div>
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
        <Tabs type="line" activeKey={activeTab} onChange={(key) => {
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
        }}>
          <TabPane tab="训练概览" itemKey="overview">
            <div className="uc-over-section">
              <div className="uc-over-row">
                <span>通过率</span>
                <span className="uc-over-pct">{acRatio}%</span>
              </div>
              <Progress percent={acRatio} stroke="var(--semi-color-success)" showInfo={false} />
            </div>
          </TabPane>
          <TabPane tab="最近提交" itemKey="submissions">
            <div className="uc-filter-bar">
              <Input
                placeholder="搜索题目 ID 或名称"
                value={subKeyword}
                onChange={(v) => { setSubKeyword(v); updateSubUrl({ subSearch: v, subPage: 1 }); }}
                style={{ width: 200 }}
                showClear
              />
              <Select
                placeholder="状态筛选"
                value={subStatusFilter || undefined}
                onChange={(v) => { const val = (typeof v === 'string' ? v : '') as string; setSubStatusFilter(val); updateSubUrl({ subStatus: val, subPage: 1 }); }}
                style={{ width: 130 }}
                showClear
                optionList={[
                  { label: 'AC', value: 'AC' },
                  { label: 'WA', value: 'WA' },
                  { label: 'TLE', value: 'TLE' },
                  { label: 'MLE', value: 'MLE' },
                  { label: 'RE', value: 'RE' },
                  { label: 'CE', value: 'CE' },
                  { label: 'SE', value: 'SE' },
                ]}
              />
              <Select
                placeholder="语言筛选"
                value={subLangFilter || undefined}
                onChange={(v) => { const val = (typeof v === 'string' ? v : '') as string; setSubLangFilter(val); updateSubUrl({ subLang: val, subPage: 1 }); }}
                style={{ width: 130 }}
                showClear
                optionList={
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
                currentPage: subPage,
                pageSize: subPageSize,
                total: filteredSubmissions.length,
                showSizeChanger: true,
                pageSizeOpts: [10, 20, 50],
                showTotal: true,
                onPageChange: (page) => { setSubPage(page); updateSubUrl({ subPage: page }); },
                onPageSizeChange: (size) => { setSubPageSize(size); setSubPage(1); updateSubUrl({ subPage: 1 }); },
              }}
              empty={<div className="uc-empty">{subKeyword || subStatusFilter || subLangFilter ? '没有匹配的记录' : '暂无提交记录'}</div>}
            />
          </TabPane>
          {user.classId && (
            <TabPane tab="班级题单" itemKey="class-practices">
              <div className="uc-filter-bar">
                <Input
                  placeholder="筛选题单"
                  value={classPracticeKeyword}
                  onChange={setClassPracticeKeyword}
                  style={{ width: 240 }}
                />
              </div>
              <Table
                columns={classPracticeColumns}
                dataSource={filteredClassPractices}
                rowKey="id"
                loading={classPracticeLoading}
                pagination={{
                  currentPage: classPracticePage,
                  pageSize: classPracticePageSize,
                  total: classPracticeTotal,
                  showSizeChanger: true,
                  pageSizeOpts: [10, 20, 50],
                  onPageChange: setClassPracticePage,
                  onPageSizeChange: (size) => {
                    setClassPracticePageSize(size);
                    setClassPracticePage(1);
                  },
                }}
              />
            </TabPane>
          )}
          {user.classId ? (
            <TabPane tab="我的班级" itemKey="my-class">
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
            </TabPane>
          ) : (
            <TabPane tab="加入班级" itemKey="join-class">
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
                      onChange={(classId) => setClassJoinForm({ ...classJoinForm, classId })}
                    />
                  </div>
                  <div>
                    <label className="uc-field-label">申请备注</label>
                    <TextArea
                      placeholder="可以简单说明你的姓名、学号或加入原因"
                      value={classJoinForm.reason}
                      autosize={{ minRows: 3, maxRows: 6 }}
                      maxCount={500}
                      showCounter
                      onChange={(reason) => setClassJoinForm({ ...classJoinForm, reason })}
                    />
                  </div>
                  <Button type="primary" loading={classJoinLoading} onClick={handleApplyToClass}>
                    发送申请
                  </Button>
                </div>
              </div>
            </TabPane>
          )}
          <TabPane tab="设置" itemKey="settings">
            <div className="uc-settings">
              <div className="uc-settings-section">
                <div className="uc-settings-title">个人信息</div>
                <div className="uc-settings-form">
                  <div>
                    <label className="uc-field-label">用户名</label>
                    <Input
                      placeholder="请输入用户名（3-15个字符）"
                      value={profileForm.username}
                      onChange={(username) => setProfileForm({ ...profileForm, username })}
                    />
                  </div>
                  <div>
                    <label className="uc-field-label">显示名称</label>
                    <Input
                      placeholder="请输入显示名称"
                      value={profileForm.displayName}
                      onChange={(displayName) => setProfileForm({ ...profileForm, displayName })}
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
                      mode="password"
                      placeholder="请输入旧密码"
                      value={passwordForm.oldPassword}
                      onChange={(oldPassword) => setPasswordForm({ ...passwordForm, oldPassword })}
                    />
                  </div>
                  <div>
                    <label className="uc-field-label">新密码</label>
                    <Input
                      type="password"
                      mode="password"
                      placeholder="请输入新密码（6-20个字符）"
                      value={passwordForm.newPassword}
                      onChange={(newPassword) => setPasswordForm({ ...passwordForm, newPassword })}
                    />
                  </div>
                  <div>
                    <label className="uc-field-label">确认新密码</label>
                    <Input
                      type="password"
                      mode="password"
                      placeholder="请再次输入新密码"
                      value={passwordForm.confirmPassword}
                      onChange={(confirmPassword) => setPasswordForm({ ...passwordForm, confirmPassword })}
                    />
                  </div>
                  <Button type="primary" className="uc-btn-primary" onClick={handlePasswordSubmit}>
                    修改密码
                  </Button>
                </div>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </div>

      {/* 邮箱验证码弹窗 */}
      <Modal
        title="邮箱验证码"
        visible={emailModalVisible}
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
              <Input placeholder="请输入验证码" value={captchaInput} onChange={setCaptchaInput} />
            </div>
            {captchaImage && (
              <img src={captchaImage} alt="验证码" style={{ marginTop: 28, height: 40, borderRadius: 6, border: '1px solid var(--semi-color-border)', cursor: 'pointer' }} onClick={fetchCaptcha} />
            )}
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr auto' }}>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>邮箱验证码</Typography.Text>
              <Input placeholder="请输入邮箱验证码" value={emailCode} onChange={setEmailCode} />
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
        visible={codeModalVisible}
        onCancel={() => setCodeModalVisible(false)}
        footer={null}
        width={900}
        style={{ top: 40 }}
        bodyStyle={{ padding: '16px 24px 24px' }}
      >
        {codeModalLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
            <Spin size="large" tip="加载代码中..." />
          </div>
        ) : (
          <CodeViewer code={codeModalCode} language={codeModalLanguage} height="60vh" />
        )}
      </Modal>
    </div>
  );
}
