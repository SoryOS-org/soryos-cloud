/**
 * Re-exports agent definitions from @soryos/agent
 */

import { AGENT_MATRIX, getAgentDefinition } from "@soryos/agent";
import { AgentDefinition } from "@soryos/schema";

export type OpenCodeAgent = AgentDefinition;
export const OPENCODE_AGENTS: OpenCodeAgent[] = AGENT_MATRIX;

export function getAgentById(agentId: string): OpenCodeAgent {
  return getAgentDefinition(agentId);
}

export function listOpenCodeAgents(): OpenCodeAgent[] {
  return OPENCODE_AGENTS;
}
