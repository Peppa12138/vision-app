import { useMemo, useState } from 'react';
import { Upload, message, Radio, Space, Button, Typography, Alert } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import useAIStore from '../store/useAIStore';

const { Dragger } = Upload;
const { Text } = Typography;

const VIDEO_KEYFRAME_MAX = Number(import.meta.env.VITE_VIDEO_KEYFRAME_MAX || 10);

function getRecommendedFrameCount(durationSec) {
  if (durationSec <= 15) return 4;
  if (durationSec <= 45) return 6;
  if (durationSec <= 120) return 8;
  if (durationSec <= 300) return 10;
  return 12;
}

function buildFramePoints(durationSec, count) {
  const safeDuration = Math.max(durationSec, 1);
  const start = Math.min(0.12 * safeDuration, safeDuration - 0.2);
  const end = Math.max(start, Math.min(0.9 * safeDuration, safeDuration - 0.2));

  if (count <= 1) {
    return [Math.max(0, Math.min(safeDuration - 0.2, safeDuration * 0.5))];
  }

  const step = (end - start) / (count - 1);
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push(Math.max(0, Math.min(safeDuration - 0.2, start + i * step)));
  }
  return points;
}

function blobToJpegFile(blob, index) {
  return new File([blob], `video-frame-${Date.now()}-${index}.jpg`, { type: 'image/jpeg' });
}

async function extractFrameBlob(videoElement, second) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 1280;
    canvas.height = videoElement.videoHeight || 720;

    const onSeeked = async () => {
      try {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('视频抽帧失败'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          0.82
        );
      } catch (error) {
        reject(error);
      }
    };

    videoElement.onseeked = onSeeked;
    videoElement.currentTime = second;
  });
}

function ImageUploader() {
  const uploadAndAnalyze = useAIStore((state) => state.uploadAndAnalyze);
  const status = useAIStore((state) => state.status);
  const analyzeCount = useAIStore((state) => state.analyzeCount);
  const maxAnalyzeCount = useAIStore((state) => state.maxAnalyzeCount);
  const [uploadType, setUploadType] = useState('image');
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAnalyzing, setVideoAnalyzing] = useState(false);

  const disabled = status === 'uploading' || status === 'analyzing' || videoAnalyzing;

  const quotaHint = useMemo(
    () => `已使用 ${analyzeCount}/${maxAnalyzeCount} 次分析额度（试用资源省流模式）`,
    [analyzeCount, maxAnalyzeCount]
  );

  const analyzeVideoKeyframes = async () => {
    if (!videoFile) {
      message.warning('请先上传视频文件');
      return;
    }

    setVideoAnalyzing(true);
    let tempUrl = '';
    try {
      tempUrl = URL.createObjectURL(videoFile);
      const video = document.createElement('video');
      video.src = tempUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('视频加载失败，无法抽帧'));
      });

      const duration = Math.max(1, video.duration || 1);
      const recommended = getRecommendedFrameCount(duration);
      const quotaRemain = Math.max(0, useAIStore.getState().maxAnalyzeCount - useAIStore.getState().analyzeCount);
      const targetCount = Math.max(1, Math.min(recommended, VIDEO_KEYFRAME_MAX, quotaRemain));
      const points = buildFramePoints(duration, targetCount);

      message.info(`视频时长约 ${duration.toFixed(1)} 秒，将抽取 ${points.length} 帧进行分析`);

      for (let i = 0; i < points.length; i += 1) {
        if (useAIStore.getState().analyzeCount >= useAIStore.getState().maxAnalyzeCount) {
          message.warning('额度已达上限，停止视频分析');
          break;
        }
        const frameBlob = await extractFrameBlob(video, points[i]);
        const frameFile = blobToJpegFile(frameBlob, i + 1);
        await uploadAndAnalyze(frameFile, undefined, 'video-keyframe');
      }

    } catch (error) {
      message.error(error?.message || '视频分析失败');
    } finally {
      if (tempUrl) {
        URL.revokeObjectURL(tempUrl);
      }
      setVideoAnalyzing(false);
    }
  };

  const handleBeforeUpload = (file) => {
    if (uploadType === 'image') {
      const isImage = file.type?.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件');
        return Upload.LIST_IGNORE;
      }

      uploadAndAnalyze(file, undefined, 'image-upload');
      return false;
    }

    const isVideo = file.type?.startsWith('video/');
    if (!isVideo) {
      message.error('只能上传视频文件');
      return Upload.LIST_IGNORE;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    message.success('视频已加载，可点击“分析关键帧”');
    return false;
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Radio.Group
        value={uploadType}
        onChange={(event) => setUploadType(event.target.value)}
        optionType="button"
        buttonStyle="solid"
        options={[
          { label: '上传图片', value: 'image' },
          { label: '上传视频', value: 'video' },
        ]}
      />

      <Alert type="info" showIcon message={quotaHint} />

      <Dragger
        className="vision-uploader"
        name="media"
        multiple={false}
        accept={uploadType === 'image' ? 'image/*' : 'video/*'}
        maxCount={1}
        showUploadList={false}
        beforeUpload={handleBeforeUpload}
        disabled={disabled}
        style={{
          width: '100%',
          borderRadius: 12,
          padding: '24px 12px',
          background: '#ffffffcc',
          margin: 0,
        }}
      >
        <p className="ant-upload-drag-icon">
          <CameraOutlined style={{ fontSize: 40, color: '#0b7285' }} />
        </p>
        <p className="ant-upload-text">
          {uploadType === 'image' ? '点击或拖拽上传前方路况照片' : '点击或拖拽上传前方路况视频'}
        </p>
        <p className="ant-upload-hint">
          {uploadType === 'image' ? '支持手机拍照与本地图片上传' : '视频将按时长自适应抽帧，帧数会自动调节'}
        </p>
      </Dragger>

      {uploadType === 'video' && videoUrl ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <video src={videoUrl} controls style={{ width: '100%', borderRadius: 10 }} />
          <Button type="primary" onClick={analyzeVideoKeyframes} loading={videoAnalyzing} disabled={disabled}>
            按时长抽帧分析
          </Button>
          <Text type="secondary">策略：按视频长度均匀采样，短视频少帧、长视频多帧（受额度与上限约束）。</Text>
        </Space>
      ) : null}
    </Space>
  );
}

export default ImageUploader;
