# GymLog 健身记录

本地优先的训练记录工具，按动作及组数记录重量和次数。仓库包含 Web/PWA、Android Capacitor 工程和微信小程序源码。

## Web / PWA

需要 Node.js 22 或 24。在仓库根目录运行：

~~~sh
npm ci
npm run dev
~~~

执行 npm run build 可生成 dist/。

## Android

在 Windows 配置 JDK 21 和 Android SDK，并设置 JAVA_HOME、ANDROID_HOME。安装 android/app/build.gradle 引用的 SDK 组件。从根目录运行 npm ci、npm run apk，生成 release/GymLog.apk（调试签名）。

## 微信小程序

用微信开发者工具导入 miniprogram/，试用时按开发者工具的提示配置测试号。正式使用请将 project.config.json 中的 touristappid 替换为自己的 AppID。

公开源码随附构建脚本及配置模板。安装包和私人训练数据需在本地生成。
