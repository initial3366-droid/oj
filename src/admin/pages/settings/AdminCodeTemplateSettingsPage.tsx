/**
 * 管理员代码模板配置页面。维护练习与已启用比赛使用的各语言初始代码。
 */
import { useEffect, useState } from 'react';
import { Button, Input, Message, Space, Tabs, Typography } from '@arco-design/web-react';
import { IconRefresh, IconSave } from '@arco-design/web-react/icon';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import { adminGet, adminPut } from '../../api/adminClient';
import { decodeCodeTemplateSettings, type CodeTemplateSettings } from '../../../data/apiClient';

const TextArea = Input.TextArea;
const TabPane = Tabs.TabPane;

type TemplateKey = 'c' | 'cpp' | 'python' | 'java' | 'csharp';

const emptyTemplates: CodeTemplateSettings = {
  c: '',
  cpp: '',
  python: '',
  java: '',
  csharp: '',
};

const languageTabs: Array<{ key: TemplateKey; label: string }> = [
  { key: 'c', label: 'C' },
  { key: 'cpp', label: 'C++' },
  { key: 'python', label: 'Python' },
  { key: 'java', label: 'Java' },
  { key: 'csharp', label: 'C#' },
];

/**
 * 渲染管理员代码模板配置页面，并协调其数据加载、保存和语言切换。
 */
export function AdminCodeTemplateSettingsPage() {
  const [templates, setTemplates] = useState<CodeTemplateSettings>(emptyTemplates);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await adminGet<CodeTemplateSettings>('/api/admin/v1/settings/system/code-templates');
      setTemplates({ ...emptyTemplates, ...decodeCodeTemplateSettings(result) });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '代码模板加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const saveTemplates = async () => {
    setSaving(true);
    try {
      await adminPut('/api/admin/v1/settings/system/code-templates', templates);
      Message.success('代码模板已保存');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '代码模板保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageContainer
      title="代码配置"
      loading={loading}
      extra={(
        <Space>
          <Button icon={<IconRefresh />} onClick={loadTemplates} loading={loading} disabled={saving}>
            刷新
          </Button>
          <Button type="primary" icon={<IconSave />} onClick={saveTemplates} loading={saving} disabled={loading}>
            保存
          </Button>
        </Space>
      )}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        默认代码会用于普通练习。比赛默认不使用；只有在创建或编辑比赛时开启“默认代码模板”后才会填充。
      </Typography.Paragraph>

      <Tabs type="card-gutter">
        {languageTabs.map((language) => (
          <TabPane key={language.key} title={language.label}>
            <TextArea
              value={templates[language.key]}
              placeholder={`请输入 ${language.label} 的默认代码`}
              autoSize={{ minRows: 18, maxRows: 30 }}
              onChange={(value) => setTemplates((current) => ({ ...current, [language.key]: value }))}
              style={{ fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, monospace', lineHeight: 1.6 }}
            />
          </TabPane>
        ))}
      </Tabs>
    </AdminPageContainer>
  );
}
