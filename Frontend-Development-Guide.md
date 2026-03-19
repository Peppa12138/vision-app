# 智能助行原型系统 - 前端开发与部署文档

## 1. 项目概述
本项目为云计算课程期末大作业的前端部分。采用前后端分离架构，前端运行在本地（或静态托管），通过直传阿里云 OSS 获取图片链接，并调用部署在阿里云函数计算（FC）的 Serverless 后端大模型接口。

- **核心技术栈：** React 18 + Vite + Ant Design + Zustand + Axios
- **云服务依赖：** 阿里云 OSS (对象存储)、阿里云 FC (后端 API)

---

## 2. 本地环境初始化

请在本地开发机的终端（Terminal）中按顺序执行以下命令：

### 2.1 创建并进入项目
```bash
npm create vite@latest vision-app -- --template react
cd vision-app
```
2.2 安装核心依赖包
```bash
npm install antd @ant-design/icons zustand axios ali-oss
```
## 3. 阿里云 OSS 跨域 (CORS) 终极配置 (极其重要 🚨)
由于前端在 localhost 运行，向阿里云 OSS 直接上传图片必定会触发浏览器的 CORS 跨域拦截。请务必在启动前端前完成此配置：

登录阿里云 OSS 控制台，进入你的 Bucket。

在左侧导航栏找到 数据安全 -> 跨域设置 (CORS)。

点击 创建规则，严格按照以下参数填写：

来源 (Allowed Origins): 填写 * （代表允许所有本地或线上域名访问）。

允许 Methods: 勾选 GET, POST, PUT, DELETE, HEAD, OPTIONS（全选）。

允许 Headers: 填写 *。

暴露 Headers: 填写 ETag。

缓存时间: 3600。

点击 确定 保存。

