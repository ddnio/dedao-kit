# 快速开始: EPUB 对齐功能

## 概览

此功能将浏览器扩展的 EPUB 输出与原始 Go CLI 工具对齐，以修复排版问题。

## 关键变更

1.  **CSS 位置**: 样式表现在位于 `EPUB/css/cover.css`。
2.  **HTML 结构**: 章节使用 `<div class="part">` 和 `div.header0` 包装器。
3.  **图片**: 命名为 `image_000.ext`（3位数字），属性与 Go 输出匹配。

## 测试

### 手动验证

1.  运行手动测试脚本:
    ```bash
    export DEDAO_COOKIE='...'
    npx ts-node scripts/manual-test.ts <BookID> <EnID>
    ```
2.  解压生成的 EPUB:
    ```bash
    unzip dedao_<BookID>.epub -d dist_epub
    ```
3.  与参考（如果可用）比较:
    ```bash
    diff dist_epub/EPUB/xhtml/Chapter_1_1.xhtml ref_epub/EPUB/xhtml/Chapter_1_1
    ```

### 单元测试

运行 `npm test` 以验证:
- `EpubGenerator` 将 CSS 放置在正确位置。
- `ComplexSvgConverter` 生成正确的 HTML 结构。