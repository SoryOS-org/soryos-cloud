/**
 * @soryos/jobs
 * Inngest function: run-agent
 * 
 * Executes the AI agent in the sandbox with streaming support.
 * This is the core job that handles agent execution and real-time updates.
 */

import { getInngest } from '../client';
import {
  updateSessionStatus,
  addMessage,
  updateMessage,
  getSessionData,
  getSessionMessages,
  sendAppReadyNotification,
  isTimeoutError,
  isSandboxTerminatedError,
  sanitizeError
} from '../middleware';
import { RunAgentJobData, JobResult, StreamingMessage } from '../types';
import { sandboxRegistry } from '@soryos/sandbox';
import { agentRuntime } from '@soryos/agent';
import { GlobalEventBus } from '@soryos/bus';

/**
 * Process a parsed stdout JSON object
 */
async function processStdoutLine(
  parsedData: Record<string, unknown>,
  sessionId: string,
  options: {
    eventTimestamp: number;
    lastAssistantMessageId: string | null;
    streamingContent: string;
    template?: string;
  }
): Promise<{ messageId: string | null; streamingContent: string }> {
  const { eventTimestamp, lastAssistantMessageId, streamingContent, template } = options;
  
  try {
    // Handle new format: {"type":"message","role":"user|assistant","content":"...","delta":true}
    if (parsedData.type === 'message') {
      if (parsedData.role === 'user') {
        // Extract user message content
        const userContent = typeof parsedData.content === 'string'
          ? parsedData.content
          : (parsedData.content as any)?.content?.[0]?.content || '';
        
        try {
          await updateSessionStatus(sessionId, 'CUSTOM', userContent);
        } catch (statusError) {
          console.warn('[Jobs] Non-fatal: Failed to update session status:', statusError);
        }
        
        return { messageId: null, streamingContent };
      } else if (parsedData.role === 'assistant') {
        try {
          await updateSessionStatus(sessionId, 'CUSTOM', 'Working on task');
        } catch (statusError) {
          console.warn('[Jobs] Non-fatal: Failed to update session status:', statusError);
        }

        // Handle streaming responses (delta: true means partial content)
        let content = '';
        if (typeof parsedData.content === 'string') {
          content = parsedData.content;
        } else if (Array.isArray(parsedData.content)) {
          // Concatenate all text blocks to capture interleaved text
          content = (parsedData.content as any[])
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
        }

        if (!content) return { messageId: lastAssistantMessageId, streamingContent };

        if (parsedData.delta === true) {
          // This is a streaming delta - accumulate content
          const newStreamingContent = streamingContent + content;

          // Update or create message with accumulated content
          try {
            if (lastAssistantMessageId) {
              await updateMessage(lastAssistantMessageId, newStreamingContent);
            } else {
              // Create new message with initial content
              const messageId = await addMessage(sessionId, content, 'assistant', undefined, eventTimestamp);
              return { messageId, streamingContent: newStreamingContent };
            }
          } catch (msgError) {
            console.warn('[Jobs] Non-fatal: Failed to update/create message:', msgError);
          }
          
          return { messageId: lastAssistantMessageId, streamingContent: newStreamingContent };
        } else {
          // This is a complete message (not streaming)
          const messageId = await addMessage(sessionId, content, 'assistant', undefined, eventTimestamp);
          return { messageId, streamingContent: content };
        }
      }
    }
    // Handle result type (final response)
    else if (parsedData.type === 'result') {
      console.log('[Jobs] RESULT TYPE DETECTED');
      console.log('[Jobs] Status:', parsedData.status || (parsedData as any).subtype);
      console.log('[Jobs] Has result field:', !!parsedData.result);

      // Reset streaming content after result
      return { messageId: lastAssistantMessageId, streamingContent: '' };
    }
    // Ignore init type messages
    else if (parsedData.type === 'init') {
      console.log('[Jobs] Agent initialized:', parsedData);
      return { messageId: lastAssistantMessageId, streamingContent };
    }
    // Handle old format for backward compatibility
    else if (parsedData.type === 'user') {
      try {
        await updateSessionStatus(sessionId, 'CUSTOM', (parsedData as any).message?.content?.[0]?.content);
      } catch (statusError) {
        console.warn('[Jobs] Non-fatal: Failed to update session status:', statusError);
      }
      return { messageId: lastAssistantMessageId, streamingContent };
    }
    else if (parsedData.type === 'assistant') {
      console.log('[Jobs] ASSISTANT TYPE DETECTED');
      try {
        await updateSessionStatus(sessionId, 'CUSTOM', 'Working on task');
      } catch (statusError) {
        console.warn('[Jobs] Non-fatal: Failed to update session status:', statusError);
      }

      // Process ALL content blocks, not just the first one
      const contentBlocks = (parsedData as any).message?.content || [];
      console.log('[Jobs] Content blocks count:', contentBlocks.length);

      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        console.log(`[Jobs] Processing block ${i}: type=${block.type}`);

        // Use eventTimestamp + small offset for each block to preserve order within same event
        const blockTimestamp = eventTimestamp + i;

        try {
          if (block.type === 'text' && block.text?.trim()) {
            // Create message for text content (including intermediate text between tool calls)
            console.log(`[Jobs] Creating text message: ${block.text.substring(0, 100)}...`);
            const textMessageId = await addMessage(sessionId, block.text, 'assistant', undefined, blockTimestamp);
            return { messageId: textMessageId, streamingContent: block.text };
          } else if (block.type === 'tool_use') {
            // Handle tool use
            const toolMessageId = await handleToolUse(
              { message: { content: [block] } },
              sessionId,
              blockTimestamp
            );
            if (toolMessageId) {
              return { messageId: toolMessageId, streamingContent };
            }
          }
        } catch (blockError) {
          console.warn(`[Jobs] Non-fatal: Failed to process block ${i}:`, blockError);
        }
      }
    }
    // Handle Cursor Agent tool calls
    else if (parsedData.type === 'tool_call') {
      if ((parsedData as any).subtype === 'started') {
        try {
          await updateSessionStatus(sessionId, 'CUSTOM', 'Using tools...');
        } catch (statusError) {
          console.warn('[Jobs] Non-fatal: Failed to update session status:', statusError);
        }
      } else if ((parsedData as any).subtype === 'completed') {
        try {
          const toolMessageId = await handleToolUse(parsedData as any, sessionId, eventTimestamp);
          if (toolMessageId) {
            return { messageId: toolMessageId, streamingContent };
          }
        } catch (toolError) {
          console.warn('[Jobs] Non-fatal: Failed to handle tool call:', toolError);
        }
      }
    }

  } catch (error) {
    console.error('[Jobs] Error processing parsed stdout:', error);
    console.log('[Jobs] Parsed data type:', parsedData?.type);
  }

  return { messageId: null, streamingContent };
}

