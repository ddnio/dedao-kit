# 快速开始指南: 电子书 EPUB 下载扩展

**版本**: 1.0.0-MVP | **日期**: 2025-12-09

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│ 用户浏览器 (已登录得到.dedao.cn)                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 得到 Web 页面                                        │   │
│  │  - 电子书详情 / 阅读页面                             │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                │ 扩展 content-script 抓取书籍 ID            │
│                ↓                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 扩展弹窗 (Popup)                                      │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ [下载 EPUB] 按钮                            │   │   │
│  │  │ 进度条: 获取元数据 / 下载第 X/N 章         │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                │ popup.ts 触发下载流程                     │
│                ↓                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 服务层 (services/)                                   │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 1. API 调用 (services/api/)                 │  │   │
│  │  │    - readToken() → Token                   │  │   │
│  │  │    - getBookInfo() → Metadata              │  │   │
│  │  │    - getChapterPages() → 加密 SVG          │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 2. 解密 (services/crypto/)                  │  │   │
│  │  │    - AES-256-CBC 解密                      │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 3. SVG 转换 (services/svg/)                 │  │   │
│  │  │    - 解析 SVG 元素                         │  │   │
│  │  │    - 生成 HTML                            │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 4. EPUB 生成 (services/epub/)               │  │   │
│  │  │    - 生成 Manifest                        │  │   │
│  │  │    - 生成 Nav Document                    │  │   │
│  │  │    - 创建 ZIP 结构                        │  │   │
│  │  │    - Blob 输出                           │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                │ 触发浏览器下载                           │
│                ↓                                           │
│         用户本地: [书名].epub 文件                        │
└─────────────────────────────────────────────────────────────┘

```

---

## 工作流（顺序）

### 阶段 1: 初始化与权限验证

```javascript
// 1. 扩展加载时
chrome.runtime.onInstalled.addListener(() => {
  // 检查权限
  // 初始化日志系统
});

// 2. 用户在得到页面上打开扩展弹窗
// → content-script.ts 执行
const bookId = extractBookIdFromPage();
// 从 URL 或 DOM 中获取 id 参数
// 例: https://www.dedao.cn/course/detail?id=123456
```

### 阶段 2: 获取读书令牌

```javascript
// popup.ts → services/api/ebook.ts
const token = await api.getReadToken(bookId);
// POST /api/pc/ebook2/v1/pc/read/token
// 响应: { c: { token: "xxx" } }
```

### 阶段 3: 获取书籍元数据

```javascript
// services/api/ebook.ts
const metadata = await api.getBookInfo(token);
// GET /ebk_web/v1/get_book_info?token={token}
// 响应: { c: { bookInfo: { orders: [...], toc: [...] } } }

// 解析得到:
// - metadata.title
// - metadata.author
// - metadata.chapters[] (章节列表)
// - metadata.toc[] (目录树)
```

### 阶段 4: 逐章获取和处理

```javascript
for (const chapter of metadata.chapters) {
  // a) 获取章节内容 (可能多页)
  let pageIndex = 0;
  let isLastPage = false;

  while (!isLastPage) {
    const pageResponse = await api.getChapterPages(
      chapter.id,
      token,
      pageIndex
    );
    // POST /ebk_web_go/v2/get_pages
    // 响应: { c: { pages: [...], is_end: true/false } }

    for (const page of pageResponse.pages) {
      // b) 解密 SVG
      const decryptedHtml = crypto.decryptAES(page.svg);
      // AES-256-CBC 解密

      // c) 转换 SVG → HTML
      const finalHtml = svg.convertToHtml(decryptedHtml);
      // 解析 SVG 元素，生成标准 XHTML

      // d) 存储到 chapter
      chapter.content.push(finalHtml);
    }

    pageIndex++;
    isLastPage = pageResponse.is_end;

    // 更新进度 UI
    updateProgress(chapter.index, totalChapters);
  }

  // e) 在生成前释放原始数据（节省内存）
  chapter.encrypted_raw = null;
}
```

### 阶段 5: 生成 EPUB

```javascript
// services/epub/generator.ts
const epubPackage = {
  metadata: { title, author, ... },
  chapters: [...],     // 已处理的 HTML 章节
  resources: [...],    // 图片等资源
};

const epubBlob = await epubGenerator.generate(epubPackage);
// 1. 构建文件系统结构
// 2. 生成 XML 文件 (content.opf, nav.xhtml, toc.ncx)
// 3. 使用 jszip 打包
// 4. 输出 Blob
```

### 阶段 6: 触发下载

```javascript
// popup.ts
const url = URL.createObjectURL(epubBlob);
const a = document.createElement('a');
a.href = url;
a.download = sanitizeFileName(`${title}.epub`);
a.click();
URL.revokeObjectURL(url);

// 用户浏览器自动弹出"保存文件"对话框
```

---

## 核心 API 参考

### 1. 扩展 API (`services/api/ebook.ts`)

```typescript
class EbookAPI {
  // 获取读书令牌
  async getReadToken(enid: string): Promise<string>;

  // 获取书籍完整信息
  async getBookInfo(token: string): Promise<EbookMetadata>;

  // 获取章节页面（分页）
  async getChapterPages(
    chapterId: string,
    token: string,
    pageIndex: number,
    pageCount?: number  // 默认 20
  ): Promise<{
    pages: Array<{ svg: string }>;
    is_end: boolean;
  }>;
}
```

### 2. 加密服务 (`services/crypto/aes.ts`)

```typescript
class AESCrypto {
  // AES-256-CBC 解密
  decrypt(encryptedBase64: string): string;

