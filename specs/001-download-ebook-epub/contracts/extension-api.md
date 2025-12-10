# 扩展内部 API 契约

**版本**: 1.0 | **日期**: 2025-12-09

---

## 概览

扩展的各个模块通过明确定义的接口通信。本文档定义了所有关键的内部 API。

---

## 1. 内容脚本 API (`content-script.ts`)

### 功能
从当前页面 DOM 中提取电子书 ID。

### 接口

```typescript
interface ContentScriptAPI {
  // 获取当前页面的电子书 ID
  getBookIdFromPage(): {
    success: boolean;
    bookId?: string;
    enid?: string;
    error?: string;
  };
}
```

### 实现细节

**识别方式**（优先级顺序）：
1. 从 URL 参数 `id` 提取（`?id=123456`）
2. 从 URL 参数 `enid` 提取（`?enid=abc123`）
3. 从页面 DOM 中查找 `data-book-id` 属性
4. 从页面 JavaScript 全局对象中查找 window.bookId

**返回示例**：

成功:
```json
{
  "success": true,
  "bookId": "123456",
  "enid": "abc123def456"
}
```

失败:
```json
{
  "success": false,
  "error": "无法从页面提取书籍 ID，请确保您在电子书页面上"
}
```

---

## 2. API 服务 (`services/api/`)

### 2.1 主 API 类

```typescript
class EbookAPI {
  // 获取读书令牌
  async getReadToken(enid: string): Promise<string>;

  // 获取书籍完整信息
  async getBookInfo(token: string): Promise<EbookMetadata>;

  // 获取章节页面
  async getChapterPages(
    chapterId: string,
    token: string,
    pageIndex: number,
    pageCount?: number
  ): Promise<ChapterPagesResponse>;
}

interface ChapterPagesResponse {
  pages: Array<{
    svg: string;           // Base64 编码的加密 SVG
    is_first: boolean;
    is_last: boolean;
  }>;
  is_end: boolean;         // 是否已是最后一批页面
}
```

### 2.2 HTTP 请求包装 (`http.ts`)

```typescript
interface HttpClient {
  // 发送 GET 请求（带重试、Cookie、错误处理）
  get<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
      maxRetries?: number;
    }
  ): Promise<T>;

  // 发送 POST 请求
  post<T>(
    url: string,
    data: any,
    options?: HttpClientOptions
  ): Promise<T>;

  // 获取浏览器的 Cookie 字符串
  getCookieString(domain: string): Promise<string>;
}

interface HttpError extends Error {
  status: number;          // HTTP 状态码
  code: string;            // 错误代码 (network, timeout, 401, 403, 等)
  retryCount: number;      // 已重试的次数
  originalError?: Error;   // 原始错误
}
```

### 错误处理

```typescript
// 错误类型
class NetworkError extends HttpError { }    // 网络连接失败
class TimeoutError extends HttpError { }    // 请求超时
class UnauthorizedError extends HttpError { }  // 401 未授权
class ForbiddenError extends HttpError { }     // 403 禁止
class ServerError extends HttpError { }        // 5xx 服务器错误
```

### 重试策略

```javascript
// 自动重试配置
{
  maxRetries: 3,
  backoffBase: 1000,      // 1 秒
  backoffExponent: 2,     // 2^0, 2^1, 2^2 = 1s, 2s, 4s
  timeoutMs: 30000        // 30 秒超时
}
```

---

## 3. 加密服务 (`services/crypto/aes.ts`)

### 接口

```typescript
class AESCrypto {
  // AES-256-CBC 解密
  decrypt(encryptedBase64: string): string;

  // 验证密钥和 IV 配置
  validate(): boolean;
}
```

### 实现要点

```typescript
// 硬编码参数（所有用户相同）
private readonly KEY = '3e4r06tjkpjcevlbslr3d96gdb5ahbmo';
private readonly IV = '6fd89a1b3a7f48fb';

// 使用 crypto-js 库
import CryptoJS from 'crypto-js';

decrypt(encryptedBase64: string): string {
  const key = CryptoJS.enc.Utf8.parse(this.KEY);
  const iv = CryptoJS.enc.Utf8.parse(this.IV);

  const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}
```

### 错误

```typescript
class DecryptionError extends Error {
  code: 'invalid_base64' | 'decrypt_failed';
  originalError?: Error;
}
```

