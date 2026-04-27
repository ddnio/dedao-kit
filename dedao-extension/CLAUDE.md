# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

这是一个**TypeScript Chrome 浏览器插件**，当前支持三类能力：

- 将得到 Web 端电子书下载为标准 EPUB 3.0 文件
- 将得到课程文章详情页导出为长图 PNG
- 将得到课程文章详情页导出 / 复制为 Markdown

插件在浏览器中运行。电子书链路直接调用得到 Web API，对加密 SVG 内容解密后转换为 EPUB；课程文章长图通过 content script + background service worker 调用浏览器截图能力，自动滚动并拼接；课程文章 Markdown 直接读取页面 DOM 结构提取正文。

Go 项目 `dedao-dl`（[github.com/yann0917/dedao-dl](https://github.com/yann0917/dedao-dl)）是**技术参考**，用于对齐 EPUB 输出的结构和格式。`../specs/002-align-epub-format/fixtures/reference.epub` 是由 Go 版生成的参考文件，**本项目以此为正确性基准**。当 TS 版与 Go 版输出存在结构差异时，应以 Go 版为准进行修复。

## Commands

```bash
npm test                          # 全套测试
npm run test:epub                 # EPUB 功能测试（12-15 秒，无需网络）
npm run compare <gen.epub>        # 与 Go 参考 EPUB 对比差异报告
npm run build                     # tsc + vite 构建 Chrome 扩展

# 运行单个测试文件
npx jest tests/functional/epub-generation.test.ts --no-coverage
npx jest src/services/api/__tests__/ebook.test.ts --no-coverage

# 用真实 cookie 生成 EPUB（读取 .env 中的 DEDAO_COOKIE）
set -a && source .env && set +a
npx ts-node --require esbuild-register scripts/manual-test.ts <bookId> <enid>
```

## Architecture

```
src/
├── background/                   # background service worker
│   └── background.ts             # 调用 chrome.tabs.captureVisibleTab
├── content/                      # Content Script（页面注入）
│   ├── content-script.ts         # 入口：初始化 PageDownloadController
│   ├── book-context.ts           # 页面上下文识别（ebook / course article）
│   ├── article-capture-session.ts # 课程文章长图：滚动、截图、拼接
│   ├── article-markdown-extractor.ts # 课程文章 DOM → Markdown
│   ├── article-side-button-ui.ts # 课程文章右侧「小助手」菜单按钮
│   ├── clipboard.ts              # 剪贴板写入封装（带下载回退）
│   ├── read-button-locator.ts    # 定位"开始阅读"按钮（多策略）
│   ├── download-button-ui.ts     # 下载按钮 UI（四状态 + CSS 进度条）
│   └── page-download-controller.ts # 编排器：DOM 监听、下载协调
├── popup/                        # Popup UI
│   └── popup.ts                  # 扩展图标弹窗逻辑
├── services/
│   ├── download/manager.ts       # 核心编排层（~550 行）
│   ├── api/{http,ebook}.ts       # HTTP 客户端 + 4 个 dedao 接口
│   ├── crypto/aes.ts             # AES-256-CBC 解密 SVG
│   ├── svg/complex-converter.ts  # SVG XML → HTML 转换（排版状态机）
│   └── epub/{generator,manifest,nav,utils}.ts  # EPUB ZIP 构建
├── types/                        # 类型定义（api/ebook/epub/download）
└── utils/{cache,logger,errors}.ts
```

**Content Script 架构：**
- `PageDownloadController` 在不同页面走两条分支：
  - `/ebook/detail`：自动注入「下载 EPUB」按钮
  - `/course/article`：在原生右侧侧边栏注入「小助手」菜单按钮
- 「小助手」菜单包含三个 action（见 `page-download-controller.ts` 中 `ARTICLE_ACTIONS`）：
  - `capture`：下载长图
  - `md-download`：下载 Markdown
  - `md-copy`：复制 Markdown（剪贴板不可用时回退为下载）
- 电子书按钮状态：`idle` → `downloading`（进度条）→ `success`/`error`
- 课程文章按钮状态：`idle` → `capturing`（带阶段文案：下长图中 / 复制中 / 拼接中）→ `success`/`error`，2-3s 后自动恢复
- MutationObserver 监听 SPA 路由变化和 DOM 渲染
- 电子书下载逻辑完全内嵌在 content script
- 课程文章长图依赖 background service worker 截图，content script 负责滚动、裁切和拼接
- 课程文章 Markdown 直接读取 DOM，由 `article-markdown-extractor.ts` 输出

**构建配置要点：**
- popup 和 background 用 ES 模块格式
- content script 用 IIFE 格式（`inlineDynamicImports: true`），完全自包含
- 原因：Chrome content script 对 ES module 支持存在兼容性问题，IIFE 格式最可靠

**数据流：**
`startDownload(bookId, enid)` → API 获取元数据 → 逐章下载 SVG 页面 → AES 解密 → SVG→HTML 转换 → 全局图片处理 → EpubGenerator 打包 → `Blob`

**课程文章长图数据流：**
`PageDownloadController.handleArticleCapture()` → `getPageContextFromPage()` → `captureCourseArticleImage()` → 自动滚动页面 → background `captureVisibleTab` → 前端裁切/拼接 → `Blob`

**课程文章 Markdown 数据流：**
`PageDownloadController.handleArticleMarkdown(action)` → `extractCourseArticleMarkdown()` 读取页面 DOM → 生成 Markdown 字符串 →
- `md-download`：包成 `Blob('text/markdown;charset=utf-8')` 触发下载
- `md-copy`：通过 `clipboard.ts` 写入剪贴板，失败回退为下载

**SVG 转换关键约定（`complex-converter.ts`）：**
- 页面元素按 Y 坐标分组为"行"，逐行生成 `<p>` 或 `<div class="header{N}">`
- 脚注图标（小图片）累积进 `lineFootnotes`，在开 `<p>` 之前 flush，保证 `<aside epub:type="footnote">` 出现在段落之前
- fn 分隔符（`[1]`）通过 `fnSpanStyle` 状态机将连续同色 fn 项合并进一个 `<span style="color:rgb(0,0,255);">`
- 图片在 HTML 中以 `__IMG_PLACEHOLDER_{url}__` 占位，章节全部处理完后统一替换为 `../images/image_XXX.ext`

**图片编号规则：**
- 封面 → `cover.{ext}`
- 脚注图标（宽度 < `FOOT_NOTE_IMG_W`，有 class）→ `image_000.png` 起顺序编号
- 普通内页图片 → `image_001.ext` 起，3 位补零，按章节出现顺序

## Testing Standards

### 测试通过标准

**任何代码修改后，必须满足以下全部条件才算通过：**

1. **`npm test` 全绿**：全套测试零失败，无新增 skip
2. **`npm run test:epub` 通过**：功能测试三层验证全部通过（见下方）
3. **结构对比无新增差异**：运行 `npm run compare gen_latest.epub`，对比 Go 参考 EPUB，不得引入新的结构差异

如果修改的是课程文章相关功能（长图 / Markdown / 「小助手」菜单），至少补充并运行以下测试：

- `src/content/__tests__/book-context.test.ts`
- `src/content/__tests__/article-side-button-ui.test.ts`
- `src/content/__tests__/article-capture-session.test.ts`
- `src/content/__tests__/article-markdown-extractor.test.ts`
- `src/content/__tests__/manifest-permissions.test.ts`

### 功能测试三层验证（`tests/functional/epub-generation.test.ts`）

| 层级 | 验证内容 | 通过条件 |
|------|---------|---------|
| Layer 1 | EPUB 文件结构 | 存在 `META-INF/container.xml`、`EPUB/package.opf`、`EPUB/nav.xhtml`、`EPUB/toc.ncx`、至少一个 `EPUB/xhtml/*.xhtml`、至少一张图片且命名符合 `image_XXX.ext` |
| Layer 2 | OPF 元数据 | `package.opf` 包含 `<dc:title>`、`<dc:creator>`、cover-image 声明 |
| Layer 3 | 章节 HTML 结构 | 至少一章包含 `<div class="part">`，且该 div 内存在 `<aside epub:type="footnote">` |

### 缓存驱动测试机制

- `.cache/` 中 44 个 JSON 文件回放 API 响应（无需网络/cookie）
- 缓存 key：`MD5(METHOD:url + body)`，文件格式 `{ url, body, contentType }`
- 非 API URL（图片、封面）返回 1×1 透明 PNG mock
- 测试书目：bookId=`131902`（庄子），enid=`pqvNQ1KRJa7EmgG8MPKrzykNVbDpBWZPGZ6wQA1xO54nlvZq296YodejLXVJE5eA`

**isDedaoApiUrl 白名单**（与 `manual-test.ts` 中 `shouldCacheUrl` 必须保持一致）：
```
/pc/ebook2/v1/pc/detail
/api/pc/ebook2/v1/pc/read/token
/ebk_web/v1/get_book_info
/ebk_web_go/v2/get_pages
```

### 与 Go 参考 EPUB 的对比标准

运行 `npm run compare gen_latest.epub` 后，以下指标应与参考文件完全一致：

- `<p>` 数量、`<aside>` 数量
- `aside` 出现在 `<p>` 之前（`aside-after-p` 数量应为 0）
- 蓝色 fn span 数量（`<span style="font-size:13px;color:rgb(0,0,255);">`）
- BT 锚链接数量

**已知固有差异（不需修复）：**
- 图片格式：服务器对不同 User-Agent 做 Content-Type 内容协商，Go 版可能收到 SVG，TS 版可能收到 PNG
- 换行格式：Go 版在部分行内元素前插入 `\n\t`，TS 版紧凑输出
- ZIP 字节：两个 ZIP 库实现不同，文件哈希无法一致

## Environment

`.env` 文件存放真实 cookie（已加入 `.gitignore`）：

```
DEDAO_COOKIE=ISID=...; _sid=...; GAT=...
```

`manual-test.ts` 默认开启 API 缓存（`--no-cache` 可禁用），图片不缓存，每次从网络获取。
