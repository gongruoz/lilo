# 🎨 Lilo - 诗语共创

一个创新的实时协作创意工具，让两个人可以一起创作美丽的拼贴诗。

## ✨ 核心功能

### 🔗 双人协作空间
- 通过房间号系统连接两个创作者
- 实时同步所有操作，看到彼此的创作过程
- 显示协作者的实时光标位置

### 📷 智能图片处理
- 上传包含文字的图片（书页、报纸、杂志等）
- 使用 OCR 技术自动识别并提取文字
- 将识别的文字自动剪切成独立的图片片段

### 🎭 自由创作
- 拖拽文字片段进行自由排列
- 支持旋转、移动等操作
- 手动添加纯文字元素
- 双击删除文字片段

### 💾 保存与分享
- 导出创作成果为文本
- 保存创作为图片文件
- 一键分享到社交媒体
- 查看创作过程回放

## 🚀 快速开始

### 安装依赖
```bash
npm install
# 或
pnpm install
```

### 启动开发服务器
```bash
npm run dev
# 或
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 开始使用。

## 📖 使用指南

### 1. 创建或加入房间
- 输入你的名字
- 点击"创建新房间"或输入房间号"加入房间"

### 2. 上传图片素材
- 点击"上传图片"按钮
- 选择包含文字的图片文件
- 等待 OCR 处理完成，文字片段会自动出现在画布上

### 3. 开始创作
- 拖拽文字片段到想要的位置
- 文字片段会自动带有轻微旋转角度，营造自然的拼贴效果
- 与你的伙伴实时协作，看到彼此的操作

### 4. 保存作品
- 点击"导出文本"复制诗歌文本
- 点击"保存图片"下载创作的图片版本
- 点击"分享创作"在社交媒体上分享

## 🛠️ 技术栈

### 前端框架
- **Next.js 14** - React 全栈框架
- **TypeScript** - 类型安全的 JavaScript
- **Tailwind CSS** - 实用优先的 CSS 框架

### UI 组件
- **Radix UI** - 无样式的高质量组件
- **Lucide React** - 美观的图标库

### 核心功能
- **Tesseract.js** - 浏览器中的 OCR 文字识别
- **Canvas API** - 图片处理和导出

### 实时协作
- 模拟的实时协作系统（支持升级到真实的 WebSocket 或 WebRTC）

## 🎯 设计理念

Lilo 的名字来源于"lifelong / lie low"的缩写。In celebration of the lifelong long-distance friendships that can lie dormant for a long time till we meet again in person. But while we're apart, there is this live collage poetry game we could play together :) Lifelong friendship poetry. Live long the friendship and poetry. 


## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进 Lilo！

## 📄 许可证

[MIT License](LICENSE)

