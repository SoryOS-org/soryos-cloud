/**
 * Re-export official Tool implementation from @soryos/tool
 */

export * from "@soryos/tool";

import { toolRegistry, toolExecutor, RegisteredTool } from "@soryos/tool";
import { SandboxProvider } from "../sandbox/provider";
import { SessionData } from "../agent-engine";
import { FunctionDeclaration } from "@google/genai";

export const AGENT_TOOLS = toolRegistry.getAllTools();

export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return toolRegistry.getGeminiDeclarations();
}

export function getOpenAIToolsSchema() {
  return toolRegistry.getOpenAISchemas();
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  provider: SandboxProvider,
  session: SessionData
) {
  return toolExecutor.execute(name, args, provider as any, session as any, "build");
}
