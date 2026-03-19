import os
import json
import base64
from flask import Flask, request, jsonify
from http import HTTPStatus
import dashscope
from dashscope import MultiModalConversation
from dashscope.audio.tts import SpeechSynthesizer

app = Flask(__name__)

# ===== CORS 处理 =====
@app.after_request
def handle_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.route('/', methods=['OPTIONS'])
@app.route('/api/analyze', methods=['OPTIONS'])
def handle_preflight():
    return '', 204

# ===== 核心业务逻辑 =====
@app.route('/', methods=['POST'])
@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        # 1. 解析请求 body
        payload = request.get_json()
        if not payload or 'imageUrl' not in payload:
            return jsonify({'code': 400, 'msg': '请求体缺少 imageUrl 字段', 'data': None}), 400
        
        image_url = payload.get('imageUrl')
        if not image_url:
            return jsonify({'code': 400, 'msg': 'imageUrl 不能为空', 'data': None}), 400
        
        # 2. 调用 Qwen-VL 进行视觉分析
        vl_prompt = '作为视障助行助手，请简短、准确、友好地描述我正前方的路况和障碍物，字数控制在50字以内。'
        
        messages = [
            {
                'role': 'user',
                'content': [
                    {'image': image_url},  # 修正了这里的传参格式
                    {'text': vl_prompt}
                ]
            }
        ]
        
        vl_response = MultiModalConversation.call(
            model='qwen-vl-max',
            messages=messages
        )
        
        if vl_response.status_code != HTTPStatus.OK:
            return jsonify({'code': 500, 'msg': f'视觉模型调用失败: {vl_response.message}', 'data': None}), 500
        
        # 安全提取 AI 生成的文本
        content = vl_response.output.choices[0].message.content
        ai_text = content[0].get('text', '') if isinstance(content, list) else content
        
        # 3. 调用 TTS 合成语音
        tts_response = SpeechSynthesizer.call(
            model='sambert-zhiqi-v1',  # 换用完全兼容当前 SDK 的 Sambert 柔和女声 (知琪)
            text=ai_text
        )
        
        # 正确获取音频 bytes 数据
        audio_bytes = tts_response.get_audio_data()
        if audio_bytes is None:
            return jsonify({'code': 500, 'msg': '语音合成失败，未获取到音频流', 'data': None}), 500
        
        # 4. 将音频 bytes 转换为 Base64
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        # 5. 返回成功响应
        return jsonify({
            'code': 200,
            'msg': 'success',
            'data': {
                'text': ai_text,
                'audioBase64': audio_base64
            }
        }), 200
    
    except Exception as e:
        return jsonify({'code': 500, 'msg': f'服务器内部错误: {str(e)}', 'data': None}), 500

# ===== 健康检查路由 =====
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    # Flask 启动，供本地调试或云函数环境使用
    app.run(host='0.0.0.0', port=9000)