<!--
SYNC IMPACT REPORT
Version: 1.0.0 (Initial Ratification - Chinese Translation)
Modified Principles: Translated all core principles to Chinese.
Added Sections: Translated System Constraints, Development Workflow.
Templates Status:
- .specify/templates/plan-template.md: ✅ Compatible
- .specify/templates/spec-template.md: ✅ Compatible
- .specify/templates/tasks-template.md: ✅ Compatible
-->

# 得到助手 (浏览器扩展) 章程

## 核心原则

### I. 模块化架构
系统必须为每种内容类型（电子书、课程、听书等）设计独特且解耦的模块。共享逻辑（认证、网络请求处理）必须与特定内容的业务逻辑严格分离。每个模块必须可独立测试，以确保未来的扩展不会在现有功能中引入回归问题。

### II. 道德合规与版权
本工具必须**仅**下载用户已合法购买的内容。严禁开发规避 DRM、助长盗版或绕过未付费内容访问控制的功能。本工具仅作为用户代理自动化助手运行，而非破解工具。

### III. 最小权限原则 (安全性)
浏览器扩展权限申请必须限制在功能所需的绝对最低限度。除非严格必要并有明确理由，否则应避免申请广泛的主机权限（如 `<all_urls>`）。敏感用户数据（Cookie、认证令牌）必须在内存中安全处理，绝不泄露给外部服务器。

### IV. 技术栈与参考
实现必须使用 JavaScript 或 TypeScript，目标为现代浏览器扩展环境 (Manifest V3)。现有的 `dedao-dl` (Go) 项目仅作为业务逻辑和 API 交互的参考。禁止直接将 Go 代码结构翻译为 JS；必须使用地道的 JavaScript/TypeScript 模式。

### V. 产品范围策略
初始版本 (v1.0) 必须专注于 **电子书** 下载功能。其他内容类型（课程、听书等）的支持不在初始发布范围内，但架构必须支持在无需重大重构的情况下添加这些内容。

## 系统约束

### 目标平台
扩展必须支持基于 Chromium 的现代浏览器（Chrome, Edge）和 Firefox。

### 输出格式
下载的内容必须保存为符合用户预期的标准开放格式（例如：电子书为 EPUB 或 PDF，音频为 MP3/M4A）。

## 开发工作流

### 文档语言规范
所有设计文档（包括 Specification, Plan, Research, Tasks 等）以及 `specs/` 目录下的所有产出物，**必须** 使用 **中文** 编写。代码中的变量名、函数名等标识符保持英文，但代码注释推荐使用中文。

### 参考驱动实现
1.  **分析**：审查 Go 参考实现 (`dedao-dl`) 以了解 API 端点和数据结构。
2.  **规范**：定义等效的 JavaScript 接口和逻辑流。
3.  **实现**：编写 JS/TS 代码，确保用法地道（例如：Promises/Async-Await）。
4.  **验证**：针对实时的得到 Web 界面（如适用）或模拟响应进行测试。

## 治理

### 修订流程
对本章程的修订需要提交 Pull Request 并附带明确理由。对道德合规性（原则 II）的更改通常会被拒绝，除非它们加强了反对盗版的立场。

### 版本控制策略
本项目遵循语义化版本控制 (Major.Minor.Patch)。
- **Major (主版本)**：核心原则或架构的变更。
- **Minor (次版本)**：增加新的内容类型支持（例如：添加课程）。
- **Patch (修订版本)**：Bug 修复或内部重构。

**版本**: 1.0.0 | **批准日期**: 2025-12-08 | **最后修订**: 2025-12-08
