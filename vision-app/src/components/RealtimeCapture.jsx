import { useEffect, useRef, useState } from 'react';
import { Button, Alert, Space, Typography, InputNumber } from 'antd';
import { VideoCameraOutlined, PauseCircleOutlined } from '@ant-design/icons';
import useAIStore from '../store/useAIStore';

const { Text } = Typography;

const DEFAULT_INTERVAL_MS = Number(import.meta.env.VITE_REALTIME_INTERVAL_MS || 8000);
const DEFAULT_MAX_FRAMES = Number(import.meta.env.VITE_REALTIME_MAX_FRAMES || 8);

function RealtimeCapture() {
  const status = useAIStore((state) => state.status);
  const analyzeSnapshot = useAIStore((state) => state.analyzeSnapshot);
  const analyzeCount = useAIStore((state) => state.analyzeCount);
  const maxAnalyzeCount = useAIStore((state) => state.maxAnalyzeCount);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const frameCounterRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [maxFrames, setMaxFrames] = useState(DEFAULT_MAX_FRAMES);
  const [cameraError, setCameraError] = useState('');

  const isBusy = status === 'uploading' || status === 'analyzing';

  const stopRealtime = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  };

  const stopCamera = () => {
    stopRealtime();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (error) {
      setCameraError(error?.message || '无法访问摄像头，请检查浏览器权限');
    }
  };

  const captureFrameBlob = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error('摄像头画面尚未准备好');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('抓帧失败'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.82
      );
    });
  };

  const runOnce = async () => {
    if (isBusy) return;
    if (analyzeCount >= maxAnalyzeCount) {
      stopRealtime();
      return;
    }
    if (frameCounterRef.current >= maxFrames) {
      stopRealtime();
      return;
    }

    try {
      const blob = await captureFrameBlob();
      frameCounterRef.current += 1;
      await analyzeSnapshot(blob, 'realtime-camera');
    } catch (error) {
      setCameraError(error?.message || '实时抓帧失败');
      stopRealtime();
    }
  };

  const startRealtime = async () => {
    if (!cameraReady) {
      await startCamera();
    }
    frameCounterRef.current = 0;
    await runOnce();
    setRunning(true);
    timerRef.current = setInterval(runOnce, Math.max(4000, intervalMs));
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message={`实时模式为省额度策略：每次间隔>=4秒，单轮最多 ${maxFrames} 帧`}
      />

      {cameraError ? <Alert type="error" showIcon message={cameraError} /> : null}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', borderRadius: 12, background: '#000', minHeight: 220 }}
      />

      <Space wrap>
        <Text>抽帧间隔(ms)</Text>
        <InputNumber min={4000} step={1000} value={intervalMs} onChange={(v) => setIntervalMs(v || 8000)} />
        <Text>单轮上限</Text>
        <InputNumber min={1} max={20} value={maxFrames} onChange={(v) => setMaxFrames(v || 8)} />
      </Space>

      <Space wrap>
        <Button icon={<VideoCameraOutlined />} onClick={startCamera} disabled={cameraReady || running}>
          打开摄像头
        </Button>
        <Button type="primary" onClick={startRealtime} disabled={running || isBusy}>
          开始实时识别
        </Button>
        <Button icon={<PauseCircleOutlined />} onClick={stopRealtime} disabled={!running}>
          暂停识别
        </Button>
        <Button danger onClick={stopCamera}>
          关闭摄像头
        </Button>
      </Space>
    </Space>
  );
}

export default RealtimeCapture;
