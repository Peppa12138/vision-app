import { useEffect, useMemo, useRef } from 'react';
import { Alert, Card, Spin, Typography } from 'antd';
import useAIStore from '../store/useAIStore';

const { Paragraph, Text } = Typography;

function ResultDisplay() {
  const status = useAIStore((state) => state.status);
  const imageUrl = useAIStore((state) => state.imageUrl);
  const aiText = useAIStore((state) => state.aiText);
  const audioData = useAIStore((state) => state.audioData);
  const errorMessage = useAIStore((state) => state.errorMessage);
  const shouldAutoPlayAudio = useAIStore((state) => state.shouldAutoPlayAudio);
  const voiceDebounced = useAIStore((state) => state.voiceDebounced);
  const consumeAutoPlayFlag = useAIStore((state) => state.consumeAutoPlayFlag);
  const audioRef = useRef(null);

  const audioSrc = useMemo(() => {
    if (!audioData) return '';
    return `data:audio/wav;base64,${audioData}`;
  }, [audioData]);

  useEffect(() => {
    if (status !== 'success' || !audioSrc || !audioRef.current || !shouldAutoPlayAudio) return;

    audioRef.current.play().catch(() => {
      // 部分浏览器会拦截自动播放，保留 controls 供用户手动播放
    });
    consumeAutoPlayFlag();
  }, [status, audioSrc, shouldAutoPlayAudio, consumeAutoPlayFlag]);

  if (status === 'uploading') {
    return <Spin size="large" tip="正在上传图片..." style={{ marginTop: 20 }} />;
  }

  if (status === 'analyzing') {
    return <Spin size="large" tip="AI 正在观察路况..." style={{ marginTop: 20 }} />;
  }

  if (status === 'error') {
    return <Alert type="error" showIcon message="处理失败" description={errorMessage || '未知错误'} />;
  }

  if (status === 'success') {
    return (
      <Card
        bordered={false}
        style={{
          marginTop: 18,
          borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.08)',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="路况预览"
            style={{ width: '100%', borderRadius: 10, marginBottom: 14 }}
          />
        ) : null}
        <Text type="secondary">语音描述</Text>
        <Paragraph style={{ fontSize: 20, lineHeight: 1.7, marginTop: 8 }}>{aiText}</Paragraph>
        {voiceDebounced ? (
          <Alert
            style={{ marginBottom: 10 }}
            type="info"
            showIcon
            message="语音防抖已生效：本次描述与上一条相近，已跳过自动播报。"
          />
        ) : null}
        {audioSrc ? <audio ref={audioRef} controls src={audioSrc} style={{ width: '100%' }} /> : null}
      </Card>
    );
  }

  return null;
}

export default ResultDisplay;