---

## 4. SVG 转换服务 (`services/svg/converter.ts`)

### 接口

```typescript
class SvgConverter {
  // 将 SVG HTML 转换为标准 XHTML
  convertToHtml(svgString: string): string;

  // 提取 SVG 中的图片资源 URL
  extractImageUrls(svgString: string): string[];

  // 提取 SVG 中的文本内容（用于调试）
  extractText(svgString: string): string;
}
```

### 转换规则

**输入**: Base64 解密后的 SVG HTML 字符串
```html
<svg xmlns="...">
  <g class="text">
    <tspan x="0" y="20" font-weight="bold">粗体文本</tspan>
  </g>
  <image href="data:image/png;base64,..." width="100" height="100"/>
</svg>
```

**输出**: 符合 EPUB 标准的 XHTML
```html
<div class="epub-page">
  <p><strong>粗体文本</strong></p>
  <img src="media/image_001.png" alt=""/>
</div>
```

### 处理规则

1. **文本元素** (`<text>`, `<tspan>`):
   - 保留文本内容
   - 转换格式标记（粗体、斜体等）为 HTML 标签

2. **图片** (`<image>`):
   - 提取 `href` 属性
   - 如果是 `data:` URL，转为引用外部资源
   - 生成 `<img>` 标签

3. **矢量图形** (`<path>`, `<polygon>`, 等):
   - 转换为 SVG 元素或光栅化
   - 大多数情况保留原 SVG 嵌入到 HTML 中

4. **样式**:
   - 提取 SVG 的 `style` 属性
   - 转换为内联 CSS

---

## 5. EPUB 生成服务 (`services/epub/`)

### 5.1 主生成器

```typescript
class EpubGenerator {
  // 生成 EPUB 文件
  async generate(epubPackage: EpubPackage): Promise<Blob>;

  // 验证 EPUB 结构的有效性
  async validate(epubBlob: Blob): Promise<ValidationResult>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];        // 严重错误
  warnings: string[];      // 警告
}
```

### 5.2 Manifest 生成器

```typescript
class ManifestGenerator {
  // 生成 EPUB 3.0 content.opf 文件
  generateManifest(epubPackage: EpubPackage): string; // XML 字符串

  // 生成资源清单项
  createManifestItem(
    id: string,
    href: string,
    mediaType: string,
    properties?: string[]
  ): ManifestItem;
}
```

### 5.3 导航生成器

```typescript
class NavGenerator {
  // 生成 EPUB 3.0 导航文档 (nav.xhtml)
  generateNavDocument(chapters: EpubChapter[], toc: TableOfContent[]): string;

  // 生成旧版 TOC (toc.ncx, EPUB 2.0 兼容)
  generateTocNcx(chapters: EpubChapter[]): string;
}
```

### EPUB 文件结构

生成的 EPUB 是一个 ZIP 文件，结构如下：

```
[ZIP ROOT]
├── mimetype                 (无压缩)
├── META-INF/
│   ├── container.xml
│   └── content.opf          (manifest, spine, metadata)
├── OEBPS/
│   ├── nav.xhtml            (EPUB 3.0 导航)
│   ├── toc.ncx              (EPUB 2.0 兼容导航)
│   ├── cover.xhtml          (封面)
│   ├── ch001.xhtml          (章节)
│   ├── ch002.xhtml
│   └── ...
└── media/
    ├── cover.jpg
    ├── image_001.png
    └── ...
```

---

## 6. 下载管理器 (`services/download/manager.ts`)

### 接口

```typescript
class DownloadManager {
  // 开始下载任务
  async startDownload(
    bookId: string,
    enid: string,
    onProgress?: (task: DownloadTask) => void
  ): Promise<Blob>;

  // 获取当前任务状态
  getTaskStatus(): DownloadTask;

  // 取消当前下载
  cancel(): void;

  // 清理资源
  cleanup(): void;
}
```

### 事件回调

```typescript
interface ProgressCallback {
  (task: DownloadTask): void;
}

// 使用示例
downloadManager.startDownload(bookId, enid, (task) => {
  console.log(`进度: ${task.progress.overallProgress}%`);
  console.log(`当前: 第 ${task.progress.currentChapter}/${task.progress.totalChapters} 章`);

  updateUI(task);
});
```

