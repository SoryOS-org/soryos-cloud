import { Type, type FunctionDeclaration } from "@google/genai";
import { SandboxProvider } from "../sandbox/provider";
import { SessionData } from "../agent-engine";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the real contents of a file in the workspace, with line numbers.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative path to the file inside the project workspace (e.g. 'src/App.tsx')",
        },
        offset: {
          type: "integer",
          description: "Optional line number to start reading from (1-indexed)",
        },
        limit: {
          type: "integer",
          description: "Optional maximum number of lines to read (default 2000)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "write_file",
    description: "Write full content to a file in the workspace. Automatically creates parent directories.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative path to the file (e.g. 'src/components/Header.tsx')",
        },
        content: {
          type: "string",
          description: "Full content to write to the file",
        },
      },
      required: ["filePath", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace a specific exact text block in a file with new content.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative path to the file",
        },
        targetContent: {
          type: "string",
          description: "The exact substring in the file to be replaced",
        },
        replacementContent: {
          type: "string",
          description: "The replacement content to put in place of targetContent",
        },
      },
      required: ["filePath", "targetContent", "replacementContent"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories in the project workspace.",
    parameters: {
      type: "object",
      properties: {
        directoryPath: {
          type: "string",
          description: "Optional directory path to inspect. Defaults to workspace root.",
        },
      },
      required: [],
    },
  },
  {
    name: "shell_command",
    description: "Execute a real shell command in the project workspace (e.g., npm install, npm test, npm run build, ls -la). Returns real exit code, stdout and stderr.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command line to execute (e.g. 'npm install lucide-react')",
        },
        timeoutMs: {
          type: "integer",
          description: "Optional execution timeout in milliseconds (default 60000ms)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "grep_search",
    description: "Search for a text pattern or symbol across files in the project workspace.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text or keyword to search for",
        },
        path: {
          type: "string",
          description: "Optional directory or file path to restrict the search",
        },
      },
      required: ["query"],
    },
  },
];

/**
 * Returns Gemini functionDeclarations format for @google/genai
 */
export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: "read_file",
      description: "Read the real contents of a file in the workspace, with line numbers.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING, description: "Relative path to the file (e.g. 'src/App.tsx')" },
          offset: { type: Type.INTEGER, description: "Optional starting line number (1-indexed)" },
          limit: { type: Type.INTEGER, description: "Optional max lines to read" },
        },
        required: ["filePath"],
      },
    },
    {
      name: "write_file",
      description: "Write content to a file in the workspace. Automatically creates parent directories.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING, description: "Relative path to the file (e.g. 'src/App.tsx')" },
          content: { type: Type.STRING, description: "Full content to write into the file" },
        },
        required: ["filePath", "content"],
      },
    },
    {
      name: "edit_file",
      description: "Replace a specific exact text block in a file with new content.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING, description: "Relative path to the file" },
          targetContent: { type: Type.STRING, description: "Exact text snippet to replace" },
          replacementContent: { type: Type.STRING, description: "New replacement text" },
        },
        required: ["filePath", "targetContent", "replacementContent"],
      },
    },
    {
      name: "list_files",
      description: "List files and directories in the project workspace.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          directoryPath: { type: Type.STRING, description: "Optional directory path to inspect" },
        },
        required: [],
      },
    },
    {
      name: "shell_command",
      description: "Execute a real shell command in the project workspace (e.g., npm install, npm test, npm run build). Returns real exit code, stdout, stderr.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          command: { type: Type.STRING, description: "The shell command to execute" },
          timeoutMs: { type: Type.INTEGER, description: "Execution timeout in ms (default 60000)" },
        },
        required: ["command"],
      },
    },
    {
      name: "grep_search",
      description: "Search for a keyword across project files.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "String to search for" },
          path: { type: Type.STRING, description: "Optional directory to limit search" },
        },
        required: ["query"],
      },
    },
  ];
}

/**
 * Returns OpenAI-compatible tools schema format
 */
