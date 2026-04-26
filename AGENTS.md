# Repository Guidelines
- 尽量使用中文描述

## Project Structure & Module Organization
- `dedao-dl/`: Go CLI that mirrors the upstream downloader. Key packages sit under `cmd/`, `services/`, and `downloader/`, while shared helpers live in `utils/`. Static configs and docs are in `config/` and `docs/`.
- `dedao-extension/`: Vite + TypeScript Chrome extension. Source lives in `src/` (split into `content/`, `popup/`, `services/`, `types/`, `utils/`), with build artifacts under `dist/`, runtime helpers in `public/`, and tests in `tests/`.
- Root assets (`ref_*.xhtml`, `gen_*.xhtml`, `specs/`, `compare/`) support EPUB artifacts and specification work; treat them as reference outputs, not build inputs.

## Build, Test, and Development Commands
- `make build` / `bash build.sh`: compiles `dedao-dl` with `CGO_ENABLED=0`, embeds version metadata, and emits a local `dedao-dl` binary.
- `make test`: runs `go test -v ./test` (intended for Go test suites);
- `make run`: rebuilds the CLI and executes it locally for quick manual checks.
- `docker build ...` + `docker run ...`: used during containerized downloads; consult `dedao-dl/README.md` for command templates that mount `config.json` and output directories.
- Within `dedao-extension/`, run `npm install` once, then `npm run build -- --watch` for dev iterations or `npm run build` to produce the `dist/` artifacts; `npm test` exercises the Jest suites.

## Coding Style & Naming Conventions
- Go files follow the standard `gofmt` formatting with tabs for indentation; keep package-level names descriptive (`services`, `downloader`, `cmd`).
- TypeScript/JSX files rely on TypeScript 5+ settings from `tsconfig*.json`; prefer PascalCase for React/extension components and camelCase for functions.
- Manifest and config files under `dedao-extension/public/` and `dedao-dl/config.json` should keep JSON keys lowercase with hyphenation as shown when interacting with the tools.
- Avoid inline comments when editing generated EPUB content (`gen_*.xhtml`); treat them as outputs rather than source.

## Testing Guidelines
- `go test ./...` is the broader command you should run before merging Go-side changes; helper tests live under `dedao-dl/utils` and `dedao-dl/services`.
- `npm test` (Jest) runs the extension’s unit and snapshot tests; keep fixtures in `tests/` and name them to describe the behavior (`*.test.ts`).

## Branch & Worktree Workflow

新功能开发**必须**走 worktree 流程，不在主 checkout 上直接 checkout 新分支：

1. 在仓库根 `~/project/github/dedao-kit/` 之外建立 worktree：
   ```bash
   git worktree add ../dedao-kit-<feature-slug> -b <feature-branch>
   ```
2. 在新 worktree 内开发、`npm test`、`npm run compare` 验证通过。
3. 验证通过后才合并到 `main`：
   ```bash
   cd ~/project/github/dedao-kit
   git checkout main && git pull
   git merge --no-ff <feature-branch>
   git push origin main
   ```
4. 删除 worktree：`git worktree remove ../dedao-kit-<feature-slug>`

**禁止**：在主 checkout 上直接 `git checkout -b` 开发新功能；直接 push 未验证的代码到 `main`。

## Commit & Pull Request Guidelines
- Follow a conventional prefix (e.g., `feat:`, `fix:`, `docs:`, `AI:`) and keep the subject concise; mention related issues (e.g., `fix: match EPUB image diff (#123)`).
- Pull requests should describe the change, note the commands you ran (especially tests), and link to relevant issues or specs; attach screenshots or sample EPUB outputs when UI/formatting adjustments occur.
- Avoid committing secrets (login cookies, API keys); keep `config.json` contents minimal and indicate placeholders in docs.

## Security & Configuration Tips
- `dedao-dl/config.json` stores login cookies; never check real cookies into git—use example values or copy templates.
- For PDF generation, keep `wkhtmltopdf` and `ffmpeg` installed locally or within the Docker image; missing binaries will cause download failures.
