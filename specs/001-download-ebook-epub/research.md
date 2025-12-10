# Phase 0 研究成果：电子书 EPUB 下载 MVP

**完成日期**: 2025-12-09
**状态**: ✅ 所有澄清项已解决

---

## 1. 认证与访问方式

### 决策
浏览器扩展 + HTML 弹窗，复用浏览器 Cookies 认证

### 理由
- 用户已在得到 Web 端登录，Cookies 中已包含有效的会话令牌
- 浏览器扩展可直接访问当前页面的 Cookies（需申请 `cookies` 权限）
- 无需重新实现登录流程，大幅简化认证逻辑
- 符合"最小权限原则"：仅申请必要权限

### 考虑的替代方案
- **独立 Web 应用 + OAuth**：灵活性高但认证复杂性增加，不适合 MVP
- **桌面应用（Electron）**：超出 JavaScript/TypeScript 浏览器扩展范围

### 关键实现细节
```javascript
// 从扩展后台脚本读取 Cookies
const cookies = await chrome.cookies.getAll({
  domain: '.dedao.cn'
});
// 使用 Cookie 字符串进行 API 请求
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
```

---

## 2. 内容获取与加密处理

### 决策
参考 Go 项目实现，获取 AES-256-CBC 加密的 SVG 内容，在浏览器中解密

### 关键发现

**API 端点和数据流**：
1. `POST /api/pc/ebook2/v1/pc/read/token` → 获取 ReadToken
2. `GET /ebk_web/v1/get_book_info?token=xxx` → 获取书籍元信息和章节列表
3. `POST /ebk_web_go/v2/get_pages` → 分页获取章节内容

**加密参数（硬编码，所有用户相同）**：
```
算法: AES-256-CBC
密钥: 3e4r06tjkpjcevlbslr3d96gdb5ahbmo (32字节)
IV:   6fd89a1b3a7f48fb (16字节)
编码: Base64 (输入) → 原文 (输出)
填充: PKCS7
```

**响应格式**：
```javascript
{
  "c": {
    "pages": [
      {
        "svg": "SGVsbG8gV29ybGQ=...",  // Base64编码的加密SVG
        "is_end": false                 // 分页标记
      }
    ]
  }
}
```

### 理由
- 得到服务器对章节内容进行加密传输，确保只有授权用户可访问
- ReadToken 是权限验证的唯一标识，无需在浏览器中重新认证
- 分页机制（is_end）支持逐章节顺序获取，易于控制内存占用

### 浏览器实现方案
```typescript
// 使用 crypto-js 库进行 AES 解密
import CryptoJS from 'crypto-js';

function decryptSvg(encryptedBase64: string): string {
  const key = CryptoJS.enc.Utf8.parse(
    '3e4r06tjkpjcevlbslr3d96gdb5ahbmo'
  );
  const iv = CryptoJS.enc.Utf8.parse('6fd89a1b3a7f48fb');

  const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}
```

---

## 3. EPUB 文件生成

### 决策
使用 `jszip` 库 + 手工 EPUB 结构，避免小众库风险

### EPUB 3.0 标准结构
```
book.epub (ZIP 格式)
├── mimetype                    # 文件类型声明（必须首个，无压缩）
├── META-INF/
│   ├── container.xml          # 电子书容器元数据
│   └── content.opf            # 包裹文件（元数据、资源、阅读顺序）
├── OEBPS/
│   ├── toc.ncx               # 目录 (EPUB 2.0 兼容性)
│   ├── nav.xhtml             # 导航文档 (EPUB 3.0)
│   ├── ch001.xhtml           # 章节HTML文件
│   ├── ch002.xhtml
│   └── ...
└── media/
    └── [图片、字体等资源]
```

### 理由
- `jszip` 是 npm 上最稳定的 ZIP 库，周下载量数百万
- 手工构建 EPUB 虽然复杂但完全基于标准规范，无黑盒依赖
- Go 项目的逻辑清晰易于参考翻译为 JavaScript
- 有利于未来扩展（如添加高级功能）

### SVG → HTML 转换

**Go 项目关键逻辑**（来自 `svg2html.go`）：
1. 解析 SVG 元素（path, polygon, rect, circle 等）
2. 提取文本内容和格式信息（粗体、斜体、下标等）
3. 生成 HTML + CSS
4. 处理脚注链接（超链接）

**浏览器实现策略**：
- 使用浏览器原生 DOM API 或 DOMParser 解析 SVG
- 逐元素转换为 HTML，保留文本内容和样式
- 保存嵌入的图片资源到 EPUB 的 `media/` 目录

```typescript
function svgToHtml(svgString: string): string {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

  // 递归转换 SVG 元素为 HTML
  // 处理特殊元素（text, tspan, 图片等）
  // 保留样式属性和文本内容

  return htmlContent;
}
```

---

## 4. 浏览器扩展架构

### 决策
Manifest V3 标准，模块化服务设计

