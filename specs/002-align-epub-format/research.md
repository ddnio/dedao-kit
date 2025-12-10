# 研究: 对齐 EPUB 格式

**功能**: 对齐 EPUB 格式与 Go 项目
**状态**: 已完成

## 1. HTML 结构对齐

**决策**: 章节的 XHTML 结构完全复制 Go 项目的结构。

**理由**: Go 项目（参考）使用特定的 DOM 层级（`<div class="header0">`, `<div class="part">`），用户偏好这种结构，或者它在阅读器中的渲染效果更好。当前的扩展输出结构较扁平或包裹方式不同（`chapter-content` -> `page-content`）。

**实施细节**:
- **当前 (扩展)**:
  ```html
  <div class="chapter-content">
    <div class="page-content">...</div>
  </div>
  ```
- **目标 (Go 参考)**:
  ```html
  <div id="Chapter_ID"></div>
  <div class="header0"><h1>...</h1></div>
  <div class="part">
    <aside epub:type="footnote">...</aside>
    <p>内容...</p>
  </div>
  ```
- **行动**: 更新 `SvgConverter` 或 `DownloadManager` 中的后处理逻辑，以生成此特定结构。具体来说，脚注应被收集并放置在 `<div class="part">` 的顶部或按照参考内联放置，而不是追加到末尾。

## 2. 样式表位置

**决策**: 将 `style.css` 从 `EPUB/style.css` 移动到 `EPUB/css/cover.css`。

**理由**: 参考 EPUB 将样式放置在 `css` 子目录中。这确保了 XHTML 文件中的相对路径（`href="../css/cover.css"`）与参考预期匹配。

**实施细节**:
- 更新 `EpubGenerator`: 将文件写入路径从 `EPUB/style.css` 更改为 `EPUB/css/cover.css`。
- 更新 `DownloadManager`: 更新生成的 XHTML 中的 `<link>` 标签，使其指向 `../css/cover.css`（假设 XHTML 文件在 `EPUB/xhtml/` 中）。

## 3. 图片命名与属性

**决策**: 使用 `image_XXX.ext`（3位数字填充）和特定的 `<img>` 属性。

**理由**: 
- **命名**: 参考使用 `image_000.png`。扩展当前使用 `image_002.png`（可能是起始索引问题或计数器不同）。我们需要3位填充。
- **属性**: 参考使用 `<img width="10" ... class="epub-footnote ..."/>`。扩展使用 `<img width="10.000000" ... />`。为了样式匹配，需要确切的宽度格式和类。

**实施细节**:
- **计数器**: 确保图片计数器从 0 或 1 开始，与参考匹配（参考 `image_000.png` 是封面，`image_001.svg` 是第一个内容图片）。
- **格式化**: 更新 `ComplexSvgConverter` 将宽度格式化为整数（如果是整数）或严格匹配参考精度，并为脚注图片添加 `class="epub-footnote ..."`。

## 4. 章节拆分

**决策**: 保持当前的章节拆分，但确保文件命名一致。

**理由**: 参考拆分了章节（`Chapter_1_1`, `Chapter_1_1_0001`）。扩展也这样做。我们需要确保命名约定 `Chapter_X_Y` vs `Chapter_X_Y_Z` 与 `id` 生成逻辑一致。

**实施细节**:
- 扩展在这方面做得大多正确，但我们将验证 ID 生成的清理逻辑，确保与 Go 版本相比不会剥离或添加不需要的字符。

## 5. 元数据与清单

**决策**: 更新 `package.opf` 生成以包含特定的元标签（如果缺失）。

**理由**: 参考有 `<meta name="cover" content="cover-image" />`。我们需要确保我们的 `ManifestGenerator` 生成严格兼容的 OPF XML。

**实施细节**:
- 验证 `manifest.ts` 正确包含封面元标签。
- 确保 `toc.ncx` 生成与 EPUB 2.0 向后兼容性一致（如果 Go 项目这样做的话 - 它是这样做的）。