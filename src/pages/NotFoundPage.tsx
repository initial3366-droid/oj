import { Button, Card, Typography } from '@douyinfe/semi-ui';
import { NavLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--semi-color-fill-0)',
        padding: 24,
      }}
    >
      <Card
        style={{
          maxWidth: 448,
          border: '1px solid var(--semi-color-border)',
        }}
        bodyStyle={{
          padding: 40,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <Typography.Text
          type="primary"
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
          }}
        >
          404
        </Typography.Text>
        <Typography.Title heading={2} style={{ margin: 0 }}>
          页面不存在
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }} type="secondary">
          每个主要界面都已经拥有独立 URL，请从首页重新进入。
        </Typography.Paragraph>
        <Button
          type="primary"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          回到首页
        </Button>
      </Card>
    </div>
  );
}
