# 实施计划: 对齐 EPUB 格式与 Go 项目

**分支**: `002-align-epub-format` | **日期**: 2025-12-10 | **规范**: `/specs/002-align-epub-format/spec.md`
**输入**: 来自 `/specs/002-align-epub-format/spec.md` 的功能规范

**说明**: 本模板由 `/speckit.plan` 命令填充。执行工作流请参见 `.specify/templates/commands/plan.md`。

## 摘要

**需求**: 用户报告浏览器扩展生成的 EPUB 在视觉和结构上与原始 Go CLI 工具生成的不同，特别指出了第一章的排版问题。
**方法**: 调整 `dedao-extension` 代码库以完全模仿 Go 项目的输出。这包括更新 HTML 生成逻辑以匹配 Go 项目的 DOM 结构（`header0`, `part`, `aside`），将样式表移动到 `EPUB/css/cover.css`，并对齐图片命名/标签规范。

## 技术背景

**语言/版本**: TypeScript 5.x (浏览器扩展)
**主要依赖**: `jszip` (ZIP 生成), `cheerio` (如果需要 HTML 解析/操作，当前使用字符串模板/DOM API), `crypto-js` (用于解密，现有)
**存储**: N/A (仅文件生成)
**测试**: Jest (单元/集成)，与参考 EPUB 的手动对比
**目标平台**: 浏览器扩展 (Chrome/Edge/Firefox, Manifest V3)
**项目类型**: 浏览器扩展
**性能目标**: EPUB 生成 < 30秒 (客户端)
**约束**: 必须生成有效的 EPUB 3.0；必须在结构上尽可能与 Go 输出字节对齐。
**规模/范围**: 重构现有的 `EpubGenerator`、`SvgConverter` 和 `Chapter` 处理逻辑。

## 章程检查

*门禁：Phase 0 研究前必须通过。Phase 1 设计后重新评估。*

### ✅ I. 模块化架构
- **状态**: ✅ 通过
- **说明**: 更改仅限于 `src/services/epub/` (Generator, Manifest) 和 `src/services/svg/` (Converter)。它改进了现有模块，没有紧密耦合。

### ✅ II. 道德合规与版权
- **状态**: ✅ 通过
- **说明**: 纯格式更改。不更改 DRM 处理或内容访问范围。

### ✅ III. 最小权限原则 (安全性)
- **状态**: ✅ 通过
- **说明**: 不需要新权限。文件生成在本地内存中进行。

### ✅ IV. 技术栈与参考
- **状态**: ✅ 通过
- **说明**: 我们明确按照章程的“参考驱动实现”工作流，与 `dedao-dl` (Go) 参考逻辑对齐。

### ✅ V. 产品范围策略
- **状态**: ✅ 通过
- **说明**: 仍专注于电子书下载 (v1.0 范围)。

## 项目结构

### 文档 (本功能)

```text
specs/002-align-epub-format/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
└── tasks.md             # Phase 2 输出
```

### 源代码 (仓库根目录)

```text
dedao-extension/
├── src/
│   ├── services/
│   │   ├── epub/
│   │   │   ├── generator.ts  # 更新: 文件路径 (css/cover.css), 结构
│   │   │   ├── manifest.ts   # 更新: 清单条目
│   │   │   └── utils.ts      # 更新: 图片命名逻辑
│   │   └── svg/
│   │       ├── converter.ts  # 更新: HTML 结构生成
│   │       └── complex-converter.ts # 更新: 标题/脚注逻辑
│   └── types/
│       └── epub.ts           # 更新: 如果需要新的结构类型
└── tests/
    └── integration/          # 更新: 针对参考结构进行验证
```

**结构决策**: 我们保持现有的 `dedao-extension` 结构，但重构 `services/epub` 和 `services/svg` 模块的内部逻辑。不需要新的顶层目录。

## 复杂度追踪

| 违规项 | 为何需要 | 拒绝更简单替代方案的原因 |
|--------|----------|--------------------------|
| 无 | N/A | N/A |
