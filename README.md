# Dedao Kit

把得到（dedao.cn）App 内的已购内容导出为本地可读文件的工具集合。

仓库目前包含一个**主开发对象**和一个**参考实现**：

| 子项目 | 说明 | 入口文档 |
|---|---|---|
| [`dedao-extension/`](./dedao-extension) | Chrome 浏览器扩展（TypeScript + Vite）。在得到 Web 端注入按钮，支持电子书 EPUB 下载、课程文章长图导出、课程文章 Markdown 导出/复制。**主开发对象。** | [dedao-extension/README.md](./dedao-extension/README.md) |
| [`dedao-dl/`](./dedao-dl) | Go CLI 参考实现，镜像自上游 [`yann0917/dedao-dl`](https://github.com/yann0917/dedao-dl)。EPUB 输出格式以此为正确性基准。 | [dedao-dl/README.md](./dedao-dl/README.md) |

## 能力一览

- **电子书 → EPUB 3.0**：自动 AES 解密、SVG → HTML 转换、章节切分、封面与脚注对齐。
- **课程文章 → 长图 PNG**：浏览器端自动滚动截图并拼接为单张图片。
- **课程文章 → Markdown**：从页面 DOM 提取正文，可直接下载或复制到剪贴板。

## 快速开始

绝大多数任务发生在 [`dedao-extension/`](./dedao-extension)：

```bash
cd dedao-extension
npm install
npm run build           # 构建产物在 dist/
npm test                # 全套 Jest
npm run test:epub       # EPUB 功能测试（缓存驱动，无需 cookie）
```

加载 `dist/` 目录到 Chrome `chrome://extensions/`（开启「开发者模式」→「加载已解压的扩展程序」）即可使用。

详细的安装、使用、架构、测试标准请见 [`dedao-extension/README.md`](./dedao-extension/README.md) 与 [`dedao-extension/CLAUDE.md`](./dedao-extension/CLAUDE.md)。

## 仓库布局

```
dedao-kit/
├── dedao-extension/         # Chrome 扩展（主开发对象）
├── dedao-dl/                # Go CLI（上游镜像 / 行为基准）
├── specs/                   # 设计规格（含 EPUB 对齐基线）
├── compare/                 # EPUB 结构对比工具
├── EPUB_ANALYSIS.md         # EPUB 对齐分析笔记
├── FIXES_APPLIED.md         # 历史修复记录
├── CLAUDE.md / AGENTS.md    # 协作 Agent / 代码风格 / Worktree 工作流
└── README.md                # 你正在看
```

## 安全提示

`.env`、`dedao-dl/config.json` 含登录 cookie，已在 `.gitignore`。**不要把真实 cookie 写入任何会被提交的文件。**

## License

仅用于个人已购内容的本地导出，请遵守得到平台的服务条款。
