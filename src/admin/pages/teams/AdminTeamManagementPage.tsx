/**
 * 管理员队伍Management页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Input,
  Modal,
  Message,
  Spin,
  Empty,
  Tag,
} from '@arco-design/web-react';
import { IconEdit, IconPlus, IconRefresh } from '@arco-design/web-react/icon';
import { adminGet, adminPost, adminPut, adminDelete } from '../../api/adminClient';

/**
 * 队伍接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeamMember {
  userId: number;
  username: string;
  displayName: string;
}

interface Team {
  id: number;
  name: string;
  memberCount: number;
  members: TeamMember[];
}

/**
 * 用户接口，明确该模块内部及 API 边界使用的数据结构（添加成员时搜索用）。
 */
interface UserOption {
  id: number;
  username: string;
  displayName: string;
}

interface PageResult<T> {
  list: T[];
  total: number;
}

/**
 * 管理员队伍Management页面。
 */
export function AdminTeamManagementPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Team | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [addTarget, setAddTarget] = useState<Team | null>(null);
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTeams = async () => {
    setLoading(true);
    try {
      setTeams(await adminGet<Team[]>('/api/admin/v1/teams'));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '队伍列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const searchUsers = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    try {
      const result = await adminGet<PageResult<UserOption>>(
        `/api/admin/v1/users?page=1&pageSize=20&keyword=${encodeURIComponent(trimmed)}`
      );
      setCandidates(result.list);
    } catch {
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      Message.warning('队伍名称不能为空');
      return;
    }
    setRenaming(true);
    try {
      await adminPut(`/api/admin/v1/teams/${renameTarget.id}`, { name });
      Message.success('队伍名称已更新');
      setRenameTarget(null);
      await loadTeams();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '修改失败');
    } finally {
      setRenaming(false);
    }
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      Message.warning('队伍名称不能为空');
      return;
    }
    setCreating(true);
    try {
      await adminPost('/api/admin/v1/teams', { name });
      Message.success('队伍已创建');
      setCreateVisible(false);
      setCreateName('');
      await loadTeams();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const addMember = async (team: Team, userId: number) => {
    setAddingUserId(userId);
    try {
      await adminPost(`/api/admin/v1/teams/${team.id}/members`, { userId });
      Message.success('成员已添加');
      await loadTeams();
      setCandidates((current) => current.filter((item) => item.id !== userId));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '添加失败');
    } finally {
      setAddingUserId(null);
    }
  };

  const removeMember = async (team: Team, member: TeamMember) => {
    try {
      await adminDelete(`/api/admin/v1/teams/${team.id}/members/${member.userId}`);
      Message.success('成员已移除');
      await loadTeams();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '移除失败');
    }
  };

  return (
    <Card
      title="队伍管理"
      extra={(
        <Space>
          <Button type="primary" icon={<IconPlus />} onClick={() => { setCreateVisible(true); setCreateName(''); }}>
            新建队伍
          </Button>
          <Button icon={<IconRefresh />} loading={loading} onClick={loadTeams}>
            刷新
          </Button>
        </Space>
      )}
    >
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
      ) : teams.length === 0 ? (
        <div style={{ textAlign: 'center' }}>
          <Empty description="暂无队伍" />
          <Button type="primary" icon={<IconPlus />} onClick={() => { setCreateVisible(true); setCreateName(''); }}>
            新建队伍
          </Button>
        </div>
      ) : (
        teams.map((team) => (
          <Card
            key={team.id}
            style={{ marginBottom: 16 }}
            title={`${team.name}（${team.memberCount} 名成员）`}
            extra={(
              <Space>
                <Button
                  size="small"
                  icon={<IconEdit />}
                  onClick={() => {
                    setRenameTarget(team);
                    setRenameName(team.name);
                  }}
                >
                  改名字
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<IconPlus />}
                  onClick={() => {
                    setAddTarget(team);
                    setKeyword('');
                    setCandidates([]);
                  }}
                >
                  添加成员
                </Button>
              </Space>
            )}
          >
            {team.members.length === 0 ? (
              <Empty description="暂无成员，点击右上角添加" />
            ) : (
              <Space wrap>
                {team.members.map((member) => (
                  <Tag
                    key={member.userId}
                    size="large"
                    closable
                    onClose={() => removeMember(team, member)}
                  >
                    {member.displayName || member.username}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        ))
      )}

      <Modal
        title="新建队伍"
        visible={createVisible}
        onCancel={() => { if (!creating) setCreateVisible(false); }}
        onOk={submitCreate}
        confirmLoading={creating}
        okText="创建"
      >
        <Input
          value={createName}
          onChange={setCreateName}
          maxLength={100}
          placeholder="输入队伍名称"
          onPressEnter={submitCreate}
        />
      </Modal>

      <Modal
        title="修改队伍名称"
        visible={renameTarget != null}
        onCancel={() => setRenameTarget(null)}
        onOk={submitRename}
        confirmLoading={renaming}
        okText="保存"
      >
        <Input
          value={renameName}
          onChange={setRenameName}
          maxLength={100}
          placeholder="输入队伍名称"
          onPressEnter={submitRename}
        />
      </Modal>

      <Modal
        title={addTarget ? `添加成员 - ${addTarget.name}` : '添加成员'}
        visible={addTarget != null}
        onCancel={() => setAddTarget(null)}
        footer={null}
        style={{ width: 520 }}
      >
        <Input
          value={keyword}
          onChange={(value) => {
            setKeyword(value);
            searchUsers(value);
          }}
          placeholder="输入用户名 / 姓名 / 学号 / 邮箱搜索用户"
          allowClear
        />
        <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
          {searching ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
          ) : candidates.length === 0 ? (
            <Empty description={keyword.trim() ? '未找到匹配的用户' : '输入关键字搜索用户'} />
          ) : (
            candidates.map((user) => {
              const alreadyIn = addTarget?.members.some((member) => member.userId === user.id);
              return (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 4px',
                    borderBottom: '1px solid var(--color-border-1)',
                  }}
                >
                  <span>
                    {user.displayName || user.username}
                    <span style={{ color: 'var(--color-text-3)', marginLeft: 8 }}>@{user.username}</span>
                  </span>
                  <Button
                    size="mini"
                    type="primary"
                    disabled={alreadyIn}
                    loading={addingUserId === user.id}
                    onClick={() => addMember(addTarget!, user.id)}
                  >
                    {alreadyIn ? '已在队伍' : '添加'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </Card>
  );
}
