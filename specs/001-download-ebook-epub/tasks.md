# 实现任务: 电子书 EPUB 下载

**版本**: 1.0.0-MVP | **日期**: 2025-12-09 | **分支**: `001-download-ebook-epub`

---

## 概览

本文档定义了电子书 EPUB 下载浏览器扩展 MVP 的所有实现任务。任务按照用户故事（优先级）和执行阶段组织，支持独立测试和并行执行。

### 关键数据
- **总任务数**: 45
- **总阶段**: 5（Setup + Foundation + US1 + Polish + Integration）
- **MVP 范围**: User Story 1（电子书下载）
- **并行机会**: 12 个任务可并行执行（标记为 [P]）
- **预计工期**: 3-4 周（根据开发者经验）

### 用户故事 (User Stories)

| ID | 故事 | 优先级 | 任务数 | 状态 |
|----|-----|------|--------|------|
| US1 | 电子书下载 (EPUB) | P1 | 35 | MVP |

---

## 执行策略

### 推荐构建顺序
1. **Phase 1 (Setup)**: 项目初始化和基础设施（T001-T003）
2. **Phase 2 (Foundational)**: 共享模块和库集成（T004-T010）
3. **Phase 3 (US1)**: 电子书下载核心功能（T011-T040）
4. **Phase 4 (Polish)**: 错误处理和 UI 打磨（T041-T043）
5. **Phase 5 (Integration)**: 端到端测试和验证（T044-T045）

### 并行执行
以下任务可独立并行执行（标记为 [P]）：
- T004, T005, T006: 库集成（互无依赖）
- T012, T013, T014, T015, T016: 类型定义和数据模型
- T021, T022, T023: 服务模块初始化
- T024, T025, T026, T027: 各服务实现（部分）

---

## Phase 1: 项目初始化 (Setup)

### 目标
创建项目基本结构，配置构建系统和开发环境。

### 任务

- [x] T001 创建浏览器扩展项目基础结构，包含 public/, src/, tests/ 目录
- [x] T002 配置 TypeScript 编译器和 tsconfig.json，目标 ES 2020+
- [x] T003 配置 Webpack/Vite 构建流程，支持扩展打包和开发 HMR

---

## Phase 2: 基础模块 (Foundational)

### 目标
集成第三方库，创建共享的工具和类型系统，为各服务模块奠定基础。

### 共享依赖 (所有用户故事都需要)

- [x] T004 [P] 安装和配置 crypto-js 库，验证 AES-256-CBC 解密功能
- [x] T005 [P] 安装和配置 jszip 库，验证 ZIP 文件生成功能
- [x] T006 [P] 配置 Jest 测试框架和 src/ 目录下的测试环境
- [x] T007 创建 src/types/ 目录，定义全局 TypeScript 类型和接口 (types/index.ts)
- [x] T008 实现 src/utils/logger.ts，提供日志功能（支持日志级别：debug, info, warn, error）
- [x] T009 实现 src/utils/errors.ts，定义自定义错误类（NetworkError, TimeoutError, UnauthorizedError 等）
- [x] T010 实现 src/utils/format.ts，提供文件名清洗函数（移除特殊字符 /:\*?"<>|）

---

## Phase 3: 用户故事 1 - 电子书 EPUB 下载 (P1)

### 用户故事
作为得到 Web 端已登录用户，我希望能够将已购买的电子书下载为 EPUB 格式，以便在本地阅读器中进行离线阅读。

### 独立测试标准
- ✅ 扩展能从电子书详情页提取书籍 ID
- ✅ 点击"下载"按钮后，扩展显示进度条
- ✅ 下载完成后自动触发浏览器文件下载
- ✅ 生成的 EPUB 文件能被 Calibre 或 iBooks 打开
- ✅ 错误场景（未登录、无权限、网络失败）都有友好提示和重试机制

### 数据类型定义

- [x] T011 [P] 在 src/types/ebook.ts 中定义 EbookMetadata 接口（包含 id, enid, title, author, description, coverUrl, chapters, toc）
- [x] T012 [P] 在 src/types/ebook.ts 中定义 Chapter 接口（包含 id, orderIndex, title, content[], level, parentId）
- [x] T013 [P] 在 src/types/ebook.ts 中定义 SvgPage 接口（包含 encryptedSvg, decryptedHtml, pageIndex, isLastPage）
- [x] T014 [P] 在 src/types/ebook.ts 中定义 TableOfContent 接口（包含 href, level, text, playOrder）
- [x] T015 [P] 在 src/types/api.ts 中定义 API 响应类型（ApiResponse<T>, TokenResponse, BookInfoResponse, ChapterPagesResponse）
- [x] T016 [P] 在 src/types/epub.ts 中定义 EPUB 相关类型（EpubPackage, ManifestItem, SpineItem, NavDocument, EpubChapter, EpubResource）
- [x] T017 在 src/types/download.ts 中定义 DownloadTask, TaskStatus, ProgressInfo, TaskError 类型

### 内容脚本和权限

