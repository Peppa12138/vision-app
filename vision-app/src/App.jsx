import { Layout, Typography, Button, Tabs, Space, Tag } from 'antd';
import { AudioOutlined, RedoOutlined } from '@ant-design/icons';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import RealtimeCapture from './components/RealtimeCapture';
import useAIStore from './store/useAIStore';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

function App() {
  const status = useAIStore((state) => state.status);
  const reset = useAIStore((state) => state.reset);
  const analyzeCount = useAIStore((state) => state.analyzeCount);
  const maxAnalyzeCount = useAIStore((state) => state.maxAnalyzeCount);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background:
            'linear-gradient(92deg, rgba(11,114,133,1) 0%, rgba(18,152,183,1) 48%, rgba(8,79,99,1) 100%)',
          paddingInline: 16,
        }}
      >
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          <AudioOutlined style={{ marginRight: 10 }} />
          基于云原生架构的智能助行系统
        </Title>
      </Header>

      <Content style={{ display: 'flex', justifyContent: 'center', padding: '24px 14px 28px' }}>
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(11,114,133,0.2)',
            borderRadius: 16,
            padding: 18,
            overflow: 'hidden',
            boxShadow: '0 18px 40px rgba(8, 79, 99, 0.12)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
            <Paragraph style={{ marginBottom: 0, color: '#13505b' }}>
              支持上传图片/视频与实时拍摄，默认启用低频分析以节省试用额度。
            </Paragraph>
            <Tag color="cyan">额度 {analyzeCount}/{maxAnalyzeCount}</Tag>
          </Space>

          <Tabs
            defaultActiveKey="upload"
            items={[
              {
                key: 'upload',
                label: '上传媒体',
                children: <ImageUploader />,
              },
              {
                key: 'realtime',
                label: '实时拍摄',
                children: <RealtimeCapture />,
              },
            ]}
          />

          <ResultDisplay />
          {(status === 'success' || status === 'error') && (
            <Button
              type="primary"
              icon={<RedoOutlined />}
              size="large"
              onClick={reset}
              style={{ width: '100%', marginTop: 16 }}
            >
              重新上传
            </Button>
          )}
        </div>
      </Content>
    </Layout>
  );
}

export default App;
