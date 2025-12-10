# Dedao Ebook Downloader Extension

一个 Chrome 浏览器扩展 MVP，用于直接从得到 Web 端下载电子书为 EPUB 格式。

## 功能 (MVP)

- **电子书下载**: 将已购买的电子书下载为标准 EPUB 3.0 格式。
- **离线阅读**: 支持 Calibre, Apple Books, Kindle (需转换) 等阅读器。
- **自动解密**: 在浏览器端完成 AES 解密和 SVG 渲染。

## 开发与构建

### 依赖

- Node.js >= 16
- npm

### 安装

```bash
npm install
```

### 开发模式

```bash
# 监控文件变化并自动构建
npm run build -- --watch
```

### 构建

```bash
npm run build
```

构建完成后，产物位于 `dist/` 目录。

### 测试

```bash
npm test
```

## 安装到浏览器

1. **构建项目**: 运行 `npm run build` 生成 `dist/` 目录。
2. **加载扩展**:
   - 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`。
   - 开启右上角的 "开发者模式" (Developer mode)。
   - 点击 "加载已解压的扩展程序" (Load unpacked)。
   - 选择本项目的 `dist/` 目录。

## 使用方法

1. 登录 [得到官网](https://www.dedao.cn)。
2. 进入 "电子书架"，打开任意一本已购买的电子书（进入详情页或阅读页）。
3. 点击浏览器工具栏的 "Dedao EPUB" 图标。
4. 确认扩展检测到书籍 ID（显示 "Ready to download"）。
5. 点击 "Download EPUB" 按钮。
6. 等待下载完成，浏览器将自动保存 `.epub` 文件。

## 项目结构

```
dedao-extension/
├── public/              # 静态资源 (manifest.json, icons, html)
├── src/
│   ├── content/         # Content Script (页面交互)
│   ├── popup/           # Popup UI 逻辑
│   ├── services/        # 核心业务逻辑 (API, Crypto, Epub, SVG)
│   ├── types/           # TypeScript 类型定义
│   └── utils/           # 工具函数
└── tests/               # 测试文件
```

## 已知限制

- 仅支持电子书（不包含听书、课程）。
- 每次下载均需从网络获取（无缓存）。
- 图片资源需逐一下载，速度可能受网络影响。
