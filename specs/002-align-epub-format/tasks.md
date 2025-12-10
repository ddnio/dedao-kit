# 实现任务: 对齐 EPUB 格式与 Go 项目

**版本**: 1.0.0 | **日期**: 2025-12-10 | **分支**: `002-align-epub-format`

---

## 概览

本文档定义了将浏览器扩展生成的 EPUB 格式与原始 Go 项目输出对齐的所有实现任务。目标是修复排版问题，确保文件结构、HTML 标记和资源命名的一致性。

### 关键数据
- **总任务数**: 12
- **总阶段**: 4 (Setup + US1 + US2 + Polish)
- **并行机会**: 部分任务可并行执行
- **预计工期**: 1-2 周

### 用户故事 (User Stories)

| ID | 故事 | 优先级 | 任务数 | 状态 |
|----|-----|------|--------|------|
| US1 | 一致的视觉排版 | P1 | 5 | 完成 |
| US2 | 结构对齐 | P2 | 4 | 完成 |

---

## Phase 1: 准备工作 (Setup)

### 目标
准备测试环境和验证工具。

- [x] T001 确保本地有 Go 项目生成的参考 EPUB 文件用于对比测试 (tests/fixtures/ref.epub)
- [x] T002 创建用于比较 EPUB 结构和内容的辅助测试脚本 (scripts/compare-epub.ts)

---

## Phase 2: 用户故事 1 - 一致的视觉排版 (P1)

### 目标
解决排版和样式问题，通过完全模仿参考文件的 HTML 结构和 CSS 路径。

### CSS 和资源路径对齐

- [x] T003 [US1] 修改 `src/services/epub/generator.ts`，将 `style.css` 的写入路径从 `EPUB/style.css` 更改为 `EPUB/css/cover.css`
- [x] T004 [US1] 修改 `src/services/download/manager.ts` 或相关逻辑，确保生成的 XHTML 文件引用 CSS 的路径为 `../css/cover.css`

### 图片命名与属性

- [x] T005 [US1] 修改 `src/services/download/manager.ts` 中的图片计数器逻辑，确保从 0 (封面) 或 1 (内容) 开始，并使用 `image_XXX.ext` (3位填充) 格式命名
- [x] T006 [US1] 修改 `src/services/svg/complex-converter.ts`，确保 `<img>` 标签生成的 `width` 属性为整数或与参考一致的精度，并为小图标添加 `class="epub-footnote ..."`

### 验证

- [x] T007 [US1] 运行 `npm test` 并通过手动脚本验证生成的 CSS 路径和图片命名

---

## Phase 3: 用户故事 2 - 结构对齐 (P2)

### 目标
确保内部 HTML 结构（DOM 层级）与参考完全一致。

### HTML 结构重构

- [x] T008 [US2] 重构 `src/services/svg/converter.ts` 或 `complex-converter.ts`，使其输出的 HTML 结构包含 `<div class="header0">` 和 `<div class="part">` 包装器
- [x] T009 [US2] 确保章节 ID (`<div id="...">`) 的生成逻辑与参考文件一致
- [x] T010 [US2] 调整脚注处理逻辑，确保 `<aside epub:type="footnote">` 放置在 `div.part` 内部的正确位置（通常在段落前或作为块级元素）

### 元数据对齐

- [x] T011 [US2] 修改 `src/services/epub/manifest.ts`，确保生成的 `package.opf` 包含 `<meta name="cover" content="...">` 标签，且 ID 引用正确

---

## Phase 4: 打磨与交付 (Polish)

### 目标
最终验证和清理。

- [x] T012 运行完整的集成测试 `tests/integration/download.test.ts`，并使用 `scripts/compare-epub.ts` 对比生成的 EPUB 与参考 EPUB，确保无结构差异

---

## 依赖关系

```
T001, T002 (Setup)
    ↓
T003, T004 (CSS Path)
    ↓
T005, T006 (Images) -> T007 (Verification)
    ↓
T008, T009, T010 (HTML Structure)
    ↓
T011 (Metadata)
    ↓
T012 (Final Verification)
```

## 执行建议

1.  **优先完成 Phase 2**，特别是 CSS 路径和图片命名，这直接影响视觉效果。
2.  **Phase 3** 的 HTML 结构调整可能需要较多调试，建议每改动一个部分就生成一次 EPUB 进行对比。
3.  使用 `unzip -l` 和 `diff` 命令快速检查结构差异。