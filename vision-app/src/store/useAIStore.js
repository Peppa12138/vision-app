import { create } from 'zustand';
import OSS from 'ali-oss';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/analyze';

function normalizeOssRegion(region) {
  if (!region) return '';
  return region.startsWith('oss-') ? region : `oss-${region}`;
}

function buildOssClient() {
  const region = normalizeOssRegion(import.meta.env.VITE_OSS_REGION);
  const bucket = import.meta.env.VITE_OSS_BUCKET;
  const accessKeyId = import.meta.env.VITE_OSS_AK;
  const accessKeySecret = import.meta.env.VITE_OSS_SK;

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error('OSS 配置不完整，请检查 .env 中的 VITE_OSS_* 变量');
  }

  return new OSS({
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    secure: true,
  });
}

function ensurePublicUrl(url, bucket, region) {
  if (url) return url;
  return `https://${bucket}.${region}.aliyuncs.com`;
}

const useAIStore = create((set) => ({
  imageUrl: '',
  aiText: '',
  audioData: '',
  status: 'idle',
  errorMessage: '',

  setStatus: (status) => set({ status }),

  uploadAndAnalyze: async (file, backendEndpoint = API_URL) => {
    set({
      status: 'uploading',
      errorMessage: '',
      aiText: '',
      audioData: '',
      imageUrl: '',
    });

    try {
      const client = buildOssClient();
      const suffix = file.name?.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg';
      const objectKey = `vision-assistant/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix}`;
      const uploadResult = await client.put(objectKey, file);

      const uploadedUrl = ensurePublicUrl(
        uploadResult?.url,
        import.meta.env.VITE_OSS_BUCKET,
        normalizeOssRegion(import.meta.env.VITE_OSS_REGION)
      ) + (uploadResult?.url ? '' : `/${objectKey}`);

      set({ imageUrl: uploadedUrl, status: 'analyzing' });

      const response = await axios.post(
        backendEndpoint,
        { imageUrl: uploadedUrl },
        { timeout: 25000 }
      );

      if (response?.data?.code !== 200) {
        throw new Error(response?.data?.msg || '后端处理失败');
      }

      const text = response?.data?.data?.text || '';
      const audioBase64 = response?.data?.data?.audioBase64 || '';

      if (!text) {
        throw new Error('后端未返回文本结果');
      }

      set({
        status: 'success',
        aiText: text,
        audioData: audioBase64,
      });
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error?.message || '网络异常，请稍后重试',
      });
    }
  },

  reset: () =>
    set({
      imageUrl: '',
      aiText: '',
      audioData: '',
      status: 'idle',
      errorMessage: '',
    }),
}));

export default useAIStore;
