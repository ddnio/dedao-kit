# 扩展内部 API: EPUB 生成

## EpubGenerator

### `generate(package: EpubPackage): Promise<Blob>`

**变更**:
- **输入**: 相同的 `EpubPackage` 对象。
- **行为**:
  - 将 `style.css` 写入 `EPUB/css/cover.css`。
  - 维持 `EPUB/images/` 和 `EPUB/xhtml/` 结构。
  - 生成具有严格对齐元数据的 `package.opf`。

## SvgConverter / ComplexSvgConverter

### `convert(svg: string, chapterId: string): ConversionResult`

**变更**:
- **输出**: `html` 字符串现在必须包含 `div.part` 包装器，并在此处提取脚注时将其适当地放置。
- **图片处理**:
  - 如果是小图标，`<img>` 标签必须具有 `class="epub-footnote ..."`。
  - `width` 属性必须格式化为整数或匹配参考精度（例如 `10` 而不是 `10.000000`）。

## DownloadManager

### `startDownload(...)`

**变更**:
- **编排**:
  - 将图片计数器初始化为 `0` 或 `1`（检查参考：`image_000` 是封面，`image_001` 是第一个）。
  - 使用新模板构建章节 HTML：
    ```javascript
    `...<div id="${id}"></div><div class="header0"><h1>...</h1></div><div class="part">${content}</div>...`
    ```
  - 确保 CSS 链接是 `<link href="../css/cover.css" .../>`。