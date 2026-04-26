# CLAUDE.md 

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

这是一个**多项目仓库**，围绕"将得到 App 内容导出为本地可读文件"这一目标组织：

- `dedao-extension/` — **主开发对象**。TypeScript + Vite 构建的 Chrome 扩展，提供电子书 EPUB 下载和课程文章长图导出。**详细架构、命令、测试标准见 `dedao-extension/CLAUDE.md`，进入该子目录工作时优先阅读它**。
- `dedao-dl/` — **Go CLI 参考实现**（上游 [yann0917/dedao-dl](https://github.com/yann0917/dedao-dl) 的镜像）。EPUB 输出格式以此为正确性基准；TS 版与之有差异时通常修 TS 版。
- `specs/002-align-epub-format/fixtures/reference.epub` — Go 版生成的参考 EPUB，功能测试用它作对比基线。
- `compare/`、`ref_*.xhtml`、`gen_*.xhtml`、`EPUB_ANALYSIS.md`、`FIXES_APPLIED.md` — EPUB 对齐工作产生的对比产物和分析笔记，**视为输出，不要当源码改**。

## 关键工作流

绝大多数任务发生在 `dedao-extension/`。常用命令（在该子目录运行）：

```bash
npm test                          # 全套 Jest
npm run test:epub                 # EPUB 功能测试（缓存驱动，无需网络/cookie）
npm run compare gen_latest.epub   # 与 Go 参考 EPUB 结构对比
npm run build                     # tsc + vite，产物到 dist/
npx jest <path-to-test-file> --no-coverage   # 单个测试

# 用真实 cookie 端到端生成 EPUB
set -a && source .env && set +a
npx ts-node --require esbuild-register scripts/manual-test.ts <bookId> <enid>
```

Go 侧（仅在需要核对参考行为时）：`cd dedao-dl && make build` / `make test`。

## 跨项目约束

- **正确性基准**：EPUB 结构以 Go 版输出为准。修改 SVG→HTML 转换、EPUB 打包、章节切分逻辑后，必须运行 `npm run compare`，确认 `<p>`/`<aside>` 数量、`aside-after-p`、蓝色 fn span、BT 锚链接四项指标与参考一致。已知固有差异（图片格式、空白换行、ZIP 字节）见 `dedao-extension/CLAUDE.md`，不要试图"修复"。
- **测试不能联网**：`tests/functional/` 用 `dedao-extension/.cache/` 中 44 个 MD5-keyed JSON 回放 API。新增 API 调用前先确认 `isDedaoApiUrl` 白名单与 `manual-test.ts` 的 `shouldCacheUrl` 同步，否则测试会真实发网络请求。
- **Content script 构建格式**：popup/background 为 ES module，content script 为 IIFE（`inlineDynamicImports: true`）。这是已踩过坑的决定，不要改回 ES module。

## 文档分工

- `dedao-extension/CLAUDE.md` — 子项目的架构、SVG 转换状态机、图片编号规则、测试三层验证、缓存 key 规则。**改 TS 代码前必读**。
- `AGENTS.md`（根） — 跨项目的代码风格、commit 规范（conventional prefix：`feat:`/`fix:`/`docs:`/`AI:` 等）。**含 Branch & Worktree Workflow，新功能必读**。
- `dedao-extension/README.md` — 终端用户安装/使用说明。
- `dedao-dl/README.md` — Go CLI 用法。

## 安全

`.env` 与 `dedao-dl/config.json` 含登录 cookie，已 `.gitignore`；不要把真实 cookie 写进任何会被提交的文件。

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.