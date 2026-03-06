# Dedao Downloader Extension

一个 Chrome 浏览器扩展，用于在得到 Web 端完成两类导出：

- 已购买电子书下载为 EPUB
- 专栏课程文章下载为长图 PNG

## 功能

- **电子书下载**: 将已购买的电子书下载为标准 EPUB 3.0 格式。
- **课程文章长图下载**: 在课程文章详情页右侧侧边栏注入 `下长图` 按钮，自动滚动截图并拼接为单张 PNG。
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

注意：由于课程文章长图下载依赖浏览器截图能力，扩展 `manifest` 已包含 `tabs` 和 `<all_urls>` 权限。修改代码后需要在 `chrome://extensions/` 中重新加载扩展。

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

### 下载电子书 EPUB

1. 登录 [得到官网](https://www.dedao.cn)。
2. 进入 "电子书架"，打开任意一本已购买的电子书（进入详情页或阅读页）。
3. 点击浏览器工具栏的 "Dedao EPUB" 图标。
4. 确认扩展检测到书籍 ID（显示 "Ready to download"）。
5. 点击 "Download EPUB" 按钮。
6. 等待下载完成，浏览器将自动保存 `.epub` 文件。

### 下载课程文章长图

1. 登录 [得到官网](https://www.dedao.cn)。
2. 打开任意课程文章详情页，URL 形如 `https://www.dedao.cn/course/article?id=...`。
3. 在页面右侧原生浮动栏中找到扩展注入的 `下长图` 按钮。
4. 点击按钮后，页面会自动滚动并逐屏截图，按钮会显示 `下载中 xx%` 和 `拼接中` 状态。
5. 完成后浏览器会自动下载一张 `.png` 长图，文件名规则为 `课程名_文章标题.png`。

说明：

- 长图默认截取文章内容区域，不包含顶部站点固定头。
- 导出结果会自动添加适度白边留白，便于阅读和转发。
- 截图过程中页面会自动滚动，结束后恢复到原来的滚动位置。

## 项目结构

```
dedao-extension/
├── public/              # 静态资源 (manifest.json, icons, html)
├── src/
│   ├── background/      # 浏览器截图 background service worker
│   ├── content/         # Content Script (页面交互)
│   ├── popup/           # Popup UI 逻辑
│   ├── services/        # 核心业务逻辑 (API, Crypto, Epub, SVG)
│   ├── types/           # TypeScript 类型定义
│   └── utils/           # 工具函数
└── tests/               # 测试文件
```

## 已知限制

- 电子书下载仅支持已购买电子书，不包含听书等其它资源。
- 长图下载目前仅支持课程文章详情页，不支持目录页、评论详情页等其它课程页面。
- 长图拼接依赖页面当前真实渲染结果；浏览器缩放比例、页面样式改版后，可能需要进一步调节裁切规则。
- 每次下载均需从网络获取（无缓存）。
- 图片资源需逐一下载，速度可能受网络影响。
