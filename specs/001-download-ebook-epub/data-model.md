# 数据模型: 电子书 EPUB 下载

**版本**: 1.0.0 | **日期**: 2025-12-09

---

## 核心实体

### 1. EbookMetadata (电子书元数据)

**用途**: 存储电子书的基本信息，从得到 API 获取

```typescript
interface EbookMetadata {
  // 身份标识
  id: string;              // 书籍数字 ID (数值)
  enid: string;            // 加密后的书籍 ID (用于 Token 获取)

  // 基本信息
  title: string;           // 书名
  author: string;          // 作者
  description: string;     // 书籍简介
  coverUrl: string;        // 封面图片 URL

  // 内容结构
  chapters: Chapter[];      // 章节列表
  toc: TableOfContent[];    // 目录树

  // 获取状态
  readToken?: string;       // 读书令牌 (获取后填充)
  tokenExpiresAt?: number;  // Token 过期时间 (Unix timestamp)
}
```

**数据源**: `GET /ebk_web/v1/get_book_info?token={readToken}`

**验证规则**:
- `id` 和 `enid` 不能为空
- `title` 长度 1-200 字符
- `chapters.length` >= 1
- `coverUrl` 必须是有效的 HTTPS URL

---

### 2. Chapter (章节)

**用途**: 表示电子书的单个章节

```typescript
interface Chapter {
  // 身份标识
  id: string;              // 章节 ID
  orderIndex: number;      // 章节在书中的顺序 (0-based)

  // 内容信息
  title: string;           // 章节标题
  content?: SvgPage[];      // SVG 页面内容（获取后填充）

  // 元数据
  level?: number;          // 目录层级 (1 = 主章节, 2 = 子章节)
  parentId?: string;       // 父章节 ID (用于分层)
}

interface SvgPage {
  // 原始内容
  encryptedSvg: string;    // Base64 编码的加密 SVG
  decryptedHtml?: string;  // 解密后的 HTML (处理后填充)

  // 分页信息
  pageIndex: number;       // 页面在章节内的索引
  isLastPage: boolean;     // 是否是该章节的最后一页
}
```

**数据源**: `POST /ebk_web_go/v2/get_pages` (分页获取)

**验证规则**:
- `id` 不能为空
- `orderIndex` >= 0
- `title` 长度 1-500 字符
- `encryptedSvg` 必须是有效的 Base64 字符串

**生命周期**:
```
创建 (id, orderIndex, title)
  ↓
内容获取 (encryptedSvg)
  ↓
内容解密 (decryptedHtml)
  ↓
HTML 转换 (应用格式)
  ↓
EPUB 打包 (添加到 ZIP)
  ↓
释放原始数据 (清除 encryptedSvg, decryptedHtml)
```

---

### 3. DownloadTask (下载任务)

**用途**: 追踪单次 EPUB 下载的整个过程

```typescript
interface DownloadTask {
  // 任务标识
  id: string;              // 任务 UUID
  bookId: string;          // 关联的书籍 ID
  startedAt: number;       // 任务开始时间 (Unix timestamp)

  // 进度信息
  status: TaskStatus;      // 当前状态
  progress: ProgressInfo;  // 进度详情

  // 错误追踪
  errors: TaskError[];     // 发生过的错误日志
  lastError?: TaskError;   // 最近一次错误

  // 输出
  epubBlob?: Blob;         // 生成的 EPUB 文件 (成功后)
  completedAt?: number;    // 完成时间 (Unix timestamp)
}

type TaskStatus =
  | 'pending'              // 待开始
  | 'fetching_token'       // 获取读书令牌
  | 'fetching_metadata'    // 获取书籍元数据
  | 'downloading'          // 下载章节内容
  | 'processing'           // 处理/生成 EPUB
  | 'completed'            // 已完成
  | 'failed';              // 失败

interface ProgressInfo {
  currentChapter: number;   // 当前处理的章节索引
  totalChapters: number;    // 总章节数
  currentPage: number;      // 当前页面 (相对于当前章节)
  totalPages: number;       // 当前章节的总页数

  // 百分比进度 (0-100)
  overallProgress: number;  // 全局进度百分比

  // 性能指标
  startTime: number;        // 任务开始时间
  elapsedSeconds: number;   // 已耗时 (秒)
  estimatedTotalSeconds?: number; // 预估总耗时
}

interface TaskError {
  timestamp: number;        // 错误发生时间
  code: string;            // 错误代码
  message: string;         // 人类可读的错误消息
  source: string;          // 错误来源 (e.g., 'api', 'crypto', 'epub')
  chapterId?: string;      // 关联的章节 ID (若适用)
  retryAttempt?: number;   // 重试次数 (0 = 首次尝试)
  details?: Record<string, any>; // 附加信息 (调试用)
}
```