- [x] T018 [US1] 创建 src/content/content-script.ts，实现 getBookIdFromPage() 函数，从当前页面 URL 或 DOM 提取书籍 ID (id 或 enid 参数)
- [x] T019 [US1] 创建 public/manifest.json (Manifest V3)，声明权限 (cookies, https://www.dedao.cn/*)，配置 popup.html 和 content-script

### API 服务层

- [x] T020 [US1] 创建 src/services/api/http.ts，实现 HttpClient 类，支持自动重试（maxRetries=3，指数退避）、超时（30s）、Cookie 读取
- [x] T021 [US1] 创建 src/services/api/ebook.ts，实现 EbookAPI 类，包含：
  - getReadToken(enid: string): Promise<string>
  - getBookInfo(token: string): Promise<EbookMetadata>
  - getChapterPages(chapterId, token, pageIndex): Promise<ChapterPagesResponse>
- [x] T022 [P] [US1] 创建单元测试 src/services/api/__tests__/http.test.ts，测试 HttpClient 的重试和超时逻辑
- [x] T023 [P] [US1] 创建单元测试 src/services/api/__tests__/ebook.test.ts，使用模拟 API 响应测试各个方法

### 加密和转换服务

- [x] T024 [US1] 创建 src/services/crypto/aes.ts，实现 AESCrypto 类：
  - decrypt(encryptedBase64: string): string 方法
  - 使用硬编码的密钥和 IV（参考 research.md）
  - PKCS7 去填充
- [x] T025 [US1] 创建单元测试 src/services/crypto/__tests__/aes.test.ts，使用已知的加密数据测试解密
- [x] T026 [US1] 创建 src/services/svg/converter.ts，实现 SvgConverter 类：
  - convertToHtml(svgString: string): string 方法
  - 解析 SVG 元素（text, tspan, image, path 等）
  - 转换为标准 XHTML（参考 Go 项目的 svg2html.go）
  - 提取图片 URL 到资源列表
- [x] T027 [US1] 创建单元测试 src/services/svg/__tests__/converter.test.ts，使用真实或模拟的 SVG 数据测试转换

### EPUB 生成核心

- [x] T028 [US1] 创建 src/services/epub/manifest.ts，实现 ManifestGenerator 类：
  - generateManifest(epubPackage): string (返回 content.opf XML)
  - generateSpine(chapters): SpineItem[]
  - 包含书籍元数据、资源清单、阅读顺序
- [x] T029 [US1] 创建 src/services/epub/nav.ts，实现 NavGenerator 类：
  - generateNavDocument(chapters, toc): string (返回 nav.xhtml)
  - generateTocNcx(chapters): string (返回 toc.ncx，EPUB 2.0 兼容)
  - 处理多层级目录结构
- [x] T030 [US1] 创建 src/services/epub/utils.ts，实现 EPUB 工具函数：
  - escapeXml(str): string
  - sanitizeId(str): string
  - calculateProgress(current, total): number
  - 其他辅助函数
- [x] T031 [US1] 创建 src/services/epub/generator.ts，实现 EpubGenerator 类：
  - generate(epubPackage): Promise<Blob>
  - validate(epubBlob): Promise<ValidationResult>
  - 使用 jszip 库构建完整的 EPUB 文件结构
  - 遵循 EPUB 3.0 标准（mimetype, META-INF/, OEBPS/ 等）
- [x] T032 [US1] 创建单元测试 src/services/epub/__tests__/generator.test.ts，测试 EPUB 结构生成和验证
- [x] T033 [US1] 创建集成测试，生成一个简单的 EPUB 文件，用 epubcheck 验证（需要模拟环境）

### 下载管理器

- [x] T034 [US1] 创建 src/services/download/manager.ts，实现 DownloadManager 类：
  - startDownload(bookId, enid, onProgress?): Promise<Blob>
  - 协调 API, Crypto, Converter, EpubGenerator 各个模块
  - 管理 DownloadTask 状态和进度更新
  - 处理错误和重试（单章失败重试 3 次）
  - 回调进度函数以供 UI 订阅
- [x] T035 [US1] 创建单元测试 src/services/download/__tests__/manager.test.ts，使用模拟的所有依赖测试完整下载流程

### 弹窗 UI 逻辑

- [x] T036 [US1] 创建 public/popup.html，设计弹窗 UI：
  - 显示当前书籍名称
  - "下载 EPUB" 按钮
  - 进度条（百分比）
  - 进度文本（"获取元数据中" / "下载第 X/N 章" / "生成 EPUB 中"）
  - 错误信息区域
  - 重试按钮（错误时显示）
- [x] T037 [US1] 创建 public/popup.css，实现弹窗样式（清晰的进度显示、现代化 UI）
- [x] T038 [US1] 创建 src/popup/popup.ts，实现 PopupController 类：
  - init(): 获取当前标签页，提取书籍 ID，显示书名
  - onDownloadClick(): 启动下载流程
  - updateProgress(task): 实时更新 UI 进度
  - showError(message, code): 显示错误提示
  - downloadFile(blob, filename): 触发浏览器下载
- [x] T039 [US1] 创建单元测试 src/popup/__tests__/popup.test.ts，测试各个 UI 交互逻辑

### 集成测试

- [x] T040 [US1] 创建集成测试 tests/integration/download.test.ts：
  - 使用模拟的得到 API 响应
  - 模拟完整的下载流程：Token → 元数据 → 章节内容 → EPUB 生成
  - 验证生成的 EPUB 文件结构
  - 测试错误场景（401, 403, 网络失败）

---

## Phase 4: 打磨与错误处理 (Polish)

### 目标
完善错误处理、边缘情况和用户体验。

### 边缘情况处理

- [x] T041 [US1] 在 src/utils/format.ts 中完善文件名清洗函数，处理特殊字符、长度限制（最多 200 字符）
- [x] T042 [US1] 在各服务中添加完整的错误处理和用户友好的错误消息：
  - 401 未授权 → "未登录或会话过期，请重新打开得到页面"
  - 403 禁止 → "无权限，您未购买此书"
  - 网络错误 → "网络连接失败，请检查网络后重试"
  - 解密失败 → "内容解密失败，可能是服务器返回了无效数据"
- [x] T043 [US1] 添加大文件处理优化：
  - 实现逐章节内存释放（处理后删除原始加密数据）
  - 测试 1000+ 章的大书籍（手工测试）
  - 确保内存占用合理

---

## Phase 5: 端到端和交付 (Integration & Release)

### 最终验证

- [x] T044 创建端到端测试脚本 tests/e2e/download-flow.md，文档化完整的手工测试步骤：
  1. 扩展安装
  2. 登录得到 Web
  3. 打开一本已购书籍
  4. 点击扩展下载
  5. 等待完成
  6. 用 Calibre/iBooks 打开 EPUB
  7. 验证内容完整性
- [x] T045 生成 README.md，包含：
  - 功能概述
  - 安装指南（Chrome, Edge, Firefox）
  - 使用说明
  - 已知限制（MVP 范围）
  - 故障排查（常见问题解答）
  - 架构文档引用

---

## 依赖关系图

```
T001, T002, T003 (Setup)
    ↓
T004, T005, T006, T007-T010 (Foundation)
    ↓
┌───────────────────────────────┬──────────────────────────────────────────┐
│                               │                                          │
T011-T017 (Types Definition)   T018-T019 (Content Script & Manifest)
│                               │
T020-T023 (API Service)         T021 (API Implementation)
│                               │
T024-T027 (Crypto & SVG)        T028-T033 (EPUB Generator)
│                               │
T034-T035 (Download Manager)    T036-T039 (Popup UI)
│                               │
└───────────────────────────────┴──────────────────────────────────────────┘
                               ↓
                    T040 (Integration Test)
                               ↓
                  T041-T043 (Polish & Fixes)
                               ↓
                  T044-T045 (Documentation)
```

---

## 并行执行建议

### 第一批（可并行，无依赖）：
- T004: 安装 crypto-js
- T005: 安装 jszip
- T006: 配置 Jest
- T011-T016: 类型定义

### 第二批（依赖第一批）：
- T020: HTTP 客户端
- T024: AES 加密
- T026: SVG 转换
- T028-T031: EPUB 生成

### 第三批（依赖第二批）：
- T021: EbookAPI 实现
- T034: DownloadManager

### 第四批（可与第三批并行）：
- T036-T038: 弹窗 UI

---

## 质量指标

### 代码覆盖率目标
- 单元测试：70% 行覆盖率
- 集成测试：核心路径 100% 覆盖

### 成功标准
- ✅ 所有 45 个任务完成
- ✅ 单元测试通过（T022, T023, T025, T027, T032, T035, T039）
- ✅ 集成测试通过（T040）
- ✅ 生成的 EPUB 通过 epubcheck 验证
- ✅ 支持 < 500 章书籍 < 30 秒完成
- ✅ 错误处理覆盖所有主要场景

---

## 检查清单格式验证

本文档中所有任务都遵循强制格式：
- ✅ 每行以 `- [ ]` 开头（可编辑的 checkbox）
- ✅ 包含 Task ID (T001-T045)
- ✅ [P] 标记表示可并行执行
- ✅ [US1] 标记表示属于用户故事 1
- ✅ 每个任务包含清晰的描述和文件路径
- ✅ Setup 和 Foundation 阶段不带 story 标签
- ✅ User Story 阶段带 [US1] 标签
- ✅ Polish 和 Integration 阶段根据情况标记

---

## 开始实现

推荐按以下顺序开始：

```bash
# 1. 完成 Phase 1 Setup
完成 T001, T002, T003

# 2. 并行完成 Phase 2 Foundation
并行完成 T004-T010

# 3. 并行完成 Phase 3 的类型和初始化
并行完成 T011-T019, T020, T024, T026, T028

# 4. 实现核心服务
完成 T021, T034, T036-T038

# 5. 编写测试
并行完成 T022, T023, T025, T027, T032, T035, T039, T040

# 6. 打磨和文档
完成 T041-T045
```

---

**最后更新**: 2025-12-09
**状态**: 就绪，可开始实现
