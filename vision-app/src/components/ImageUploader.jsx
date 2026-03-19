import { Upload, message } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import useAIStore from '../store/useAIStore';

const { Dragger } = Upload;

function ImageUploader() {
  const uploadAndAnalyze = useAIStore((state) => state.uploadAndAnalyze);

  const handleBeforeUpload = (file) => {
    const isImage = file.type?.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return Upload.LIST_IGNORE;
    }

    uploadAndAnalyze(file);
    return false;
  };

  return (
    <Dragger
      className="vision-uploader"
      name="image"
      multiple={false}
      accept="image/*"
      maxCount={1}
      showUploadList={false}
      beforeUpload={handleBeforeUpload}
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
      <p className="ant-upload-text">点击或拖拽上传前方路况照片</p>
      <p className="ant-upload-hint">支持手机拍照与本地图片上传</p>
    </Dragger>
  );
}

export default ImageUploader;
