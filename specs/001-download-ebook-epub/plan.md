# 实现计划: 电子书 EPUB 下载

**分支**: `001-download-ebook-epub` | **日期**: 2025-12-09 | **规范**: `/specs/001-download-ebook-epub/spec.md`
**输入**: 来自规范的功能描述和5个关键澄清决策

**说明**: 本计划由 `/speckit.plan` 命令生成。工作流见 `.specify/templates/commands/plan.md`。

## 总结

**核心需求**：浏览器扩展 MVP，使用户能在已登录的得到 Web 环境中单次下载一本已购电子书为 EPUB 格式，实现离线阅读。

**技术方案**：
1. 浏览器扩展 + HTML 弹窗UI，复用浏览器 Cookies 认证
2. 参考 Go 项目逻辑：Token → 元数据 → AES-256-CBC 解密 → SVG→HTML转换 → EPUB 生成
3. 纯客户端实现，使用 jszip 库和手工 EPUB 结构，避免小众库风险
4. 单章节失败自动重试 3 次，无并发/缓存复杂性

## 技术背景

**语言/版本**: TypeScript 5.x，目标 ES 2020+
**主要依赖**:
- `jszip`: ZIP 文件生成（EPUB 是 ZIP 格式）
- `crypto-js`: AES-256-CBC 解密
- 浏览器原生 API: `fetch`, `Blob`, `File`

**存储**: 无持久存储（MVP 阶段），仅内存处理
**测试**: Jest（单元测试），手工集成测试（真实或模拟得到 API）
**目标平台**: 浏览器扩展（Manifest V3），支持 Chrome, Edge, Firefox
**项目类型**: 浏览器扩展 + 纯前端
**性能目标**: < 30 秒内完成纯文字书籍（< 500章）的下载+生成
**约束**:
- 单次下载一本书（无并发）
- 顺序逐章获取，章节失败重试 3 次
- 无网络缓存，每次重新下载
- 内存占用需控制（大型书籍可能数百 MB）

**规模/范围**:
- MVP 仅支持电子书 EPUB 下载
- 未来可扩展到课程、听书等内容

## 章程检查

*门禁检查：Phase 0 研究前必须通过。Phase 1 设计后重新评估。*

### ✅ 模块化架构 (原则 I)
- **状态**: ✅ 通过
- **说明**: 电子书下载模块与认证、网络层解耦。未来可独立扩展课程、听书模块。

### ✅ 道德合规与版权 (原则 II)
- **状态**: ✅ 通过
- **说明**: 工具仅下载用户已合法购买的内容。RequiresReadToken 验证，不规避 DRM。

### ✅ 最小权限原则 (原则 III)
- **状态**: ✅ 通过
- **说明**: 扩展仅需 `cookies` 权限读取会话 Cookie，`fetch` 权限调用得到 API。不申请广泛的 `<all_urls>` 权限。

### ✅ 技术栈与参考 (原则 IV)
- **状态**: ✅ 通过
- **说明**: 使用 TypeScript，目标 Manifest V3。参考 Go 项目逻辑而非直译代码。

### ✅ 产品范围策略 (原则 V)
- **状态**: ✅ 通过
- **说明**: MVP 仅聚焦电子书 EPUB 下载。架构支持未来无需重大重构添加其他内容类型。

### ✅ 文档语言规范
- **状态**: ✅ 通过
- **说明**: 本计划及所有设计文档使用中文。代码变量、函数名英文，注释中文。

### 门禁结果
🟢 **所有门禁通过。可继续进行 Phase 0 研究。**

## 项目结构

### 文档（本特性）

```text
specs/001-download-ebook-epub/
├── spec.md              # 功能规范
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # Phase 0 输出（研究成果）
├── data-model.md        # Phase 1 输出（数据模型）
├── quickstart.md        # Phase 1 输出（快速开始指南）
├── contracts/           # Phase 1 输出（API 契约）
└── tasks.md             # Phase 2 输出（/speckit.tasks 生成）
```

### 源代码结构