### 权限申请
```json
{
  "permissions": [
    "cookies"           // 读取得到.dedao.cn的Cookies
  ],
  "host_permissions": [
    "https://www.dedao.cn/*"  // API 请求权限
  ],
  "action": {
    "default_popup": "popup.html"  // 弹窗UI
  }
}
```

### 核心模块划分
- **content-script.ts**: 在页面上下文中执行，获取当前书籍 ID
- **popup.ts**: 扩展弹窗逻辑，UI 事件处理
- **services/api**: 统一的 API 调用层（包含重试、错误处理）
- **services/crypto**: AES 解密（敏感操作隔离）
- **services/epub**: EPUB 生成核心
- **services/svg**: SVG → HTML 转换

### 运行流程

```
1. 用户打开得到书籍页面
   ↓
2. 点击扩展图标，弹窗打开
   ↓
3. content-script.ts 获取当前页面的书籍 ID
   ↓
4. popup.ts 中用户点击"下载 EPUB"
   ↓
5. 顺序执行：
   a) HTTP.readToken(bookId)
   b) API.getBookInfo(token)
   c) 循环 API.getChapterPages(chapterId, token)
      - 解密每页的 SVG
      - 转换为 HTML
   d) EpubGenerator.generate() 生成 EPUB
   e) 触发浏览器下载：Blob → File
   ↓
6. 用户保存 [书名].epub 文件到本地
```

---

## 5. 容错与重试策略

### 决策
单章节失败自动重试 3 次，无全局缓存或并发限制

### 理由（MVP范围）
- 单次下载一本书，不需要跨会话缓存
- 顺序逐章获取，不存在高并发问题
- 基本网络重试足以处理大多数临时故障

### 实现
```typescript
async function fetchWithRetry(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // 指数退避：1s, 2s, 4s
      await sleep(Math.pow(2, attempt - 1) * 1000);
    }
  }
}
```

### 错误处理
- **401 Unauthorized**: 提示"未登录或会话过期，请重新打开得到页面"
- **403 Forbidden**: 提示"无权限，您可能未购买此书"
- **网络错误**: 提示"网络连接失败，请检查网络后重试"
- **单章失败**: 已重试 3 次仍失败 → 提示用户并停止下载

---

## 6. 性能与约束

### 成功标准
- **95% 成功率**：在网络正常情况下，95% 的已购书籍能成功下载
- **EPUB 验证**：生成的 EPUB 通过标准验证工具（epubcheck）无严重错误
- **处理时间**：< 500 章的纯文字书籍，30 秒内完成
- **UI 响应性**：进度条实时更新，无假死现象

### 内存限制
- 一次性加载所有章节内容可能导致内存溢出（大型书籍）
- **优化**：逐章节处理，处理后立即释放原始 SVG 数据
- 最终 EPUB 文件通过 jszip 流式写入，避免一次性加载整个文件到内存

---

## 7. 技术栈确认

| 技术 | 选择 | 理由 |
|-----|------|------|
| 语言 | TypeScript 5.x | 类型安全，减少运行时错误 |
| 扩展标准 | Manifest V3 | 现代浏览器标准，Chrome/Edge/Firefox 都支持 |
| 构建工具 | Webpack/Vite | 广泛使用，生态完善 |
| AES 解密 | crypto-js | NPM 周下载量 > 200万，稳定可靠 |
| ZIP 生成 | jszip | NPM 周下载量 > 300万，标准库 |
| 测试 | Jest | 浏览器扩展和 Node.js 环境都支持 |
| 代码检查 | ESLint + Prettier | 代码质量和一致性 |

---

## 8. 未来扩展方向（不在 MVP 范围内）

1. **其他内容类型**：课程、听书（需新 API 适配）
2. **批量下载**：涉及队列管理、后台服务
3. **进度保存**：数据库/本地存储支持断点续传
4. **格式转换**：EPUB → PDF、MOBI 等
5. **离线搜索**：本地索引、全文检索

---

## 澄清项总结

| # | 澄清项 | 决策 | 状态 |
|----|------|------|------|
| 1 | 用户认证方式 | 浏览器扩展 + Cookies | ✅ 已确认 |
| 2 | EPUB 生成地点 | 客户端（浏览器） | ✅ 已确认 |
| 3 | 内容加密处理 | AES-256-CBC 在浏览器解密 | ✅ 已确认 |
| 4 | EPUB 库选择 | jszip + 手工结构 | ✅ 已确认 |
| 5 | MVP 容错策略 | 单章重试 3 次，无缓存 | ✅ 已确认 |

---

## 关键参考

- **Go 参考项目**：`/Users/nio/project/github/dedao-asisstant/dedao-dl/`
  - `cmd/app/ebook.go` - 电子书下载主逻辑
  - `utils/svg2html.go` - SVG→HTML 转换
  - `utils/html2epub.go` - EPUB 生成
  - `services/ebook.go` - API 调用和请求管理

- **EPUB 3.0 规范**：https://www.w3.org/publishing/epub3/

- **浏览器扩展 API**：https://developer.chrome.com/docs/extensions/

---

**报告完成**: ✅ 所有澄清项已解决，无待决事项。可进入 Phase 1 设计阶段。