export function getOpenAIToolsSchema() {
  return AGENT_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export interface ToolExecutionResult {
  output: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Executes a tool call on the physical SandboxProvider
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  provider: SandboxProvider,
  session: SessionData,
): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case "read_file": {
        const filePath = String(args.filePath || "");
        if (!filePath) {
          return { output: "Error: filePath parameter is required", isError: true };
        }
        const content = await provider.readFile(filePath);
        const lines = content.split("\n");
        const offset = Math.max(1, Number(args.offset || 1));
        const limit = Math.max(1, Number(args.limit || 2000));
        const slice = lines.slice(offset - 1, offset - 1 + limit);

        const numbered = slice
          .map((line, idx) => `${String(offset + idx).padStart(4, " ")} | ${line}`)
          .join("\n");

        return {
          output: `=== ${filePath} (${lines.length} lines total, showing ${slice.length} lines) ===\n${numbered}`,
          isError: false,
          metadata: { filePath, totalLines: lines.length },
        };
      }

      case "write_file": {
        const filePath = String(args.filePath || args.path || "");
        const content = String(args.content ?? "");
        if (!filePath) {
          return { output: "Error: filePath parameter is required", isError: true };
        }
        await provider.writeFile(filePath, content);
        session.files[filePath] = content;
        const lineCount = content.split("\n").length;
        return {
          output: `Successfully wrote ${lineCount} lines to ${filePath}`,
          isError: false,
          metadata: { filePath, lineCount },
        };
      }

      case "edit_file": {
        const filePath = String(args.filePath || args.path || "");
        const targetContent = String(args.targetContent ?? "");
        const replacementContent = String(args.replacementContent ?? "");
        if (!filePath || targetContent === "") {
          return {
            output: "Error: filePath and targetContent parameters are required for edit_file",
            isError: true,
          };
        }
        await provider.editFile(filePath, targetContent, replacementContent);
        const updated = await provider.readFile(filePath);
        session.files[filePath] = updated;
        return {
          output: `Successfully edited ${filePath} (replaced ${targetContent.length} chars)`,
          isError: false,
          metadata: { filePath },
        };
      }

      case "list_files": {
        const dir = typeof args.directoryPath === "string" ? args.directoryPath : "";
        const entries = await provider.listFiles(dir);
        if (entries.length === 0) {
          return { output: "(Workspace directory is empty)", isError: false };
        }
        const formatted = entries
          .map((e) => `${e.isDirectory ? "[DIR] " : "      "} ${e.path} (${e.sizeBytes} B)`)
          .join("\n");
        return {
          output: `Found ${entries.length} items in workspace:\n${formatted}`,
          isError: false,
          metadata: { count: entries.length },
        };
      }

      case "shell_command":
      case "run_command": {
        const command = String(args.command || args.CommandLine || "");
        if (!command) {
          return { output: "Error: command parameter is required", isError: true };
        }
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 60_000;
        const res = await provider.executeCommand(command, { timeoutMs });

        const parts: string[] = [];
        if (res.stdout) parts.push(`STDOUT:\n${res.stdout}`);
        if (res.stderr) parts.push(`STDERR:\n${res.stderr}`);
        parts.push(`Exit Code: ${res.exitCode} (${res.durationMs}ms)`);

        return {
          output: parts.join("\n\n"),
          isError: res.exitCode !== 0,
          metadata: {
            command,
            exitCode: res.exitCode,
            durationMs: res.durationMs,
          },
        };
      }

      case "grep_search": {
        const query = String(args.query || "");
        if (!query) {
          return { output: "Error: query parameter is required", isError: true };
        }
        const searchPath = typeof args.path === "string" ? args.path : "";
        const entries = await provider.listFiles(searchPath);
        const matches: string[] = [];

        for (const entry of entries) {
          if (entry.isDirectory) continue;
          try {
            const content = await provider.readFile(entry.path);
            const lines = content.split("\n");
            lines.forEach((l, idx) => {
              if (l.includes(query)) {
                matches.push(`${entry.path}:${idx + 1}: ${l.trim()}`);
              }
            });
          } catch {
            // ignore binary or unreadable files
          }
        }

        if (matches.length === 0) {
          return { output: `No occurrences of "${query}" found.`, isError: false };
        }

        return {
          output: `Found ${matches.length} matches for "${query}":\n${matches.slice(0, 50).join("\n")}`,
          isError: false,
          metadata: { count: matches.length },
        };
      }

      default:
        return {
          output: `Unknown tool: "${name}". Available tools: ${AGENT_TOOLS.map((t) => t.name).join(", ")}`,
          isError: true,
        };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      output: `Tool execution failed: ${msg}`,
      isError: true,
    };
  }
}