**状态转移**:
```
pending
  ↓
fetching_token (成功) → fetching_metadata
  ↓
downloading (所有章节完成) → processing
  ↓
completed (EPUB 生成成功)

任何状态 + 错误 → failed
```

**验证规则**:
- `id` 是有效的 UUID
- `status` 是上述枚举值之一
- `currentChapter` < `totalChapters`
- `overallProgress` 在 [0, 100] 范围内
- `errors` 数组长度 <= 100 (防止内存溢出)

---

### 4. EpubPackage (EPUB 包结构)

**用途**: 定义 EPUB 3.0 文件的内部结构

```typescript
interface EpubPackage {
  // 元数据
  metadata: EpubMetadata;

  // 文件清单
  manifest: ManifestItem[];

  // 阅读顺序
  spine: SpineItem[];

  // 导航
  navDoc: NavDocument;      // EPUB 3.0 导航文档

  // 内容
  chapters: EpubChapter[];  // 已处理的章节 HTML
  resources: EpubResource[]; // 图片、字体等资源
}

interface ManifestItem {
  id: string;              // 资源 ID (如 "ch001", "image_001")
  href: string;            // 文件路径 (相对于 OEBPS/)
  mediaType: string;       // MIME 类型 (如 "application/xhtml+xml", "image/jpeg")
  properties?: string[];   // EPUB 3.0 属性 (如 "nav" for 导航文档)
}

interface SpineItem {
  idref: string;           // 指向 manifest 中的 id
  linear?: boolean;        // 是否是线性阅读流 (默认 true)
}

interface NavDocument {
  // EPUB 3.0 导航文档 (nav.xhtml)
  title: string;
  navPoints: NavPoint[];
  landmarks?: LandmarkItem[]; // 地标 (可选)
}

interface NavPoint {
  uid: string;             // 唯一 ID
  label: string;           // 显示标题
  href: string;            // 指向的章节文件 href
  level: number;           // 嵌套深度 (1 = 主标题, 2+ = 子标题)
  children?: NavPoint[];    // 子章节
}

interface LandmarkItem {
  type: 'cover' | 'toc' | 'bodymatter';
  title: string;
  href: string;
}

interface EpubChapter {
  id: string;              // 章节 ID
  href: string;            // 文件路径 (如 "ch001.xhtml")
  title: string;
  htmlContent: string;     // 最终的 XHTML 内容
  mediaType: 'application/xhtml+xml';
}

interface EpubResource {
  id: string;              // 资源 ID (如 "image_001")
  href: string;            // 文件路径 (如 "media/image_001.jpg")
  mimeType: string;        // MIME 类型 (image/jpeg, image/png, 等)
  data: Uint8Array;        // 二进制数据
}
```

**XML 映射** (content.opf):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{metadata.title}</dc:title>
    <dc:creator>{metadata.author}</dc:creator>
    <!-- ... 更多元数据 -->
  </metadata>

  <manifest>
    <item id="..." href="..." media-type="..."/>
  </manifest>

  <spine>
    <itemref idref="..."/>
  </spine>