/**
 * Handle tool use from agent output
 */
async function handleToolUse(
  data: Record<string, unknown>,
  sessionId: string,
  createdAt?: number
): Promise<string | null> {
  // Handle Cursor Agent tool format
  if ((data as any).tool_call) {
    const toolCall = (data as any).tool_call;
    const toolName = Object.keys(toolCall)[0];

    switch (toolName) {
      case 'updateTodosToolCall':
        const todos = (toolCall[toolName] as any).args.todos.map((todo: any, index: number) => ({
          content: todo.content,
          id: todo.id || `todo-${index + 1}`,
          priority: 'medium' as const,
          status: todo.status === 'TODO_STATUS_COMPLETED' ? 'completed' :
                  todo.status === 'TODO_STATUS_IN_PROGRESS' ? 'in_progress' : 'pending',
        }));

        return await addMessage(sessionId, '', 'assistant', { todos }, createdAt);

      case 'writeToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          edits: {
            filePath: (toolCall[toolName] as any).args.path,
            oldString: '',
            newString: (toolCall[toolName] as any).args.fileText,
          },
        }, createdAt);

      case 'editToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          edits: {
            filePath: (toolCall[toolName] as any).args.path,
            oldString: (toolCall[toolName] as any).args.oldText || '',
            newString: (toolCall[toolName] as any).args.newText || '',
          },
        }, createdAt);

      case 'readToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          read: {
            filePath: (toolCall[toolName] as any).args.path,
          },
        }, createdAt);

      case 'shellToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          bash: {
            command: (toolCall[toolName] as any).args.command,
            output: (toolCall[toolName] as any).result?.success?.stdout || 
                   (toolCall[toolName] as any).result?.rejected?.reason || '',
            exitCode: (toolCall[toolName] as any).result?.success?.exitCode ?? 0,
          },
        }, createdAt);

      case 'lsToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          bash: {
            command: `ls ${(toolCall[toolName] as any).args.path}`,
            output: JSON.stringify((toolCall[toolName] as any).result?.success?.directoryTreeRoot || {}),
            exitCode: 0,
          },
        }, createdAt);

      case 'grepToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          grep: {
            pattern: (toolCall[toolName] as any).args.pattern,
            filePath: (toolCall[toolName] as any).args.path,
            matches: ((toolCall[toolName] as any).result?.success?.output?.split('\n') || []).filter((line: string) => line.trim()),
            lineCount: (toolCall[toolName] as any).result?.success?.output?.split('\n').length || 0,
          },
        }, createdAt);

      case 'globToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          tool: {
            toolName: 'glob',
            command: `find . -name "${(toolCall[toolName] as any).args.globPattern}"`,
            output: (toolCall[toolName] as any).result?.success?.files?.join('\n') || 
                   (toolCall[toolName] as any).result?.error?.errorMessage || '',
            exitCode: (toolCall[toolName] as any).result?.success ? 0 : 1,
            status: (toolCall[toolName] as any).result?.success ? 'success' : 'error',
          },
        }, createdAt);

      case 'semSearchToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          codebaseSearch: {
            query: (toolCall[toolName] as any).args.query,
            results: (toolCall[toolName] as any).result?.success?.results || 
                    (toolCall[toolName] as any).result?.error?.errorMessage || 'Semantic search not available',
            targetDirectories: (toolCall[toolName] as any).args.targetDirectories || [],
          },
        }, createdAt);

      case 'deleteToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          tool: {
            toolName: 'delete',
            command: `rm ${(toolCall[toolName] as any).args.path}`,
            output: (toolCall[toolName] as any).result?.success ? 'File deleted successfully' : 
                    (toolCall[toolName] as any).result?.rejected?.reason || 'Failed to delete file',
            exitCode: (toolCall[toolName] as any).result?.success ? 0 : 1,
            status: (toolCall[toolName] as any).result?.success ? 'success' : 'error',
          },
        }, createdAt);

      case 'codebaseSearchToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          codebaseSearch: {
            query: (toolCall[toolName] as any).args.query || (toolCall[toolName] as any).args.searchQuery || '',
            results: (toolCall[toolName] as any).result?.success?.results || 
                    (toolCall[toolName] as any).result?.error?.errorMessage || '',
            targetDirectories: (toolCall[toolName] as any).args.targetDirectories || [],
          },
        }, createdAt);

      case 'searchReplaceToolCall':
        return await addMessage(sessionId, '', 'assistant', {
          searchReplace: {
            filePath: (toolCall[toolName] as any).args.filePath || (toolCall[toolName] as any).args.path || '',
            oldString: (toolCall[toolName] as any).args.oldString || (toolCall[toolName] as any).args.oldText || '',
            newString: (toolCall[toolName] as any).args.newString || (toolCall[toolName] as any).args.newText || '',
            replacements: (toolCall[toolName] as any).result?.success?.replacements || 1,
          },
        }, createdAt);

      default:
        return null;
    }
  }

  // Handle Claude format (fallback)
  const toolName = (data as any).message?.content?.[0]?.name;

  switch (toolName) {
    case 'TodoWrite':
      const todosWithRequiredFields = (data as any).message.content[0].input.todos.map(
        (todo: { content: string; status: string; activeForm?: string }, index: number) => ({
          content: todo.content,
          id: `todo-${index + 1}`,
          priority: 'medium' as const,
          status: todo.status,
        })
      );

      return await addMessage(sessionId, '', 'assistant', { todos: todosWithRequiredFields }, createdAt);

    case 'Write':
      return await addMessage(sessionId, '', 'assistant', {
        edits: {
          filePath: (data as any).message.content[0].input.file_path,
          oldString: '',
          newString: (data as any).message.content[0].input.content,
        },
      }, createdAt);

    case 'Edit':
      return await addMessage(sessionId, '', 'assistant', {
        edits: {
          filePath: (data as any).message.content[0].input.file_path,
          oldString: (data as any).message.content[0].input.old_string,
          newString: (data as any).message.content[0].input.new_string,
        },
      }, createdAt);

    case 'Read':
      return await addMessage(sessionId, '', 'assistant', {
        read: {
          filePath: (data as any).message.content[0].input.file_path,
        },
      }, createdAt);

    case 'Bash':
    case 'bash':
      return await addMessage(sessionId, '', 'assistant', {
        bash: {
          command: (data as any).message.content[0].input.command,
          output: (data as any).message.content[0].input.description || '',
          exitCode: 0,
        },
      }, createdAt);

    case 'WebSearch':
    case 'webSearch':
      return await addMessage(sessionId, '', 'assistant', {
        webSearch: {
          query: (data as any).message.content[0].input.query,
          results: (data as any).message.content[0].input.results || '',
        },
      }, createdAt);

    default:
      // Handle MCP tool calls
      const mcpToolName = (data as any).message?.content?.[0]?.name;
      const mcpInput = (data as any).message?.content?.[0]?.input;

      if (mcpToolName && !['TodoWrite', 'Write', 'Edit', 'Read', 'Bash', 'bash', 'WebSearch', 'webSearch'].includes(mcpToolName)) {
        console.log(`[Jobs] MCP Tool detected: ${mcpToolName}`);

        return await addMessage(sessionId, '', 'assistant', {
          mcpTool: {
            toolName: mcpToolName,
            input: mcpInput,
            output: null,
            status: 'running' as const,
          },
        }, createdAt);
      }

      return null;
  }
}

