# Dedao Kit Extension

一个 Chrome 浏览器扩展，用于在得到 Web 端把已购内容导出为本地可读的文件。

当前支持：

- 已购买电子书下载为 EPUB
- 专栏课程文章下载为长图 PNG
- 专栏课程文章导出 / 复制为 Markdown

## 功能

- **电子书下载**：将已购买的电子书下载为标准 EPUB 3.0 格式，自动完成 AES 解密和 SVG → HTML 转换。
- **课程文章长图**：自动滚动截图并拼接为单张 PNG，自带白边留白，便于阅读和转发。
- **课程文章 Markdown**：把文章正文导出为 `.md` 文件，或一键复制到剪贴板。
- **离线阅读**：EPUB 兼容 Calibre、Apple Books、Kindle（需转换）等阅读器。

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

构建产物位于 `dist/`。修改代码后需要在 `chrome://extensions/` 中重新加载扩展。

> 课程文章长图依赖浏览器截图能力，扩展 `manifest` 已包含 `tabs` 与 `<all_urls>` 权限。

### 测试

```bash
npm test                          # 全套 Jest
npm run test:epub                 # EPUB 功能测试（缓存驱动，无需网络/cookie）
npm run compare gen_latest.epub   # 与 Go 参考 EPUB 结构对比
```

## 安装到浏览器

1. **构建项目**：运行 `npm run build` 生成 `dist/` 目录。
2. **加载扩展**：
   - 打开 Chrome / Edge，访问 `chrome://extensions/`。
   - 开启右上角的「开发者模式」。
   - 点击「加载已解压的扩展程序」，选择本项目的 `dist/` 目录。

## 使用方法

### 下载电子书 EPUB

1. 登录 [得到官网](https://www.dedao.cn)。
2. 进入「电子书架」，打开任意一本已购买的电子书详情页或阅读页。
3. 扩展会在页面内自动注入「下载 EPUB」按钮（与「开始阅读」对齐），点击即可。
4. 也可以点击浏览器工具栏的扩展图标，通过 Popup 触发下载。
5. 等待完成，浏览器会自动保存 `.epub` 文件。

### 课程文章导出

1. 登录 [得到官网](https://www.dedao.cn)。
2. 打开任意课程文章详情页（URL 形如 `https://www.dedao.cn/course/article?id=...`）。
3. 在页面右侧的原生浮动栏中找到扩展注入的「**小助手**」按钮（菜单图标）。
4. 点击后弹出菜单，包含三个操作：

   | 操作 | 说明 |
   |------|------|
   | 下载长图 | 自动滚动并逐屏截图，拼接成单张 PNG 后下载，文件名 `课程名_文章标题.png`。 |
   | 下载 Markdown | 把文章正文导出为 `.md` 文件，文件名 `课程名_文章标题.md`。 |
   | 复制 Markdown | 把文章正文以 Markdown 形式复制到剪贴板；剪贴板不可用时会回退为下载。 |

   按钮会显示阶段状态（`下长图中 xx%` / `复制中` / `已复制` / `长图已下载` 等），完成后自动恢复。

> 长图默认截取文章正文区域，不含顶部站点固定头；过程中页面会自动滚动，结束后恢复到原来的滚动位置。

## 项目结构

```
dedao-extension/
├── public/                       # 静态资源（manifest.json、icons、html）
├── src/
│   ├── background/               # background service worker（截图）
│   ├── content/                  # Content Script（页面交互）
│   │   ├── content-script.ts            # 入口
│   │   ├── page-download-controller.ts  # 编排器
│   │   ├── book-context.ts              # 页面上下文识别
│   │   ├── download-button-ui.ts        # 电子书下载按钮
│   │   ├── article-side-button-ui.ts    # 课程文章「小助手」菜单
│   │   ├── article-capture-session.ts   # 长图：滚动 / 截图 / 拼接
│   │   ├── article-markdown-extractor.ts # 文章 → Markdown
│   │   └── clipboard.ts                 # 剪贴板写入封装
│   ├── popup/                    # Popup UI 逻辑
│   ├── services/                 # 核心业务（API、Crypto、SVG、EPUB）
│   ├── types/                    # TypeScript 类型定义
│   └── utils/                    # 工具函数
└── tests/                        # 测试文件
```

## 已知限制

- 电子书下载仅支持已购买电子书，不包含听书等其它资源。
- 课程文章功能目前仅支持文章详情页，不支持目录页、评论详情页等其它课程页面。
- 长图拼接依赖页面当前真实渲染结果；浏览器缩放比例、页面样式改版后，可能需要进一步调节裁切规则。
- Markdown 导出基于文章 DOM 结构，部分富媒体（视频、音频、特殊嵌入）会被忽略或仅保留占位文字。
- 每次下载均需从网络获取（无缓存）；图片资源逐一下载，速度受网络影响。
