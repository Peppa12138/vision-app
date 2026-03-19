# 云计算大作业：基于云服务的智能化应用原型 (视障助行多模态助手)
# 项目实施蓝图 & Vibe Coding 指南

## 1. 项目概述与架构设计
本项目是一个基于云原生架构的多模态 AI 应用原型，旨在为视障人士提供实时的路况语音描述。

### 1.1 技术栈 (Tech Stack)
* **前端:** React.js + Vite
* **UI 组件库:** Ant Design (Antd)
* **状态管理:** Zustand (负责跨组件状态共享与多步异步流控制)
* **网络请求:** Axios + 阿里云 OSS SDK (`ali-oss`)
* **后端/计算层:** 阿里云函数计算 (Function Compute, Python 3.10 环境)
* **AI/云服务:** * 存储：阿里云 OSS (对象存储)
    * 视觉理解：通义千问 `qwen-vl-max` (DashScope API)
    * 文本润色：通义千问 `qwen-max` (DashScope API)
    * 语音合成：阿里云智能语音交互 (TTS API)

### 1.2 系统时序图


---

## 2. 云端基础设施准备 (DevOps 阶段)

请开发者手动完成以下云端配置，并将关键凭证记录在本地的 `.env` 文件中。

* [ ] **任务 2.1：开通阿里云 OSS**
    * 创建一个公共读 (Public Read) 的 Bucket。
    * 配置 CORS（跨域资源共享）：允许来源 `*`，允许的方法 `GET, POST, PUT, DELETE, HEAD`，允许的 Headers `*`。
    * 获取 `OSS_REGION`, `OSS_BUCKET`, `OSS_AK`, `OSS_SK`。
* [ ] **任务 2.2：获取 AI 服务 API Key**
    * 在阿里云 DashScope 控制台生成 `DASHSCOPE_API_KEY`。
    * 在智能语音交互控制台创建项目，获取 `TTS_APPKEY`。
* [ ] **任务 2.3：创建云函数 (Serverless)**
    * 在阿里云函数计算控制台创建一个 HTTP 触发器的 Python 函数。
    * 为函数配置环境变量：填入上述的 DashScope Key 和 TTS Key。

---

## 3. 后端开发清单 (Serverless API 开发)

**目标：** 提供一个 HTTP POST 接口，接收图片 URL，返回最终的语音描述和音频流/URL。

* [ ] **任务 3.1：定义 API 协议**
    * **请求 (Request):** `POST /api/analyze` -> Payload: `{"imageUrl": "https://xxx.oss.../image.jpg"}`
    * **响应 (Response):** `{"code": 200, "data": {"text": "前方有红绿灯...", "audioBase64": "UklGR..."}}` (或直接返回音频 URL)。
* [ ] **任务 3.2：编写核心逻辑 (Python)**
    * 步骤 1：解析请求体，提取 `imageUrl`。
    * 步骤 2：调用 `dashscope.MultiModalConversation` (`qwen-vl-max`)。
        * Prompt: "作为视障助行助手，请简短、准确地描述我正前方的路况、障碍物。"
    * 步骤 3：调用阿里云 TTS SDK，将步骤 2 生成的文本合成为语音音频。
    * 步骤 4：将音频转换为 Base64 或上传回 OSS 生成 URL，连同文本一起返回给前端。
* [ ] **任务 3.3：本地调试与云端部署**
    * 使用 Postman 测试该 HTTP 端点，确保输入图片 URL 后能正确获取 JSON 返回。

---

## 4. 前端开发清单 (Vibe Coding 指南)

请 AI 编程助手严格按照以下文件结构和步骤生成代码：

### 4.1 初始化与依赖安装
* [ ] **操作：** 使用 Vite 创建 React 项目。
* [ ] **操作：** 终端执行 `npm install antd @ant-design/icons zustand axios ali-oss`。

### 4.2 状态管理层 (`src/store/useAIStore.js`)
* [ ] **操作：** 使用 Zustand 创建全局 Store。
    * **State:** * `imageUrl` (string): 当前分析的图片 URL
        * `aiText` (string): AI 返回的描述文本
        * `audioData` (string): AI 返回的音频流/URL
        * `status` (enum): `'idle' | 'uploading' | 'analyzing' | 'success' | 'error'`
        * `errorMessage` (string): 错误信息
    * **Actions:**
        * `setStatus(status)`: 更新当前系统状态
        * `uploadAndAnalyze(file, backendEndpoint)`: **核心异步 Action**。包含逻辑：
            1. 状态设为 `uploading`。
            2. 使用 `ali-oss` 将传入的 `file` 上传至 OSS，获取 URL 并更新 `imageUrl`。
            3. 状态设为 `analyzing`。
            4. 使用 `axios` 将 URL POST 给 `backendEndpoint`。
            5. 解析后端返回的数据，更新 `aiText` 和 `audioData`。
            6. 状态设为 `success`，如果出错则设为 `error`。
        * `reset()`: 清空所有状态，回到 `idle`。

### 4.3 UI 组件构建
* [ ] **操作：编写上传组件 (`src/components/ImageUploader.jsx`)**
    * 使用 Antd 的 `Upload.Dragger` 组件。
    * 拦截默认上传行为 (`customRequest` 或 `beforeUpload`)，将文件对象传递给 Store 中的 `uploadAndAnalyze` 方法。
* [ ] **操作：编写结果展示组件 (`src/components/ResultDisplay.jsx`)**
    * 订阅 Store 的状态。
    * 根据 `status` 展示不同的 UI：
        * `uploading`: 展示 Antd `Spin` (提示：正在上传图片...)。
        * `analyzing`: 展示 Antd `Spin` (提示：AI 正在观察路况...)。
        * `success`: 展示 Antd `Card`，包含上传的图片缩略图、`aiText` (大字体显示)。
        * `error`: 展示 Antd `Alert`，显示 `errorMessage`。
* [ ] **操作：编写音频播放逻辑**
    * 在 `ResultDisplay.jsx` 中，使用 `useEffect` 监听 `audioData` 的变化。
    * 当 `audioData` 有值且状态为 `success` 时，实例化 `new Audio()` 并调用 `.play()` 进行自动语音播报。

### 4.4 主页面集成 (`src/App.jsx`)
* [ ] **操作：** 组装页面。
    * 使用 Antd `Layout`, `Header`, `Content` 搭建一个移动端友好的单页应用骨架。
    * 引入 `ImageUploader` 和 `ResultDisplay`。
    * 添加一个顶部导航栏，标明“基于云原生架构的智能助行系统”。

---

## 5. 验收与展示 (Demo 准备)
* [ ] **任务 5.1：端到端测试**
    * 在手机浏览器中打开本地/部署的网页。
    * 拍照上传，验证是否能在 3-5 秒内听到环境描述的语音。
* [ ] **任务 5.2：架构图准备**
    * 在答辩 PPT 中，重点标出 Zustand 在前端状态流转中的作用，以及 Serverless 如何避免了服务器闲置成本。