```text
# 浏览器扩展 + 前端项目
dedao-dl/
├── public/
│   ├── manifest.json         # Manifest V3 配置
│   ├── popup.html            # 弹窗 HTML
│   └── icons/                # 扩展图标
│
├── src/
│   ├── content/
│   │   └── content-script.ts # 获取当前页面电子书 ID
│   │
│   ├── popup/
│   │   ├── popup.ts          # 弹窗逻辑控制
│   │   ├── popup.css         # 弹窗样式
│   │   └── components/       # UI 组件
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── ebook.ts      # 电子书 API 调用
│   │   │   └── http.ts       # HTTP 请求包装（Cookie、重试等）
│   │   ├── crypto/
│   │   │   └── aes.ts        # AES-256-CBC 解密
│   │   ├── epub/
│   │   │   ├── generator.ts  # EPUB 生成核心
│   │   │   ├── manifest.ts   # EPUB Manifest 生成
│   │   │   └── utils.ts      # EPUB 工具函数
│   │   ├── svg/
│   │   │   └── converter.ts  # SVG → HTML 转换
│   │   └── download/
│   │       └── manager.ts    # 下载任务管理
│   │
│   ├── types/
│   │   ├── ebook.ts          # 电子书数据类型
│   │   ├── api.ts            # API 响应类型
│   │   └── epub.ts           # EPUB 相关类型
│   │
│   ├── utils/
│   │   ├── logger.ts         # 日志工具
│   │   ├── errors.ts         # 错误定义
│   │   └── format.ts         # 格式化工具（文件名清洗等）
│   │
│   └── index.ts              # 入口点
│
└── tests/
    ├── unit/
    │   ├── crypto.test.ts    # AES 解密测试
    │   ├── epub.test.ts      # EPUB 生成测试
    │   └── svg.test.ts       # SVG 转换测试
    │
    ├── integration/
    │   └── download.test.ts  # 端到端下载流程测试
    │
    └── mocks/
        └── api-responses.ts  # 得到 API 模拟响应
```

