# EPUB 生成差异分析报告

## 概览

对比两个 EPUB 文件：
- **Go 版本**: `131902_庄子_庄子 著；孙雍长 译注.epub` (924KB) - 参考实现
- **TS 版本**: `dedao_131902.epub` (3.1MB) - 当前实现

## 发现的关键差异

### 1. **书籍元数据信息缺失** ❌ 高优先级

**问题描述**:
- TS 版本中，`package.opf` 的元数据为空
  - `<dc:title></dc:title>` - 空标题
  - `<dc:creator></dc:creator>` - 空作者
  - 缺少 `<dc:description>` 标签

- Go 版本包含完整的元数据
  ```xml
  <dc:title>131902_庄子_庄子 著；孙雍长 译注</dc:title>
  <dc:creator id="creator">庄子 著；孙雍长 译注</dc:creator>
  <dc:description>《庄子》又名《南华真经》...</dc:description>
  ```

**根本原因**:
TS 版本缺少关键的 API 调用。Go 版本调用两个 endpoint：
1. `/pc/ebook2/v1/pc/detail?id={enid}` - 返回 **title, author, intro, cover** 等元数据
2. `/ebk_web/v1/get_book_info?token={token}` - 返回 **chapters/pages** 信息

TS 版本只调用了第二个 endpoint，而该 endpoint 不返回 title/author/intro 字段（已验证：缓存中显示这些字段为 null）。

**解决方案**:
1. 在 `src/services/api/ebook.ts` 中添加新方法 `getEbookDetail(enid: string)`，调用 `/pc/ebook2/v1/pc/detail` endpoint
2. 在 `src/services/download/manager.ts` 的 `startDownload()` 中，先调用 `getEbookDetail(enid)` 获取元数据，再调用 `getBookInfo(token)` 获取章节信息
3. 合并两个响应到 EpubPackage metadata

---

### 2. **Cover 文件格式差异** ❌ 高优先级

