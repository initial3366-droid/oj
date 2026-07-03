import { Button, Card, Tag, Space, Typography } from '@douyinfe/semi-ui';
import { IconStar } from '@douyinfe/semi-icons';

const { Title, Text } = Typography;

/**
 * Semi Design 测试页面
 * 验证组件是否正常工作
 */
export function SemiTestPage() {
  return (
    <div style={{ padding: '24px', background: '#fafafa', minHeight: '100vh' }}>
      <Space vertical align="start" spacing={24} style={{ width: '100%' }}>
        <Card
          title="Semi Design 测试"
          headerExtraContent={
            <Tag color="blue">v2.100.0</Tag>
          }
        >
          <Space vertical align="start">
            <Title heading={3}>按钮测试</Title>
            <Space>
              <Button type="primary">主要按钮</Button>
              <Button type="secondary">次要按钮</Button>
              <Button type="tertiary">第三按钮</Button>
              <Button type="warning">警告按钮</Button>
              <Button type="danger">危险按钮</Button>
            </Space>

            <Title heading={3} style={{ marginTop: 24 }}>标签测试</Title>
            <Space>
              <Tag color="green">简单</Tag>
              <Tag color="orange">中等</Tag>
              <Tag color="red">困难</Tag>
              <Tag color="blue">AC</Tag>
            </Space>

            <Title heading={3} style={{ marginTop: 24 }}>图标测试</Title>
            <Space>
              <Button icon={<IconStar />}>收藏</Button>
              <Button icon={<IconStar />} type="primary">已收藏</Button>
            </Space>

            <Text type="success">✅ Semi Design 已成功接入！</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
