# 快速开始: EPUB 对齐功能

## 概览

此功能将浏览器扩展的 EPUB 输出与原始 Go CLI 工具对齐，确保生成的 EPUB 在结构、样式和文件命名上一致。

## 关键变更

1. **CSS 位置**: 样式表现在位于 `EPUB/css/cover.css`（统一引用）
2. **HTML 结构**:
   - 章节使用 `<div id="Chapter_X_Y"></div>` 标识符
   - `<div class="headerN"><h2>...</h2></div>` 包装标题
   - `<div class="part">...</div>` 包装页面内容
   - 脚注 `<aside epub:type="footnote">` 位于 div.part 最开始
3. **图片**:
   - 命名为 `image_000.ext` 等（3位数字）
   - 脚注图标添加 `class="epub-footnote"`
4. **章节ID**: 格式为 `Chapter_X_Y[_ZZZZ]`（X为顶层编号，Y为子编号）

## 验证步骤

### 编译和单元测试

1. 编译 TypeScript:
   ```bash
   npm run build
   ```

2. 运行单元测试:
   ```bash
   npm test
   ```
   期望输出: 所有测试通过 (15 passed)

### EPUB 结构对比（推荐）

1. 生成 EPUB:
   ```bash
   export DEDAO_COOKIE='...'
   npx ts-node dedao-extension/scripts/manual-test.ts <BookID> <EnID>
   ```

2. 运行对比脚本:
   ```bash
   npx ts-node dedao-extension/scripts/compare-epub.ts \
     specs/002-align-epub-format/fixtures/reference.epub \
     dedao_<BookID>.epub
   ```

   脚本检查项:
   - ✓ CSS 文件位置 (`EPUB/css/cover.css`)
   - ✓ 图像文件命名模式 (`image_XXX.ext`)
   - ✓ 章节 HTML 结构 (header divs, part divs)
   - ✓ 文件结构一致性

### 手动验证（深度检查）

1. 解压生成的 EPUB:
   ```bash
   unzip dedao_<BookID>.epub -d dist_epub
   ```

2. 检查 CSS 引用:
   ```bash
   grep -r "href=" dist_epub/EPUB/xhtml/ | head -3
   # 应输出: href="../css/cover.css"
   ```

3. 检查章节结构:
   ```bash
   head -20 dist_epub/EPUB/xhtml/Chapter_1_1_0001.xhtml
   # 应包含: <div id="Chapter_1_1_0001"></div>
   #        <div class="header1"><h2>...
   #        <div class="part">
   ```

4. 检查脚注位置:
   ```bash
   grep -n "<aside\|<p>" dist_epub/EPUB/xhtml/Chapter_1_1_0001.xhtml | head -5
   # 应显示: <aside> 标签在 <p> 标签之前
   ```

### 预期输出格式

参考 EPUB 的结构示例:
```xml
<div id="Chapter_1_1_0001"></div>
<div class="header1"><h2>
  <span ...><b>标</b><b>题</b></span>
</h2></div>
<div class="part">
  <aside epub:type="footnote" id="footnote-3-4">...</aside>
  <p><span ...>正文内容...</span></p>
</div>
```