**Go 版本** (`go_epub/EPUB/xhtml/cover.xhtml`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>131902_庄子_庄子 著；孙雍长 译注</title>
    <link rel="stylesheet" type="text/css" href="../css/cover.css"></link>
  </head>
  <body>
<img src="../images/cover.jpg" alt="Cover Image" />
  </body>
</html>
```

**TS 版本** (`ts_epub/EPUB/cover.xhtml`):
```xml
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title></title>
    <link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body>
    <h1></h1>
    <div class="chapter-content">
<div class="page-content"><p style=""><div class="image-wrapper" style=""><img src="../images/image_000.jpeg" alt="" width="60000.000000" height="85174.000000" /></div></p>
</div>
    </div>
</body>
</html>
```

**差异分析**:
| 项目 | Go 版本 | TS 版本 |
|-----|-------|--------|
| title 内容 | 有书名 | 空 |
| CSS 文件 | `css/cover.css` | `style.css` |
| 布局 | 简洁，仅含 img | 复杂，包含 chapter-content div |
| 图片尺寸属性 | 无 | 有 width/height（数值不合理） |
| img alt 文本 | "Cover Image" | 空 |

**根本原因**:
在 `src/services/download/manager.ts:107-116` 中，cover.xhtml 模板使用了通用的章节 HTML 结构，而不是简洁的 cover 专用模板。

---

### 3. **CSS 文件结构差异** ⚠️ 中优先级

**Go 版本**:
- `EPUB/css/cover.css` - 专用于 cover 的简洁 CSS
- 内容很简单：
  ```css
  body {
    background-color: #FFFFFF;
    margin-bottom: 0px;
    ...
  }
  ```

**TS 版本**:
- `EPUB/style.css` - 统一的全局 CSS（包含字体链接、段落缩进等）
- 使用外部字体 URL（网络依赖）

**差异分析**:
| 特性 | Go | TS |
|------|----|----|
| Cover CSS 专用 | ✓ | ✗ |
| 段落缩进 (text-indent) | ✗ | ✓ (2em) |
| 文字对齐 | ✗ | ✓ (justify) |
| 外部字体引用 | ✗ | ✓ (4 个 @font-face) |
| 文件数量 | 2 个 CSS | 1 个 CSS |

**影响**:
- TS 版本依赖网络来加载字体，可能导致离线阅读时字体丢失
- TS 段落缩进可能不适合所有内容

---

### 4. **第一章内容格式差异** ❌ 高优先级

**Go 版本** - 格式完整且结构清晰:
```html
<div id="Chapter_1_1_0001.xhtml">
</div>
<div class="header1">
  <h2><span id="sigil_toc_id_2" style="..."><b>逍</b><b>遥</b><b>游</b></span></h2>
</div>
<div class="part">
  <aside epub:type="footnote" id="footnote-3-4">
    <ol class="duokan-footnote-content">
      <li class="duokan-footnote-item">冥：冥暗苍茫...</li>
    </ol>
  </aside>
  <!-- Multiple footnotes above content -->

  <p><span style="font-size:16px;color:rgb(0, 0, 0);font-family:'FZFangSong-Z02';">
    北冥有鱼<sup><a class="duokan-footnote" ...>[1]</a></sup>
    <!-- More content with inline footnote references -->
  </p>
</div>
```

**TS 版本** - 结构过于简化:
```html
<body>
    <h1></h1>
    <div class="chapter-content">
<div class="page-content"><p style=""><div class="image-wrapper" style=""><img ... /></div></p>
</div>
    </div>
</body>
```

**关键缺失**:
1. ❌ 标题内容缺失（h1 为空）
2. ❌ 脚注结构不存在
3. ❌ 原始格式化样式丢失（字体、大小、颜色）
4. ❌ `<span>` 包装和内联样式缺失
5. ❌ 章节 div 嵌套过深

**根本原因**:
SVG 转换器可能没有正确处理 SVG → HTML 转换，或者转换后的 HTML 被过度简化。

---

### 5. **图片处理差异** ⚠️ 中优先级

**文件名差异**:
- Go: `image_000.png`, `image_001.svg` 等 - 按顺序编号，混合类型
- TS: `image_000.jpeg`, `image_001.png`, `image_002.svg` - 统一的 3 位数格式，但起始类型不同

**封面图片差异**:
- Go: `cover.jpg` 独立文件，在 `images/` 目录
- TS: `image_000.jpeg` 作为第一个图片被编号

**问题**:
- TS 版本的封面被归为普通图片编号序列，违反了 EPUB 最佳实践
- 应该给封面一个特殊的 ID（如 `cover-image`），但仍然用序列编号可接受

---

### 6. **package.opf 元数据标签差异** ⚠️ 中优先级

**Go 版本**:
```xml
<meta name="cover" content="cover.jpg"></meta>
<meta property="dcterms:modified">2025-12-09T09:48:51Z</meta>
```

**TS 版本**:
```xml
<meta property="dcterms:modified">2025-12-10T02:51:35Z</meta>
<!-- 缺少 cover 元数据 -->
```

**影响**:
电子书阅读器可能无法正确识别封面图片。

---

### 7. **XML 编码声明差异** ⚠️ 低优先级

**Go 版本**: `encoding="UTF-8"`
**TS 版本**: `encoding="utf-8"`

两者都有效，但 UTF-8 更规范（小写）。

---

### 8. **文件大小差异**

- Go: 924 KB
- TS: 3.1 MB（是 Go 版本的 3.3 倍）

**可能原因**:
1. TS 版本包含外部字体 URL 在 CSS 中（不实际下载，但可能被记录）
2. 图片数量相同，但编码可能不同
3. HTML 结构更复杂

---

## 优先级修复清单

### 🔴 高优先级 (必须修复)

1. **✅ Fix metadata population**
   - 确保 title, author, description 被填充到 package.opf
   - 位置: `src/services/download/manager.ts` 的 metadata 初始化

2. **✅ Fix cover.xhtml template**
   - 使用简洁的 cover 专用 HTML 模板
   - 包含正确的 title 和 alt 文本
   - 移除多余的 div 嵌套

3. **✅ Fix SVG-to-HTML conversion**
   - 确保转换后的 HTML 保留原始格式
   - 保留脚注结构和样式
   - 位置: `src/services/svg/complex-converter.ts`

4. **✅ Fix CSS references**
   - Go 版本使用 `css/cover.css` 用于 cover
   - TS 版本应该也创建专用 CSS，或至少使用正确的相对路径

### 🟡 中优先级 (应该修复)

5. **Fix cover metadata in package.opf**
   - 添加 `<meta name="cover" content="..." />`

6. **Optimize file size**
   - 移除不必要的样式
   - 考虑是否需要外部字体 URL

7. **Fix chapter file structure**
   - 确保 header div 和章节布局正确

---

## 测试建议

1. 用 Calibre 打开两个 EPUB 文件，对比显示效果
2. 检查元数据是否正确显示
3. 验证脚注是否正确渲染
4. 检查离线阅读（不加载外部字体）是否可行
5. 检查文件大小是否合理

---

## 下一步行动

1. 修复 `manager.ts` 中的 metadata 映射
2. 重写 cover.xhtml 模板
3. 检查 SVG 转换器的输出
4. 重新生成测试 EPUB 并对比