**结构设计说明**：
- **content/**: 获取当前页面书籍ID，与 UI 解耦
- **popup/**: 用户界面，进度显示、错误提示
- **services/api**: 所有得到 API 调用，认证、重试、错误处理集中
- **services/crypto**: 敏感密钥和解密逻辑独立模块
- **services/epub**: EPUB 生成核心逻辑，易于测试和验证
- **services/svg**: SVG→HTML 转换，参考 Go 项目算法
- **types/**: 统一的 TypeScript 类型定义，减少运行时错误

## Phase 0: 研究与澄清

> 此阶段已在 `/speckit.clarify` 中完成。所有关键技术决策已通过5个澄清问题确认。

**已完成的研究**：
1. ✅ Go 项目的电子书下载完整流程（Token、API、解密、EPUB生成）
2. ✅ AES-256-CBC 加密参数和解密逻辑
3. ✅ SVG→HTML 转换的 Go 实现参考
4. ✅ EPUB 3.0 标准格式要求
5. ✅ 浏览器扩展权限最小化策略

**无待解决的澄清项**：所有 NEEDS CLARIFICATION 均已通过用户确认解决。

---

## Phase 1: 设计与契约

> 本节由 `/speckit.plan` 命令生成。包含完整的数据模型、API 契约、快速开始指南。

### ✅ 1. 数据模型 (data-model.md)

**已完成**。包含：
- **EbookMetadata**: 书籍元信息（ID、标题、作者、封面URL、章节列表）
- **Chapter**: 章节（ID、标题、索引、SVG内容、生命周期管理）
- **DownloadTask**: 下载任务追踪（状态、进度、错误日志）
- **EpubPackage**: EPUB 3.0 文件结构（Manifest、导航文档、章节、资源）

**关键特性**：
- 完整的生命周期管理（从数据获取到释放）
- 内存优化策略（逐章处理，及时释放）
- 详细的验证规则和约束
- EPUB 标准兼容性

### ✅ 2. API 契约 (contracts/)

**已完成**。包含两个文件：

**ebook-api.md** - 得到后端 API：
- `POST /api/pc/ebook2/v1/pc/read/token` - 获取读书令牌
- `GET /ebk_web/v1/get_book_info?token=xxx` - 获取书籍信息与章节列表
- `POST /ebk_web_go/v2/get_pages` - 分页获取加密的 SVG 页面内容

特点：
- 完整的请求/响应示例
- 错误码详细说明
- 分页逻辑说明
- 加密参数（AES-256-CBC）
- Cookie 认证方式

**extension-api.md** - 扩展内部 API：
- `ContentScriptAPI`: 页面 ID 提取
- `EbookAPI`: 统一的电子书 API 层
- `HttpClient`: HTTP 请求包装（重试、超时、错误处理）
- `AESCrypto`: AES-256-CBC 解密
- `SvgConverter`: SVG → HTML 转换
- `EpubGenerator`: EPUB 文件生成
- `DownloadManager`: 下载任务管理
- `PopupController`: 弹窗 UI 逻辑

特点：
- 清晰的模块接口定义
- 错误处理约定
- 事件流和通信模式
- 类型系统设计

### ✅ 3. 快速开始 (quickstart.md)

**已完成**。包含：
- **架构概览**: 完整的系统图示
- **工作流详解**: 6 个阶段的顺序执行步骤
- **核心 API 参考**: 主要服务层接口
- **错误处理示例**: 网络、认证、单章失败的处理
- **开发和测试**: 项目初始化、扩展加载、测试运行
- **常见问题解答**: 认证、下载中断、EPUB 兼容性、内存问题
- **文件结构速查**: 项目目录快速查询

---

## Phase 1 设计总结

### 核心架构决策

1. **分层设计**：
   - 扩展 UI 层 (popup, content-script)
   - 服务层 (api, crypto, svg, epub, download)
   - 工具层 (logger, errors, format)
   - 类型定义层 (types/)

2. **错误处理**：
   - 具体的错误类继承体系
   - 自动重试机制（最多 3 次，指数退避）
   - 用户友好的错误提示

3. **内存管理**：
   - 逐章节处理，及时释放原始加密数据
   - 不缓存，每次完整重新下载（MVP 范围）
   - EPUB 流式生成，避免全量加载内存

4. **标准合规**：
   - EPUB 3.0 标准结构
   - Manifest V3 浏览器扩展标准
   - TypeScript 类型安全

---

## 章程检查（Phase 1 后）

所有门禁仍然通过：

✅ 模块化架构（电子书模块独立，支持未来扩展）
✅ 道德合规（仅下载已购内容，不规避 DRM）
✅ 最小权限（仅申请必要权限）
✅ 技术栈（TypeScript + Manifest V3）
✅ 产品范围（MVP 仅电子书，架构支持扩展）

---

## 生成的文件清单

```
specs/001-download-ebook-epub/
├── spec.md                    # 功能规范（已有）
├── plan.md                    # 本文件
├── research.md                # ✅ Phase 0 研究成果
├── data-model.md              # ✅ 数据模型
├── quickstart.md              # ✅ 快速开始指南
└── contracts/
    ├── ebook-api.md           # ✅ 得到 API 契约
    └── extension-api.md       # ✅ 扩展内部 API 契约

[待生成]
└── tasks.md                   # Phase 2：实现任务分解 (/speckit.tasks)
```

---

## 下一步行动

🚀 **Phase 1 完成。可进行 Phase 2 任务分解。**

运行以下命令生成实现任务：

```bash
/speckit.tasks   # 生成 tasks.md，包含依赖排序的实现任务列表
```

然后运行：

```bash
/speckit.implement   # 执行 tasks.md 中定义的所有任务
```

---

**报告**：
- ✅ Phase 0 研究完成（5个澄清项已解决）
- ✅ Phase 1 设计完成（4个设计文档已生成）
- 📋 Phase 2 待开始（任务分解和实现）
- 🔍 所有章程门禁通过