/**
 * Handle message tracking and cost extraction
 */
async function handleMessageTracking(
  stdout: string,
  sessionId: string,
  messageId?: string | null
): Promise<void> {
  console.log('[Jobs] MESSAGE TRACKING: Starting message tracking...');
  console.log('[Jobs] Stdout length:', stdout.length);
  console.log('[Jobs] Provided message ID:', messageId);

  try {
    const sessionData = await getSessionData(sessionId);
    if (!sessionData) {
      console.log('[Jobs] Session not found, skipping message tracking');
      return;
    }

    const userId = (sessionData as any).createdBy || 'unknown';
    console.log('[Jobs] User ID:', userId);

    // For now, we'll just track the message
    // Cost tracking can be added later
    if (messageId) {
      console.log('[Jobs] Message ID for tracking:', messageId);
      // Update message with tracking data if needed
    }

  } catch (error) {
    console.error('[Jobs] Message tracking error:', error);
  }
}

/**
 * Extract file info from message and add to prompt
 */
function buildFileInfo(message: string, sessionId: string): string {
  // For now, return empty string
  // This can be enhanced to extract file paths from messages
  return '';
}

/**
 * Run agent job function
 */
export const runAgent = getInngest().createFunction(
  {
    id: 'soryos/run.agent',
    retries: 0,
    concurrency: 25,
    onFailure: async ({ error, event }) => {
      const { id, sessionId } = event.data as RunAgentJobData;
      console.log('[Jobs] RUN AGENT FAILURE HANDLER:', error?.message);

      try {
        const errorMessage = error?.message || String(error);
        const sanitizedError = sanitizeError(errorMessage);

        // Check if this is a timeout error
        if (isTimeoutError(error)) {
          const timeoutMessage = `⏳ **Request Timed Out**\n\nThe AI took too long to respond. This can happen with complex tasks.\n\n**To continue:**\n- Send a new message to resume where we left off\n- Try breaking your request into smaller steps\n- Type "continue" to pick up from here\n\nYour progress has been saved.`;
          await addMessage(id || sessionId, timeoutMessage, 'assistant');
        } else if (isSandboxTerminatedError(error)) {
          const sandboxMessage = `🛑 **Session Interrupted**\n\nThe development environment was temporarily unavailable. This can happen due to server maintenance or high demand.\n\n**To continue:**\n- Send a new message and I'll pick up where we left off\n- Your code and progress have been saved\n- Type "continue" to resume\n\nIf this keeps happening, try starting a new session.`;
          await addMessage(id || sessionId, sandboxMessage, 'assistant');
        } else {
          await addMessage(id || sessionId, 
            `⚠️ **Agent Error**\n\nSomething went wrong. Please try again.\n\n\`\`\`\n${sanitizedError}\n\`\`\``, 
            'assistant');
        }

        // Reset session status
        await updateSessionStatus(id || sessionId, 'RUNNING');
      } catch (failureError) {
        console.error('[Jobs] Failed to handle failure:', failureError);
      }
    }
  },
  { event: 'soryos/run.agent' },
  async ({ event, step }) => {
    console.log('[Jobs] RUN AGENT FUNCTION STARTED');
    console.log('[Jobs] Event data:', event.data);

    const {
      sessionId,
      id,
      message,
      template,
      repository,
      token,
      model,
      provider
    } = event.data as RunAgentJobData;

    console.log('[Jobs] Extracted data:', {
      sessionId,
      id,
      message: message?.substring(0, 50) + '...',
      template,
      model: model || 'default'
    });

    const actualId = id || sessionId;

    try {
      const result = await step.run('generate code', async () => {
        // Get session data to check for environment variables
        const sessionData = await getSessionData(actualId);

        // Reset agentStopped flag when starting a new agent run
        if (sessionData) {
          await updateSessionStatus(actualId, 'CUSTOM', 'Working on task');
        }

        // Connect to existing sandbox
        console.log('[Jobs] Connecting to existing sandbox');
        const providerId = provider || 'e2b';
        const sandboxProvider = await sandboxRegistry.createProvider(providerId, sessionId);

        // Connect to the existing sandbox instead of creating a new one
        const sandboxId = (sessionData as any)?.sandboxId || sessionId;
        
        if (sandboxId) {
          await sandboxProvider.connect(sandboxId);
          console.log(`[Jobs] Connected to sandbox: ${sandboxId}`);
        } else {
          console.log('[Jobs] No sandbox ID found, creating new sandbox');
          await sandboxProvider.create({ sessionId });
        }

        // Track the last assistant message ID for cost tracking
        let lastAssistantMessageId: string | null = null;
        // Track streaming content for delta updates
        let streamingContent = '';
        // Accumulate all stdout for cost extraction
        let accumulatedStdout = '';
        // Buffer for incomplete JSON lines
        let jsonBuffer = '';

        // Create stdout/stderr handlers
        const handleStdout = async (data: string) => {
          // Capture timestamp immediately when event is received
          const eventTimestamp = Date.now();

          // Always accumulate stdout for cost tracking
          accumulatedStdout += data + '\n';

          // Handle chunked JSON: stdout may split JSON across multiple chunks
          jsonBuffer += data;

          // Try to extract complete JSON objects from the buffer
          const lines = jsonBuffer.split('\n');
          jsonBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
              const parsedData = JSON.parse(trimmedLine);
              const result = await processStdoutLine(parsedData, actualId, {
                eventTimestamp,
                lastAssistantMessageId,
                streamingContent,
                template
              });
              
              if (result.messageId) {
                lastAssistantMessageId = result.messageId;
              }
              streamingContent = result.streamingContent;
            } catch (parseError) {
              console.error('[Jobs] Error parsing stdout line:', parseError);
              console.log('[Jobs] Raw line (first 200 chars):', trimmedLine.substring(0, 200));
            }
          }
        };

        const handleStderr = async (data: string) => {
          console.error('[Jobs] Agent stderr:', data);
          // Capture important error indicators for debugging
          if (data.toLowerCase().includes('error') ||
              data.includes('terminated') ||
              data.includes('SIGTERM') ||
              data.includes('SIGKILL') ||
              data.includes('killed') ||
              data.includes('exit')) {
            console.error('[Jobs] CRITICAL STDERR:', data);
          }
        };

        // Check if this is the first message in the session
        const existingMessages = await getSessionMessages(actualId);
        const assistantMessages = existingMessages.filter(msg => (msg as any).role === 'assistant');
        const isFirstMessage = assistantMessages.length === 0;

        // Get the most recent user message to check for images/audios/videos
        const userMessages = existingMessages.filter(msg => (msg as any).role === 'user');
        const mostRecentUserMessage = userMessages[userMessages.length - 1];

        // Handle file-based info
        const fileInfo = buildFileInfo(message, actualId);

        // Get system prompt from template
        let systemPrompt = '';
        if (isFirstMessage && template) {
          // Get template system prompt
          const { getTemplateSystemPrompt } = await import('@soryos/config');
          systemPrompt = getTemplateSystemPrompt(template);
        }

        // Build final prompt
        const prompt = isFirstMessage
          ? systemPrompt + `\n\n# INSTRUCTIONS\n${message}${fileInfo}`
          : `# INSTRUCTIONS\n${message}${fileInfo}`;

        console.log('=== PROMPT SENT TO AGENT ===');
        console.log(`First message: ${isFirstMessage}`);
        console.log(`System prompt included: ${isFirstMessage ? 'YES' : 'NO'}`);
        console.log(prompt.substring(0, 500) + '...');
        console.log('=== END PROMPT ===');

        // Determine agent type from session or default
        const agentType = (sessionData as any)?.agentType || 'claude';
        console.log(`[Jobs] Agent Type: ${agentType}`);

        // Execute via AgentRuntime with streaming
        console.log('[Jobs] EXECUTING AGENT...');
        
        const result = await agentRuntime.run({
          sessionId: actualId,
          input: prompt,
          provider: providerId as any,
          model: model,
          onStdout: handleStdout,
          onStderr: handleStderr,
          streaming: true
        });

        console.log('[Jobs] AGENT EXECUTION COMPLETED');
        console.log('[Jobs] Result:', {
          exitCode: result.exitCode,
          stdout: !!result.stdout,
          stderr: !!result.stderr
        });

        // Handle message tracking
        console.log('[Jobs] STARTING MESSAGE TRACKING...');
        await handleMessageTracking(accumulatedStdout, actualId, lastAssistantMessageId);
        console.log('[Jobs] MESSAGE TRACKING COMPLETED');

        return result;
      });

      await step.run('update session', async () => {
        await updateSessionStatus(actualId, 'RUNNING');
      });

      // Auto-push to GitHub if configured
      await step.run('auto-push to github', async () => {
        const sessionData = await getSessionData(actualId);

        // Only auto-push if GitHub repo exists and not already pushing
        if (
          (sessionData as any)?.githubRepository &&
          (sessionData as any).githubPushStatus !== 'in_progress'
        ) {
          console.log('[Jobs] AUTO-PUSH: Triggering GitHub push for', (sessionData as any).githubRepository);

          const { sendEvent } = await import('../client');
          await sendEvent('soryos/push.github', {
            sessionId,
            convexId: actualId,
            repository: (sessionData as any).githubRepository,
            isInitialPush: false,
          });
        }
      });

      return result;

    } catch (error) {
      // Log the error - onFailure handler will take care of user messaging
      console.error('[Jobs] RUN AGENT ERROR:', error);
      throw error; // Re-throw to trigger onFailure handler
    }
  }
);

/**
 * Helper function to run agent directly
 */
export async function runAgentDirectly(data: RunAgentJobData): Promise<JobResult> {
  try {
    const { sendEvent } = await import('../client');
    await sendEvent('soryos/run.agent', data);
    return { success: true };
  } catch (error) {
    console.error('[Jobs] Failed to run agent:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