### 错误处理

```typescript
interface DownloadError extends Error {
  code: 'token_error' | 'metadata_error' | 'chapter_error' | 'epub_error';
  chapterId?: string;
  retryCount?: number;
  canRetry: boolean;
}
```

---

## 7. 弹窗 UI 逻辑 (`popup/popup.ts`)

### 接口

```typescript
class PopupController {
  // 初始化弹窗
  async init(): Promise<void>;

  // 处理用户点击"下载"按钮
  async onDownloadClick(): Promise<void>;

  // 更新 UI 进度
  updateProgress(task: DownloadTask): void;

  // 显示错误信息
  showError(message: string, code?: string): void;

  // 触发文件下载
  downloadFile(blob: Blob, filename: string): void;
}
```

### 事件流

```
页面加载
  ↓
init() → 获取书籍 ID，显示书名
  ↓
用户点击 "下载 EPUB"
  ↓
onDownloadClick()
  ├── 禁用按钮（防止重复点击）
  ├── 启动 DownloadManager
  ├── 订阅进度更新 → updateProgress()
  └── 监听完成/错误事件
      ├── 成功 → downloadFile() 触发浏览器下载
      └── 失败 → showError() 显示错误信息
```

---

## 8. 类型定义 (`types/`)

### ebook.ts

```typescript
interface EbookMetadata {
  id: string;
  enid: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  chapters: Chapter[];
  toc: TableOfContent[];
  readToken?: string;
  tokenExpiresAt?: number;
}

interface Chapter {
  id: string;
  orderIndex: number;
  title: string;
  content?: SvgPage[];
  level?: number;
  parentId?: string;
}

interface TableOfContent {
  href: string;
  level: number;
  text: string;
  playOrder: number;
}
```

### api.ts

```typescript
interface ApiResponse<T> {
  code: number;            // 0 = 成功, 其他 = 错误码
  msg?: string;            // 错误消息
  c?: T;                   // 实际数据
}

interface TokenResponse {
  token: string;
  expiresIn?: number;
}

interface BookInfoResponse {
  bookInfo: {
    title: string;
    author: string;
    intro: string;
    cover: string;
    orders: Array<{
      chapterId: string;
      text: string;
      level: number;
      parentId?: string;
    }>;
    toc: Array<{
      href: string;
      level: number;
      text: string;
      playOrder: number;
    }>;
  };
}
```

### epub.ts

```typescript
interface EpubPackage {
  metadata: EbookMetadata;
  manifest: ManifestItem[];
  spine: SpineItem[];
  navDoc: NavDocument;
  chapters: EpubChapter[];
  resources: EpubResource[];
}
```

---

## 通信模式

### 弹窗 → 内容脚本

```javascript
// popup.ts
chrome.tabs.executeScript({
  file: '/content-script.js'
}, (results) => {
  const { bookId, enid } = results[0];
});
```

### 各模块间通信

```javascript
// 典型流程
const api = new EbookAPI();
const token = await api.getReadToken(enid);  // HTTP request
const metadata = await api.getBookInfo(token);  // HTTP request

const crypto = new AESCrypto();
const converter = new SvgConverter();

for (const chapter of metadata.chapters) {
  const response = await api.getChapterPages(chapter.id, token, 0);

  for (const page of response.pages) {
    const decrypted = crypto.decrypt(page.svg);  // 同步
    const html = converter.convertToHtml(decrypted);  // 同步
  }
}

const epubGen = new EpubGenerator();
const epubBlob = await epubGen.generate(epubPackage);  // 异步
```

---

## 错误处理约定

所有 async 函数应该：
1. 抛出具体的错误子类
2. 提供 `code` 和 `message` 属性
3. 在调用方捕获并转换为用户可读的提示

```typescript
// 服务层
try {
  await api.getReadToken(enid);
} catch (error) {
  if (error instanceof UnauthorizedError) {
    throw new Error('未登录，请重新打开得到页面');
  } else if (error instanceof ForbiddenError) {
    throw new Error('无权限，您未购买此书');
  } else {
    throw new Error('网络错误，请检查网络连接');
  }
}
```

---

**版本历史**

| 版本 | 日期 | 说明 |
|-----|------|------|
| 1.0 | 2025-12-09 | 初始版本，MVP 范围 |
