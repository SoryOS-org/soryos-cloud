# `@soryos/agent` Agent Operating Guidelines

## Overview
This package houses the core autonomous **`AgentRuntime`** and agent matrix (`build`, `plan`, `explore`, `code-reviewer`).

## Responsibilities
- Drive multi-turn inference loops with LLMs.
- Parse tool calls and delegate to `@soryos/tool`.
- Enforce role permissions via `@soryos/permissions`.
- Stream real-time events (`agent.started`, `agent.completed`, `agent.failed`) over `@soryos/bus`.

## Key Files
- `src/index.ts`: Primary export point for `AgentRuntime`, `agentRuntime`, and agent matrix configuration.

## Agent Guidelines
- Never bypass `@soryos/permissions`.
- If an agent role is `plan` or `explore`, writes and shell commands MUST be blocked.
- Always handle LLM API errors gracefully and report exact failure causes.
