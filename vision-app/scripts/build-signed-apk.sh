#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
KEYSTORE_PATH="$ANDROID_DIR/release-keystore.jks"
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"

APK_KEY_ALIAS="${APK_KEY_ALIAS:-visionappkey}"
APK_KEYSTORE_PASSWORD="${APK_KEYSTORE_PASSWORD:-VisionApp@123456}"
APK_KEY_PASSWORD="${APK_KEY_PASSWORD:-$APK_KEYSTORE_PASSWORD}"
APK_KEY_DNAME="${APK_KEY_DNAME:-CN=Vision App, OU=Course, O=Vision Assistant, L=Beijing, ST=Beijing, C=CN}"

if [[ "$OSTYPE" == darwin* ]]; then
  if /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
    export PATH="$JAVA_HOME/bin:$PATH"
  else
    echo "[ERROR] 未检测到 JDK 21，请先安装后重试。"
    exit 1
  fi
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "[ERROR] 未找到 keytool，请检查 JDK 安装。"
  exit 1
fi

cd "$PROJECT_DIR"

echo "[1/5] 构建前端静态资源..."
npm run build

echo "[2/5] 同步 Capacitor 资源到 Android..."
npx cap copy android

if [[ ! -f "$KEYSTORE_PATH" ]]; then
  echo "[3/5] 未找到签名证书，正在自动创建 keystore..."
  keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "$APK_KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$APK_KEYSTORE_PASSWORD" \
    -keypass "$APK_KEY_PASSWORD" \
    -dname "$APK_KEY_DNAME"
else
  echo "[3/5] 检测到已有 keystore，跳过创建。"
fi

echo "[4/5] 写入签名配置文件 keystore.properties..."
cat > "$KEYSTORE_PROPS" <<EOF
storeFile=release-keystore.jks
storePassword=$APK_KEYSTORE_PASSWORD
keyAlias=$APK_KEY_ALIAS
keyPassword=$APK_KEY_PASSWORD
EOF

echo "[5/5] 构建已签名 release APK..."
cd "$ANDROID_DIR"
./gradlew assembleRelease

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
RENAMED_APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/vision-assistant.apk"
if [[ -f "$APK_PATH" ]]; then
  cp -f "$APK_PATH" "$RENAMED_APK_PATH"
  echo "[SUCCESS] 已生成已签名 APK: $APK_PATH"
  echo "[SUCCESS] 已输出重命名 APK: $RENAMED_APK_PATH"
else
  echo "[WARN] 未找到 app-release.apk，请检查构建日志。"
  ls -lh "$ANDROID_DIR/app/build/outputs/apk/release" || true
fi
