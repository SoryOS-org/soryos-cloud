/**
 * SoryOS-Code Agent Loop Adapter
 * Wraps the centralized AgentRuntime from @soryos/agent.
 */

import { SessionData } from "@soryos/schema";
import { agentRuntime } from "@soryos/agent";
import type { AgentEvent } from "../types";

export interface AgentLoopOptions {
  session: SessionData;
  userMessage?: string;
  modelId?: string;
  agentId?: string;
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export async function runAgentLoop({
  session,
  userMessage,
  modelId,
  agentId,
  emit,
  signal,
}: AgentLoopOptions): Promise<void> {
  await agentRuntime.run({
    session,
    userMessage,
    modelId,
    agentId,
    emit,
    signal,
  });
}