4. 环境变量配置 (.env)
在 vision-app 文件夹的根目录（与 package.json 平级）新建一个名为 .env 的文件，填入你的云端信息：
# 云函数后端接口地址 (上一步你通过 curl 测试成功的那个 URL)
VITE_API_URL=[https://vision-tant-api-ldyjkuxyum.cn-beijing.fcapp.run/api/analyze](https://vision-tant-api-ldyjkuxyum.cn-beijing.fcapp.run/api/analyze)

# 阿里云 OSS 配置 (注意 Region 格式，如 oss-cn-beijing)
VITE_OSS_REGION=你的_OSS_REGION
VITE_OSS_BUCKET=你的_BUCKET_名称
VITE_OSS_AK=你的_AccessKey_ID
VITE_OSS_SK=你的_AccessKey_Secret
(注意：.env 文件包含敏感秘钥，切勿提交到公开的 GitHub 仓库！)

5. 核心代码编写
请在 src 目录下按照以下结构创建和替换文件。

5.1 状态管理大脑 (src/store/useAIStore.js)
新建 src/store 文件夹，并在其中创建 useAIStore.js：

JavaScript
import { create } from 'zustand';
import OSS from 'ali-oss';
import axios from 'axios';

const useAIStore = create((set) => ({
  status: 'idle', // 状态机: 'idle' | 'uploading' | 'analyzing' | 'success' | 'error'
  imageUrl: null,
  aiText: '',
  audioBase64: '',
  errorMsg: '',

  processImage: async (file) => {
    set({ status: 'uploading', errorMsg: '', aiText: '', audioBase64: '' });

    try {
      // 1. 初始化 OSS 客户端
      const client = new OSS({
        region: import.meta.env.VITE_OSS_REGION,
        accessKeyId: import.meta.env.VITE_OSS_AK,
        accessKeySecret: import.meta.env.VITE_OSS_SK,
        bucket: import.meta.env.VITE_OSS_BUCKET,
      });

      // 2. 将图片直传至 OSS
      const fileName = `vision-app/${Date.now()}-${file.name}`;
      const ossResult = await client.put(fileName, file);
      const uploadedUrl = ossResult.url;
      set({ imageUrl: uploadedUrl, status: 'analyzing' });

      // 3. 将 OSS 链接发送给 Serverless 后端进行 AI 处理
      const response = await axios.post(import.meta.env.VITE_API_URL, {
        imageUrl: uploadedUrl
      });

      if (response.data.code === 200) {
        set({
          status: 'success',
          aiText: response.data.data.text,
          audioBase64: response.data.data.audioBase64
        });
      } else {
        throw new Error(response.data.msg);
      }

    } catch (error) {
      console.error("处理失败:", error);
      set({ status: 'error', errorMsg: error.message || '网络或服务器跨域错误，请检查 CORS 配置' });
    }
  },

  reset: () => set({ status: 'idle', imageUrl: null, aiText: '', audioBase64: '', errorMsg: '' })
}));

export default useAIStore;
5.2 主界面 UI (src/App.jsx)
打开 src/App.jsx，全部替换为以下代码：

JavaScript
import React, { useEffect, useRef } from 'react';
import { Layout, Card, Upload, Button, Typography, Spin, Alert, message } from 'antd';
import { CameraOutlined, AudioOutlined, SyncOutlined } from '@ant-design/icons';
import useAIStore from './store/useAIStore';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const App = () => {
  const { status, imageUrl, aiText, audioBase64, errorMsg, processImage, reset } = useAIStore();
  const audioRef = useRef(null);

  // 监听音频数据，获取到后尝试自动播放
  useEffect(() => {
    if (status === 'success' && audioBase64 && audioRef.current) {
      audioRef.current.play().catch(e => console.log("浏览器限制自动播放，请用户手动点击播放"));
    }
  }, [status, audioBase64]);

  // 拦截默认上传行为，转交 Zustand 自定义处理
  const handleUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return Upload.LIST_IGNORE;
    }
    processImage(file);
    return false; 
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#1890ff', padding: '0 20px', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          <AudioOutlined style={{ marginRight: 8 }} />
          智能助行多模态原型
        </Title>
      </Header>

      <Content style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <Card 
          style={{ width: '100%', maxWidth: 500, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {status === 'idle' || status === 'error' ? (
            <Upload.Dragger 
              name="file" 
              beforeUpload={handleUpload} 
              showUploadList={false}
              style={{ width: '100%', padding: '40px 0', background: '#fafafa' }}
            >
              <p className="ant-upload-drag-icon">
                <CameraOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽上传前方路况照片</p>
            </Upload.Dragger>
          ) : (
            <img 
              src={imageUrl} 
              alt="路况实景" 
              style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} 
            />
          )}

          <div style={{ width: '100%', marginTop: 20, minHeight: 100 }}>
            {status === 'uploading' && <Spin tip="正在将图片直传至 OSS..." size="large" style={{ width: '100%' }} />}
            {status === 'analyzing' && <Spin tip="调用 Serverless 大模型分析中..." size="large" style={{ width: '100%' }} />}
            
            {status === 'error' && (
              <Alert message="分析失败" description={errorMsg} type="error" showIcon />
            )}

            {status === 'success' && (
              <Alert 
                message="AI 语音提示已生成" 
                description={<Paragraph style={{ fontSize: 16, marginTop: 8 }}>{aiText}</Paragraph>} 
                type="success" 
                showIcon 
                style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
              />
            )}
          </div>

          {audioBase64 && (
             <audio ref={audioRef} src={`data:audio/wav;base64,${audioBase64}`} controls style={{ width: '100%', marginTop: 20 }} />
          )}

          {(status === 'success' || status === 'error') && (
             <Button type="primary" icon={<SyncOutlined />} onClick={reset} style={{ marginTop: 20, width: '100%' }} size="large">
               重新拍摄
             </Button>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default App;
5.3 样式微调 (src/index.css 或 src/App.css)
清空 Vite 默认生成的无用样式代码，只需保留最基础的重置即可（如果有的话）。

6. 运行与验证
在终端中执行启动命令：

Bash
npm run dev
按住 Ctrl 或 Cmd 点击终端输出的链接（如 http://localhost:5173），在浏览器中打开网页，尝试上传一张图片测试完整全链路。


***

**最后一步：**
去配置好你的 `.env`，运行 `npm run dev` 吧！当你在本地网页上看到上传成功的动画，并听到网页里播放出