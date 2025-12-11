# Implementation Plan: Align EPUB format with Go project

**Branch**: `002-align-epub-format` | **Date**: 2025-12-10 | **Spec**: `specs/002-align-epub-format/spec.md`
**Input**: Feature specification from `/specs/002-align-epub-format/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Align the browser extension’s EPUB export output with the Go CLI reference by mirroring the CSS locations, DOM containers, and resource naming conventions across the entire book, so that the generated “第一章” and later chapters are visually indistinguishable from the provided reference EPUB.

## Technical Context

**Language/Version**: TypeScript 5.9 + Node.js 20 (Vite build pipeline)  
**Primary Dependencies**: Vite 7.2.7, TypeScript, jszip (EPUB packaging), xmldom (DOM manipulation), Chrome Extension Manifest V3 runtime  
**Storage**: Local filesystem (extension-triggered EPUB zip in user downloads folder)  
**Testing**: Jest + ts-jest (runs inside `dedao-extension` with DOM mocks)  
**Target Platform**: Chrome/Chromium-based browsers (Manifest V3 extension + Vite dev server for builds)  
**Project Type**: Web extension with content/popup/background scripts bundled via Vite  
**Performance Goals**: NEEDS CLARIFICATION  
**Constraints**: NEEDS CLARIFICATION  
**Scale/Scope**: NEEDS CLARIFICATION

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution placeholder file (`.specify/memory/constitution.md`) currently contains template stubs (no active gates). No violations detected; revisit if a concrete policy is provided.

## Project Structure

### Documentation (this feature)

```text
specs/002-align-epub-format/
├── spec.md              # Feature requirements (this file)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 research/decisions
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart
├── contracts/           # Phase 1 API/command contracts
└── tasks.md             # Phase 2 output (not created here)
```

### Source Code (extension workspace)

```text
dedao-extension/
├── src/
│   ├── content/          # content scripts extracting EPUB fragments
   │   ├── services/   # ebook assembly helpers (alignment, packaging)
   │   ├── popup/       # user-triggered controls (export, settings)
   │   ├── utils/       # shared helpers (DOM diffing, naming)
   │   └── types/       # TypeScript definitions for EPUB models
├── public/               # static assets referenced by builds (manifest, icons)
├── scripts/              # helper scripts for debugging/export or manual runs
├── tests/                # Jest suites validating HTML output and helpers
├── dist/                 # Vite-built extension bundles (output directory)
└── package.json          # defines dependencies (Vite, jszip, xmldom, etc.)
```

**Structure Decision**: Continue working within the existing `dedao-extension` Vite-based Chrome extension project, modifying `src/services` and packaging helpers to mirror the Go EPUB reference structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