</package>
```

---

## 关键关系

### 1. EbookMetadata → Chapter (1:N)
- 一本书包含多个章节
- 删除书籍时级联删除所有章节

### 2. Chapter → SvgPage (1:N)
- 一个章节可能包含多页 (大章节)
- 页面按 `pageIndex` 顺序排列

### 3. DownloadTask → EbookMetadata (N:1)
- 多个下载任务可以针对同一本书
- 但 MVP 中每个任务独立处理

### 4. EpubPackage → Chapter (1:N)
- EPUB 包包含所有已处理的章节 HTML
- 是生成最终 EPUB 文件的中间表示

---

## 数据处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 获取 ReadToken                                                │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. 创建 EbookMetadata (不含章节内容)                              │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. 创建 DownloadTask, 状态: downloading                           │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │ For each chapter:             │
        │  a) 获取 SvgPage (加密)       │
        │  b) 解密 → decryptedHtml     │
        │  c) HTML 处理 → finalHtml    │
        │  d) 创建 EpubChapter        │
        │  e) 更新进度 (progress)     │
        └──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. 更新 DownloadTask, 状态: processing                            │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. 构建 EpubPackage                                              │
│    - 生成 Manifest (资源清单)                                   │
│    - 生成 Nav Document (目录)                                   │
│    - 生成 Content.opf (包裹文件)                                │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. 使用 jszip 生成 EPUB ZIP 文件                                 │
│    - mimetype (无压缩)                                         │
│    - META-INF/ (容器文件)                                       │
│    - OEBPS/ (内容和资源)                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. 更新 DownloadTask, 状态: completed                            │
│    - 填充 epubBlob                                             │
│    - 填充 completedAt                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. 触发浏览器下载                                                │
│    - 创建 download URL (Blob)                                  │
│    - 文件名: [title].epub (清洗特殊字符)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 类型约束与验证

### String 长度限制
| 字段 | 最小 | 最大 | 用途 |
|-----|------|------|------|
| title | 1 | 200 | 书籍/章节标题 |
| author | 1 | 100 | 作者名 |
| description | 0 | 5000 | 简介 |
| message (error) | 1 | 500 | 错误消息 |

### 数值约束
| 字段 | 范围 | 用途 |
|-----|------|------|
| overallProgress | [0, 100] | 进度百分比 |
| orderIndex | >= 0 | 章节顺序 |
| level | 1-6 | 目录嵌套深度 |
| retryAttempt | 0-3 | 重试次数 |

### 枚举值
| 枚举 | 值 |
|-----|-----|
| TaskStatus | pending, fetching_token, fetching_metadata, downloading, processing, completed, failed |
| MediaType | application/xhtml+xml, image/jpeg, image/png, application/font+woff |

---

## 性能考虑

### 内存管理
- **大型书籍** (1000+ 章): 逐章处理，处理后释放原始 SVG 数据
- **图片内存**: 内联 Base64 或引用外部 URL (EPUB 标准)
- **EPUB 文件**: 使用 jszip 的流式生成，避免一次性加载到内存

### 存储优化
- 原始加密 SVG 数据 → 解密后释放 (无缓存)
- HTML 内容 → 最终 EPUB 后清空 (无中间文件)
- 最终 EPUB 文件 → 用户下载后在浏览器自动清理

---

## 错误处理映射

| TaskError.code | 含义 | 来源 | 用户提示 |
|----------------|------|------|---------|
| `401_unauthorized` | 无有效读书权限 | api | "未登录或会话过期，请重新打开得到页面" |
| `403_forbidden` | 未购买此书 | api | "无权限，您未购买此书" |
| `network_error` | 网络连接失败 | api | "网络连接失败，请检查网络后重试" |
| `decrypt_failed` | AES 解密失败 | crypto | "内容解密失败，可能是服务器返回了无效数据" |
| `invalid_svg` | SVG 格式无效 | svg | "章节内容格式无效" |
| `epub_generation_failed` | EPUB 生成失败 | epub | "EPUB 文件生成失败" |

---

## 总结

这个数据模型支持：
✅ 完整的 MVP 下载流程
✅ 实时进度追踪和错误处理
✅ 符合 EPUB 3.0 标准的包结构
✅ 清晰的数据生命周期管理
✅ 内存和性能优化

无额外依赖，完全基于 JavaScript 原生类型和 EPUB 标准规范。
