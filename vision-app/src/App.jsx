import { Layout, Typography, Button } from 'antd';
import { AudioOutlined, RedoOutlined } from '@ant-design/icons';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import useAIStore from './store/useAIStore';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

function App() {
  const status = useAIStore((state) => state.status);
  const reset = useAIStore((state) => state.reset);

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
          <Paragraph style={{ marginBottom: 16, color: '#13505b' }}>
            上传前方路况照片，系统将完成图像理解并自动播报语音提示。
          </Paragraph>
          {(status === 'idle' || status === 'error') && <ImageUploader />}
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
