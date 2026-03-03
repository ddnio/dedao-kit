# 数据模型: EPUB 结构对齐

**规范**: `/specs/002-align-epub-format/spec.md`

## 实体

### EpubPackage (更新)

表示要生成的 EPUB 文件的结构。

| 字段 | 类型 | 描述 | 约束 |
|------|------|------|------|
| `metadata` | `EbookMetadata` | 书籍元数据 | 标题, 作者等 |
| `manifest` | `ManifestItem[]` | 所有资源的列表 | ID 必须匹配 `spine` |
| `spine` | `SpineItem[]` | 阅读顺序 | 线性/非线性 |
| `resources` | `EpubResource[]` | 文件内容 | 二进制或文本 |
| `toc` | `NavPoint[]` | 目录 | 层级结构 |

### EpubResource (更新)

| 字段 | 类型 | 描述 | 约束 |
|------|------|------|------|
| `id` | `string` | 唯一标识符 | `cover-image`, `css`, `image_XXX` |
| `href` | `string` | ZIP 中的路径 | `EPUB/css/cover.css`, `EPUB/images/image_000.png` |
| `mediaType` | `string` | MIME 类型 | `text/css`, `image/png` |
| `content` | `Blob | string | ArrayBuffer` | 文件内容 | |

### Chapter (逻辑更新)

模式无变更，但**内容**字符串生成逻辑变更。

- **旧结构**:
  ```html
  <body>
    <h1>Title</h1>
    <div class="chapter-content">
       ...
    </div>
  </body>
  ```

- **新结构**:
  ```html
  <body>
    <div id="Chapter_ID"></div>
    <div class="header0"><h1>...</h1></div>
    <div class="part">
       <aside>...</aside>
       <p>...</p>
    </div>
  </body>
  ```

## 验证规则

1.  **图片命名**: 必须匹配 `image_\d{3}.(png|jpg|svg)`。
2.  **CSS 路径**: 必须是 `EPUB/css/cover.css`。
3.  **脚注**: 必须在 `div.part` 内部使用 `<aside epub:type="footnote">`。