  // 内部常量
  private KEY = '3e4r06tjkpjcevlbslr3d96gdb5ahbmo';
  private IV = '6fd89a1b3a7f48fb';
}
```

### 3. SVG 转换 (`services/svg/converter.ts`)

```typescript
class SvgConverter {
  // SVG HTML 字符串 → XHTML 内容
  convertToHtml(svgString: string): string;
}
```

### 4. EPUB 生成 (`services/epub/generator.ts`)

```typescript
class EpubGenerator {
  // 生成 EPUB Blob
  async generate(epubPackage: EpubPackage): Promise<Blob>;

  // 验证 EPUB 结构
  validate(epubBlob: Blob): boolean;
}
```

---

## 错误处理示例

### 网络错误（自动重试）

```javascript
// services/api/http.ts 处理重试逻辑
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw new DownloadError(
          'network_error',
          '网络连接失败，请检查网络后重试'
        );
      }
      // 指数退避: 1s, 2s, 4s
      await sleep(Math.pow(2, attempt - 1) * 1000);
    }
  }
}
```

### 认证错误（停止下载）

```javascript
// popup.ts 捕获 API 错误
try {
  const token = await api.getReadToken(bookId);
} catch (error) {
  if (error.status === 401) {
    showError('未登录或会话过期，请重新打开得到页面');
    return;
  }
  if (error.status === 403) {
    showError('无权限，您未购买此书');
    return;
  }
}
```

### 单章失败（重试后跳过或停止）

```javascript
// services/download/manager.ts
for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
  try {
    await downloadChapter(chapters[chapterIndex], token);
  } catch (error) {
    if (error.code === 'network_error') {
      showError(`章节 ${chapterIndex + 1} 下载失败，${3} 秒后重试...`);
      // 3 次重试后停止
      throw error;
    }
  }
}
```

---

## 开发和测试

### 项目初始化

```bash
# 安装依赖
npm install

# 开发构建 (Watch mode)
npm run dev

# 生成浏览器扩展
npm run build

# 输出: dist/
```

### 加载扩展到浏览器

**Chrome / Edge**:
1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 启用"开发者模式"
3. 点击"加载未打包的扩展程序"
4. 选择 `dist/` 目录

**Firefox**:
1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击"加载临时附加组件"
3. 选择 `dist/manifest.json`

### 测试流程

```bash
# 单元测试
npm run test:unit

# 集成测试（需要模拟 API 或真实得到服务）
npm run test:integration

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 调试

**在扩展弹窗中**:
```javascript
// popup.ts 或任何服务
console.log('调试信息');

// 打开浏览器开发工具 (F12)
// → Sources 选项卡查看源码
// → Console 选项卡查看日志
```

**检查 API 请求**:
```javascript
// 在 services/api/http.ts 中加入日志
console.log('请求:', method, url, body);
console.log('响应:', response);
```

---

## 常见问题

### Q1: 扩展说"未授权，请先购买"

**原因**: 用户未登录或未购买此书

**解决方案**:
1. 确保已登录得到 Web (检查浏览器 Cookies)
2. 确保已购买此书
3. 重新加载得到页面和扩展

### Q2: 下载到一半停止了

**原因**: 网络中断或章节请求失败（已重试 3 次）

**解决方案**:
1. 检查网络连接
2. 尝试再次点击"下载"
3. 联系支持

### Q3: 生成的 EPUB 在阅读器中打不开

**原因**: EPUB 结构不符合标准

**解决方案**:
1. 用 `epubcheck` 验证文件
2. 如果有错误，反馈给开发者
3. 尝试用不同的阅读器（Calibre, iBooks, Kindle 等）

### Q4: 大书籍下载很慢或内存爆了

**原因**: 逐章节处理但仍可能占用大量内存

**解决方案**:
1. 关闭其他标签页释放内存
2. 使用内存充足的设备
3. 未来版本会进一步优化（不在 MVP 范围）

---

## 文件结构速查

```
src/
├── content/content-script.ts       获取页面书籍 ID
├── popup/
│   ├── popup.ts                   弹窗主逻辑
│   ├── popup.css                  样式
│   └── components/                UI 组件
├── services/
│   ├── api/
│   │   ├── ebook.ts               电子书 API
│   │   └── http.ts                HTTP 包装
│   ├── crypto/aes.ts              解密
│   ├── epub/
│   │   ├── generator.ts           生成核心
│   │   └── utils.ts               工具
│   ├── svg/converter.ts           转换
│   └── download/manager.ts        管理
├── types/
│   ├── ebook.ts
│   ├── api.ts
│   └── epub.ts
└── utils/
    ├── logger.ts
    ├── errors.ts
    └── format.ts
```

---

## 参考链接

- [EPUB 3.0 规范](https://www.w3.org/publishing/epub3/)
- [Chrome 扩展 API](https://developer.chrome.com/docs/extensions/)
- [jszip 文档](https://stuk.github.io/jszip/)
- [crypto-js 文档](https://cryptojs.gitbook.io/docs/)

---

## 下一步

✅ 这个快速开始涵盖了 MVP 的核心流程。

具体的实现任务见 `tasks.md` (由 `/speckit.tasks` 生成)
