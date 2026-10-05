# SoryOS-Code Master Agent Operating Instructions (`AGENTS.md`)

> **System Notice for AI Agents**: This is the authoritative operating guide for all AI Agents (`build`, `plan`, `explore`, `code-reviewer`) working on the SoryOS-Code codebase. You MUST read and follow these rules whenever interacting with this repository.

---

## 🏛️ 1. Core Architecture & Monorepo Conceptual Map

SoryOS-Code is structured around a strict hierarchy:

```
Project
 └── Workspace (ActiveWorkspace source of truth)
      └── Session (SessionData & conversation state)
           └── Environment
                ├── Local (process.cwd() / Machine Locale)
                └── Sandbox
                     ├── E2B
                     ├── Vercel
                     ├── Codespaces
                     └── Cloud Run
```

### End-to-End Execution Pipeline:
```
USER REQUEST
   │
   ▼
SESSION (@soryos/session)
   │
   ▼
AGENT RUNTIME (@soryos/agent)
   │
   ▼
AI PROVIDER (@soryos/provider - Gemini, OpenAI, Mistral, Zen)
   │
   ▼
TOOL CALL (@soryos/tool)
   │
   ▼
PERMISSIONS MANAGER (@soryos/permissions)
   │
   ▼
EXECUTION PROVIDER (@soryos/execution)
   │
   ▼
PHYSICAL DISK / SHELL EXECUTION (Real Action)
   │
   ▼
EVENT STREAM (@soryos/bus)
   │
   ▼
VERIFICATION & FINAL RESPONSE (UI / CLI)
```

---

## ⛔ 2. Inviolable Operational Rules

1. **NO DUPLICATE IMPLEMENTATIONS**:
   - Always search existing packages under `packages/` before writing new logic.
   - Never create parallel or duplicate runtimes, session managers, or tool executors in `apps/web/` or elsewhere.
2. **NO FAKE EXECUTION & NO FAKE SUCCESS**:
   - Never mock, simulate, or hardcode success messages.
   - Every file edit, command execution, or search MUST execute physically via `@soryos/tool` and `@soryos/execution`.
3. **NO UNVERIFIED RESULTS**:
   - Always verify tool outputs and file modifications on disk before declaring a step complete.
   - Run `npm run typecheck` and `npm run test:engine` after major changes.
4. **STRICT PACKAGE BOUNDARIES**:
   - Presentation logic lives in `apps/web/`.
   - Business runtime logic lives in `packages/*`.
   - Never put runtime business logic inside UI React components.

---

## 🛠️ 3. Package Responsibilities

| Package | Path | Primary Responsibility |
| :--- | :--- | :--- |
| **`@soryos/schema`** | `packages/schema` | Domain types, interfaces, contracts (`ActiveWorkspace`, `SessionData`, `ToolStep`) |
| **`@soryos/core`** | `packages/core` | Base error classes (`ExecutionError`, `PermissionDeniedError`) |
| **`@soryos/bus`** | `packages/bus` | Central EventBus streaming agent, tool, and process events |
| **`@soryos/permissions`**| `packages/permissions` | Granular role-based security (`build` = full access, `plan` = read-only) |
| **`@soryos/execution`** | `packages/execution` | Physical command and file execution provider layer (`LocalExecutionProvider`) |
| **`@soryos/tool`** | `packages/tool` | ToolRegistry & ToolExecutor (`read_file`, `write_file`, `edit_file`, `shell_command`) |
| **`@soryos/agent`** | `packages/agent` | Multi-turn AgentRuntime loop and agent matrix |
| **`@soryos/workspace`** | `packages/workspace` | Source of truth for `ActiveWorkspace` state |
| **`@soryos/session`** | `packages/session` | Persistent session store and history manager |
| **`@soryos/provider`** | `packages/provider` | Multi-model AI Provider Registry (Gemini, OpenAI, Mistral, Zen) |
| **`@soryos/filesystem`**| `packages/filesystem` | Filesystem operations adapter over active ExecutionProvider |
| **`@soryos/git`** | `packages/git` | Git tracking, branch management, and commit operations |
| **`@soryos/pty`** | `packages/pty` | Interactive PTY process stream manager |
| **`@soryos/dev-runner`** | `packages/dev-runner` | Development server orchestrator and port detector |
| **`@soryos/cli`** | `packages/cli` | Autonomous CLI engine (`soryos-code`) |

---

## 🧪 4. Essential Commands

### TypeScript & Engine Verification:
```bash
# Typecheck all workspaces with 0 errors
npm run typecheck

# Run full 10/10 engine verification suite
npm run test:engine

# Production build
npm run build

# Start dev server
npm run dev
```

### Autonomous CLI Usage:
```bash
# Run task using default Build Agent
npx tsx apps/web/bin/soryos-code.ts run "<prompt>"

# Run task using specific agent role
npx tsx apps/web/bin/soryos-code.ts run "<prompt>" --agent plan
```

---

## 🔍 5. Search & Discovery Protocol Before Modifying

Before making any edit:
1. `SEARCH` -> Run `grep_search` or `glob_files` to locate existing implementations.
2. `READ` -> Read the relevant file using `read_file`.
3. `UNDERSTAND` -> Check the package `AGENTS.md` in that specific folder for domain rules.
4. `REUSE` -> Delegate to official exported utilities in `@soryos/*`.
5. `EXTEND` -> Make surgical, pristine edits.
