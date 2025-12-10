# 得到电子书 API 契约

**版本**: 1.0 | **日期**: 2025-12-09

---

## API 概览

| 操作 | 端点 | 方法 | 说明 |
|-----|------|------|------|
| 获取读书令牌 | `/api/pc/ebook2/v1/pc/read/token` | POST | 获取访问权限令牌 |
| 获取书籍信息 | `/ebk_web/v1/get_book_info` | GET | 获取元数据和章节列表 |
| 获取章节页面 | `/ebk_web_go/v2/get_pages` | POST | 分页获取加密的 SVG 内容 |

---

## 1. 获取读书令牌

### 请求

```http
POST /api/pc/ebook2/v1/pc/read/token HTTP/1.1
Host: www.dedao.cn
Content-Type: application/json
Cookie: [浏览器 Cookies]

{
  "id": "12345678"  // 电子书加密 ID (enid)
}
```

### 响应 (成功 200)

```json
{
  "code": 0,
  "c": {
    "token": "eyJhbGciOiJIUzI1NiIs..."  // Base64 编码的令牌
  }
}
```

### 响应 (失败)

```json
{
  "code": 401,
  "msg": "Unauthorized"  // 未授权（未登录或已过期）
}
```

```json
{
  "code": 403,
  "msg": "Forbidden"  // 禁止（未购买或无权限）
}
```

### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| id | string | ✅ | 电子书加密 ID (从 URL 或 API 获取) |

### Token 有效期

- 有效期：24 小时
- 过期后需重新获取

---

## 2. 获取书籍信息

### 请求

```http
GET /ebk_web/v1/get_book_info?token=eyJhbGciOiJIUzI1NiIs... HTTP/1.1
Host: www.dedao.cn
Cookie: [浏览器 Cookies]
```

### 响应 (成功 200)

```json
{
  "code": 0,
  "c": {
    "bookInfo": {
      "title": "电子书标题",
      "author": "作者名",
      "intro": "书籍简介",
      "cover": "https://xxx/cover.jpg",

      "orders": [
        {
          "chapterId": "ch_001",
          "text": "第一章 标题",
          "level": 1
        },
        {
          "chapterId": "ch_001_001",
          "text": "第一节 子标题",
          "level": 2,
          "parentId": "ch_001"
        }
        // ... 更多章节
      ],

      "toc": [
        {
          "href": "ch_001.xhtml",
          "level": 1,
          "text": "第一章 标题",
          "playOrder": 1
        }
        // ... 更多目录项
      ]
    }
  }
}
```

### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| token | string | ✅ | 从"获取读书令牌"API 获取 |

### 字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| title | string | 书籍标题 |
| author | string | 作者名 |
| intro | string | 书籍简介/描述 |
| cover | string | 封面图片 URL |
| orders[] | array | 章节列表 |
| orders[].chapterId | string | 章节唯一 ID |
| orders[].text | string | 章节标题 |
| orders[].level | number | 层级 (1 = 主章节, 2 = 子章节) |
| orders[].parentId | string | 父章节 ID (可选) |
| toc[] | array | 目录树（用于 EPUB 导航） |
| toc[].href | string | 章节文件路径（生成 EPUB 时使用） |
| toc[].level | number | 目录层级 |
| toc[].text | string | 目录标题 |
| toc[].playOrder | number | 阅读顺序 |

---

## 3. 获取章节页面

### 请求

```http
POST /ebk_web_go/v2/get_pages HTTP/1.1
Host: www.dedao.cn
Content-Type: application/json
Cookie: [浏览器 Cookies]

{
  "chapter_id": "ch_001",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "index": 0,
  "count": 20,
  "offset": 0,
  "orientation": 0,
  "config": {
    "density": 1,
    "direction": 0,
    "font_name": "pingfang",
    "font_scale": 1,
    "font_size": 16,
    "height": 200000,
    "line_height": "2em",
    "margin_bottom": 20,
    "margin_left": 20,
    "margin_right": 20,
    "margin_top": 0,
    "paragraph_space": "1em",
    "platform": 1,
    "width": 60000
  }
}
```

### 响应 (成功 200)

