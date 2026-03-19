import { useMemo, useState } from 'react';
import { Upload, message, Radio, Space, Button, Typography, Alert } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import useAIStore from '../store/useAIStore';

const { Dragger } = Upload;
const { Text } = Typography;

const VIDEO_KEYFRAME_MAX = 3;

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
    try {
      const tempUrl = URL.createObjectURL(videoFile);
      const video = document.createElement('video');
      video.src = tempUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('视频加载失败，无法抽帧'));
      });

      const duration = Math.max(1, Math.floor(video.duration || 1));
      const points = [0.15, 0.5, 0.85]
        .slice(0, VIDEO_KEYFRAME_MAX)
        .map((ratio) => Math.max(0, Math.min(duration - 0.2, duration * ratio)));

      for (let i = 0; i < points.length; i += 1) {
        if (useAIStore.getState().analyzeCount >= useAIStore.getState().maxAnalyzeCount) {
          message.warning('额度已达上限，停止视频分析');
          break;
        }
        const frameBlob = await extractFrameBlob(video, points[i]);
        const frameFile = blobToJpegFile(frameBlob, i + 1);
        await uploadAndAnalyze(frameFile, undefined, 'video-keyframe');
      }

      URL.revokeObjectURL(tempUrl);
    } catch (error) {
      message.error(error?.message || '视频分析失败');
    } finally {
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
          {uploadType === 'image' ? '支持手机拍照与本地图片上传' : '视频将按关键帧分析，默认最多3帧'}
        </p>
      </Dragger>

      {uploadType === 'video' && videoUrl ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <video src={videoUrl} controls style={{ width: '100%', borderRadius: 10 }} />
          <Button type="primary" onClick={analyzeVideoKeyframes} loading={videoAnalyzing} disabled={disabled}>
            分析关键帧（低频省额度）
          </Button>
          <Text type="secondary">策略：首段/中段/末段各抽取1帧，减少模型调用次数。</Text>
        </Space>
      ) : null}
    </Space>
  );
}

export default ImageUploader;
