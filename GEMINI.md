# 代码项目

**项目概览：**

`dedao-dl` 是一个命令行界面（CLI）工具，用于下载“得到”应用中购买的内容。用户可以通过扫码或使用 cookie 登录后，下载课程、电子书、有声书及其他资料。核心功能包括从下载内容生成 PDF、Markdown 文件和 MP3 音频文件。

该项目由一个 Go CLI 应用程序 (`dedao-dl`) 和一个独立的浏览器扩展 (`dedao-extension`) 组成。`dedao-dl` 项目作为 `dedao-extension` 的**重要参考和实现模式来源**。

**主要技术：**

*   **Go:** CLI 工具 (`dedao-dl`) 的主要编程语言。
*   **TypeScript/Node.js:** 用于浏览器扩展 (`dedao-extension`) 和开发脚本。
*   **Vite:** 浏览器扩展的构建工具。
*   **Docker:** 提供容器化环境，无需本地依赖（如 `ffmpeg`）即可运行工具。
*   **FFmpeg:** 用于音频处理（合并/转换）。
*   **wkhtmltopdf:** 用于将 HTML 内容转换为 PDF。

**架构：**

项目分为两个主要组件：

1.  **`dedao-dl` (Go CLI - 参考项目):**
    *   **核心功能**: 处理认证、API 交互、内容下载和格式转换（PDF, Markdown, MP3）。
    *   **模块化**: 代码组织严谨，通过 `cmd` (命令结构), `services` (业务逻辑和 API 交互), `downloader` (下载器), `utils` (通用工具函数) 等包实现功能分离。
    *   **用户与配置管理**: 使用 `config.json` 文件持久化存储用户登录信息（包括多用户切换）和下载路径。`ActiveUID` 字段指示当前活动的登录用户。
    *   **持久化缓存**: 使用 **BadgerDB** 作为嵌入式键值存储，对下载的课程数据进行缓存，支持设置过期时间 (TTL) 和基于前缀的查询/删除，以优化性能并减少重复网络请求。
    *   **优雅退出**: 在程序退出时，能够安全地关闭 BadgerDB 数据库。
    *   **API 交互模式**: `services/service.go` 定义了 HTTP 请求的封装、Cookie 管理和统一的错误处理机制，这为浏览器扩展的 API 层提供了直接的参考模式。

2.  **`dedao-extension` (浏览器扩展 - 当前开发项目):**
    *   **目标**: 一个 Chrome 扩展，旨在直接从得到 Web 端下载电子书为 EPUB 格式。
    *   **技术栈**: 使用 TypeScript 和 Vite 构建。
    *   **功能模块**: 包含后台脚本 (`src/services` - 实现 API 交互、加密、EPUB 生成等核心逻辑)，内容脚本 (`src/content` - 处理页面交互，如提取书籍 ID)，和弹窗 UI (`src/popup` - 提供用户界面和下载控制)。
    *   **参考 `dedao-dl` 模式**: 扩展的 `EbookAPI` 和 `HttpClient` 等模块在设计时，应密切参考 `dedao-dl` 中 `services.Service` 的 API 交互模式和错误处理方式。用户会话管理（包括多用户支持和 Cookie 的使用）也应借鉴 `dedao-dl` 的设计思想。

**构建与运行：**


**`dedao-extension` (当前开发项目):**

*   **安装依赖：**
    ```bash
    cd dedao-extension
    npm install
    ```
*   **构建：**
    ```bash
    cd dedao-extension
    npm run build
    ```
*   **测试：**
    ```bash
    cd dedao-extension
    npm test
    ```
*   **手动测试脚本（Node.js 环境模拟浏览器下载流程）：**
    ```bash
    # 需要设置 DEDAO_COOKIE 环境变量，其中包含有效的得到网站 Cookie 字符串
    export DEDAO_COOKIE='YOUR_FRESH_COOKIE_STRING'
    cd dedao-extension
    # 使用 ts-node 运行脚本，并指定 TypeScript 编译选项为 commonjs 模块
    npx ts-node --compiler-options '{"module":"commonjs"}' scripts/manual-test.ts <书籍ID> <EnID>
    ```

**开发约定：**

*   **Go:** 遵循标准 Go 项目布局，注重包的划分和职责分离。
*   **TypeScript:** 遵循严格的类型检查 (`tsconfig.json`)，注重代码质量和可维护性。
*   **测试：**
    *   Go: 使用标准的 `go test` 框架。
    *   TypeScript: 使用 `jest` 进行单元测试。
*   **代码风格：** 遵守各自语言的最佳实践，Go 项目可能强制执行 `gofmt`，TypeScript/JS 项目通常使用 Prettier/ESLint 进行代码格式化和 Lint 检查。
*   **参考 Go CLI 模式**: 在 `dedao-extension` 的开发过程中，应优先参考 `dedao-dl` 中已有的 Go 实现模式，尤其是在 API 交互、数据结构设计和错误处理方面。例如，`dedao-dl` 中 `services` 包下定义的各种 `Response` 结构体和数据模型，以及其对 `h` (header) 和 `c` (content) 的响应封装，都应作为 `dedao-extension` API 类型定义的蓝本。

## Active Technologies
- TypeScript 5.x (Browser Extension) + `jszip` (ZIP generation), `cheerio` (if HTML parsing/manipulation needed, currently using string templates/DOM API), `crypto-js` (for decryption, existing) (002-align-epub-format)
- N/A (File generation only) (002-align-epub-format)

## Recent Changes
- 002-align-epub-format: Added TypeScript 5.x (Browser Extension) + `jszip` (ZIP generation), `cheerio` (if HTML parsing/manipulation needed, currently using string templates/DOM API), `crypto-js` (for decryption, existing)