```json
{
  "code": 0,
  "c": {
    "pages": [
      {
        "svg": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53M28ub3JnLzIwMDAvc3ZnIj4...",
        "is_first": true,
        "is_last": false,
        "begin_offset": 0,
        "end_offset": 5000,
        "view_heigh_to_chapter_top": 0
      },
      {
        "svg": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53M28ub3JnLzIwMDAvc3ZnIj4...",
        "is_first": false,
        "is_last": false,
        "begin_offset": 5000,
        "end_offset": 10000,
        "view_heigh_to_chapter_top": 5000
      }
      // ... 最多 20 页
    ],
    "is_end": false  // 是否是最后一页（true 时无需继续请求）
  }
}
```

### 响应 (最后一批页面)

```json
{
  "code": 0,
  "c": {
    "pages": [
      {
        "svg": "...",
        "is_last": true
      }
    ],
    "is_end": true  // 章节内容已全部获取
  }
}
```

### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| chapter_id | string | ✅ | 要获取的章节 ID |
| token | string | ✅ | 读书令牌 |
| index | number | ✅ | 页面索引 (从 0 开始) |
| count | number | ❌ | 每次请求的页数 (默认 20) |
| offset | number | ❌ | 偏移量 (默认 0) |
| orientation | number | ❌ | 方向 (0 = 竖排, 1 = 横排) |
| config | object | ❌ | 渲染配置 (字体、边距等) |

### SVG 字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| svg | string | Base64 编码的加密 SVG 内容（需 AES-256-CBC 解密） |
| is_first | boolean | 是否是章节的第一页 |
| is_last | boolean | 是否是章节的最后一页 |
| begin_offset | number | 该页在章节中的开始偏移 |
| end_offset | number | 该页在章节中的结束偏移 |
| view_heigh_to_chapter_top | number | 该页相对于章节顶部的高度 |

### 分页逻辑

```javascript
// 伪代码：获取所有页面
let allPages = [];
let pageIndex = 0;

do {
  const response = await getPages(chapterId, token, pageIndex);
  allPages.push(...response.pages);
  pageIndex++;
} while (!response.is_end);

// response.is_end = true 时停止请求
```

---

## 加密参数

所有章节 SVG 内容使用 **AES-256-CBC** 加密，参数如下：

```javascript
const KEY = '3e4r06tjkpjcevlbslr3d96gdb5ahbmo';  // 32 字节
const IV = '6fd89a1b3a7f48fb';                  // 16 字节
```

**解密步骤**：
1. 从响应中取 `svg` 字段 (Base64 编码的密文)
2. Base64 解码 → 二进制数据
3. 使用 AES-256-CBC 解密，密钥和 IV 如上
4. PKCS7 去填充 → 得到原文 SVG HTML

---

## 错误代码

| 代码 | 说明 | HTTP 状态 | 处理方式 |
|-----|------|----------|---------|
| 0 | 成功 | 200 | 继续处理 |
| 400 | 请求参数错误 | 400 | 检查参数，重新请求 |
| 401 | 未授权（未登录/会话过期） | 401 | 提示用户重新登录 |
| 403 | 禁止（无权限/未购买） | 403 | 提示用户无权限 |
| 429 | 请求过于频繁 | 429 | 等待后重试 |
| 500 | 服务器错误 | 500 | 稍后重试 |

---

## 请求头和认证

### 必需头

```
Host: www.dedao.cn
Content-Type: application/json
```

### Cookie

所有请求必须包含浏览器的 Cookie，尤其是：
- `_sid`: 会话 ID
- `token`: 用户令牌
- 其他认证相关的 Cookie

从浏览器中读取 (使用 Chrome Extension API):
```javascript
const cookies = await chrome.cookies.getAll({
  domain: '.dedao.cn'
});
const cookieStr = cookies
  .map(c => `${c.name}=${c.value}`)
  .join('; ');
// 在请求头中: Cookie: {cookieStr}
```

---

## 速率限制

- **建议请求间隔**: 1-3 秒
- **单个章节的分页请求**: 串行（一个一个请求，不并发）
- **触发反爬虫阈值**: 短时间内大量并发请求

**最佳实践**:
```javascript
// 顺序请求，避免并发
for (let pageIndex = 0; !is_end; pageIndex++) {
  const response = await api.getPages(chapterId, token, pageIndex);
  // 处理响应...
  await sleep(1000);  // 等待 1 秒
}
```

---

## 测试数据 / 模拟

### 模拟响应 (用于单元测试)

见 `tests/mocks/api-responses.ts`

---

## 版本历史

| 版本 | 日期 | 说明 |
|-----|------|------|
| 1.0 | 2025-12-09 | 初始版本，MVP 范围 |

---

**最后更新**: 2025-12-09
