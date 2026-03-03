# 实现任务: 对齐 EPUB 格式与 Go 项目

**版本**: 1.1.0 | **日期**: 2025-12-11 | **分支**: `002-align-epub-format`

---

## 概览

- **总任务数**: 13
- **阶段**: 5 (Setup + Foundational + US1 + US2 + Polish)
- **并行机会**: 常量/utility 定义、Generator 和 Converter 调整、图像与结构修复可同步执行
- **预计工期**: 7 个工作日

---

## Phase 1: 准备工作 (Setup)

**目标**: 建立可重复的对比基准和验证工具供后续实现使用

- [x] T001 创建 `specs/002-align-epub-format/fixtures` 并复制 `dedao-extension/131902_庄子_庄子 著；孙雍长 译注.epub` 为 `specs/002-align-epub-format/fixtures/reference.epub`，保证对比时有稳定的参考文件
- [x] T002 修改 `dedao-extension/scripts/compare-epub.ts` 以接收新基准路径、在日志中明确 CSS 路径（`EPUB/css/cover.css`）和图片命名（`image_XXX.ext`）的检查结果，便于自动验证对齐规则

---

## Phase 2: 基础能力 (Foundational)

**目标**: 将对齐规范抽象为可复用的常量和路径 helpers，以便各用户故事共享

- [x] T003 [P] 扩展 `dedao-extension/src/services/epub/utils.ts`，导出 `cssRelativePath()`, `chapterDirectory()`, `formatImageResourceFileName(index, ext)` 等 helper，并附带简短文档，确保所有服务引用统一的 `EPUB/css/cover.css` 与 `image_XXX.ext` 约定
- [x] T004 [P] 更新 `dedao-extension/src/services/download/manager.ts` 中的 EPUB 资源构造逻辑以引用上述 helper，提前将每个 CSS、图片、章节资源的 `href` 指向 `EPUB/css/cover.css`/`EPUB/images/image_XXX.ext`，为用户故事级修改打好基础

---

## Phase 3: 用户故事 1 - 一致的视觉排版 (P1)

**目标**: 让扩展生成的 EPUB 在 CSS 引用与图片处理上与 Go 参考对齐

**独立测试**: 使用 `npx ts-node scripts/compare-epub.ts specs/002-align-epub-format/fixtures/reference.epub dedao_<BookID>.epub` 验证 `EPUB/css/cover.css`、`image_XXX.ext` 和 CSS 属性格式

### 实现任务

- [x] T005 [P] [US1] 更新 `dedao-extension/src/services/epub/generator.ts`，遇到 CSS 资源时始终写入 `EPUB/css/cover.css`（无论原始 `href` 是否为 `style.css`）并在日志中报错不匹配的输入
- [x] T006 [US1] 将 `dedao-extension/src/services/download/manager.ts` 中生成 XHTML 的 `<link>` 标签统一改为 `href="../css/cover.css"` 并使用 `cssRelativePath()` helper，确保所有章节引用的样式文件与参考一致
- [x] T007 [US1] 调整 `dedao-extension/src/services/svg/complex-converter.ts`，生成的 `<img>` 标签将 `width`/`height` 保持整数、为脚注图标附加 `class="epub-footnote"`、并通过 `formatImageResourceFileName()` 记录 `image_XXX.ext` 命名，贴合参考图像展示效果

**Parallel Example**: 同时运行 T005 和 T007 ——Generator 与 SVG Converter 可各自处理 CSS 资源与图像属性，不会相互阻塞

---

## Phase 4: 用户故事 2 - 结构对齐 (P2)

**目标**: 让章节 HTML 层级、脚注位置与 `package.opf` 元数据与 Go 参考完全一致

**独立测试**: 解压生成 EPUB（`unzip dedao_<BookID>.epub -d dist_epub`），确认 `XHTML/Chapter*.xhtml` 包含 `<div class="header0">`、`<div class="part">`、`<aside epub:type="footnote">` 并使用 `NavGenerator`/`ManifestGenerator` 输出带 `<meta name="cover" content="cover-image" />` 的 `package.opf`

### 实现任务

- [ ] T008 [P] [US2] 重构 `dedao-extension/src/services/svg/converter.ts`，在生成 HTML 片段时加入 `<div id="Chapter_ID"></div>`、`<div class="header0"><h1>...</h1></div>` 和包裹 `<div class="part">...</div>`，并确保章节标题只出现一次
- [ ] T009 [US2] 在 `dedao-extension/src/services/svg/complex-converter.ts` 中将脚注内容/`<aside>` 插入到 `div.part` 内部的适当位置（不再附加到文末），以匹配参考 EPUB 的 DOM 层级
- [ ] T010 [US2] 修改 `dedao-extension/src/services/epub/manifest.ts`，在打包 `package.opf` 时添加 `<meta name="cover" content="cover-image" />`、保证 manifest/spine 的 ID 与 `EpubPackage` 中定义的一致，并记录 linear 属性
- [ ] T011 [US2] 调整 `dedao-extension/src/services/download/manager.ts` 的章节 ID 生成器，确保输出的 `id` 形式为 `Chapter_X_Y[_Z]`，与 Go 项目命名约定保持一致

**Parallel Example**: T009（脚注 placement）与 T010（manifest metadata）可以并行完成，因为脚注平移只影响 XHTML 内容，而 manifest 关注 XML 清单

---

## Phase 5: 打磨与交付 (Polish)

**目标**: 补充文档与验证步骤，确保最终输出可复现

- [ ] T012 [P] 运行 `npm test`（`dedao-extension`）并执行 `npx ts-node scripts/compare-epub.ts specs/002-align-epub-format/fixtures/reference.epub <生成文件>`，记录检查结果以证明结构、CSS 与命名对齐
- [ ] T013 更新 `specs/002-align-epub-format/quickstart.md`，把新的验证步骤（基线 EPUB、compare 脚本、命名要求）写入“测试”部分并列出命令与预期输出

---

## 依赖关系 & 执行顺序

```
Phase1 Setup (T001 → T002)
    ↓
Phase2 Foundational (T003, T004) [blocks user stories]
    ↓
Phase3 User Story 1 (T005 → T007)
    ↓
Phase4 User Story 2 (T008 → T011)
    ↓
Phase5 Polish (T012 → T013)
```

- **Story 顺序**: US1 (T005-007) 先完成以验证视觉输出 → US2 (T008-011) 深度对结构/metadata → 最终阶段确认
- **Parallel 提示**: T003/T004 与 US1/US2 任务可在不同开发者之间并行处理，T005/T007 和 T008/T009 也互不依赖

---

## Implementation Strategy

### MVP First

1. 完成 Setup + Foundational (Phase1+Phase2)，确保所有资源路径/命名由 helper 管理
2. 先交付 US1（T005-007）仅依赖 CSS/图像，验证 `compare-epub.ts` 输出
3. 确认 US1 通过后再推进 US2（T008-011）以对齐 HTML 结构与清单
4. 最后运行 Polish 阶段的验证和文档更新（T012-T013）

### Incremental Delivery

- 每完成一个 `User Story` 便生成一个 EPUB 并运行 `compare-epub.ts`，确保独立交付
- Story 之间再调用 `npm test`/`scripts/manual-test.ts` 作为回归验证

### Parallel 控制

- T003/T004（helpers 与 manager 针对资源）的改动可先行，由不同开发者同时推进
- US1 与 US2 在 Foundational 完成后可分别在不同分支/开发者中并行推进（T005/T007 与 T008/T009）
- Polish 任务（T012/T013）在所有实现任务完成后由 QA/文档组接手

***
