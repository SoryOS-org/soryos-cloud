/**
 * @soryos/jobs
 * Inngest function: create-session
 * 
 * Creates a new E2B sandbox and starts the development server.
 * This is the first step in the agent execution pipeline.
 */

import { getInngest } from '../client';
import { updateSessionStatus, addMessage, getSessionData } from '../middleware';
import { CreateSessionJobData, JobResult } from '../types';
import { sandboxRegistry } from '@soryos/sandbox';
import { SessionStore } from '@soryos/session';

/**
 * Generate a session title from the first message
 */
async function generateSessionTitle(message: string): Promise<string> {
  // Simple title generation based on first few words
  const words = message.split(/\s+/).filter(w => w.length > 0);
  const title = words.slice(0, 5).join(' ') || 'New Session';
  
  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Get template configuration
 */
async function getTemplateConfig(templateId?: string): Promise<{
  image?: string;
  startCommands: Array<{ command: string; status: string; background?: boolean }>;
  secrets?: Record<string, string>;
  systemPrompt?: string;
}> {
  // Import template configuration
  const { getTemplateById, getDefaultTemplate } = await import('@soryos/config');
  
  const template = templateId ? getTemplateById(templateId) : getDefaultTemplate();
  
  if (!template) {
    // Fallback to default Expo template
    return {
      image: process.env.E2B_DEFAULT_TEMPLATE_ID || process.env.E2B_TEMPLATE_ID,
      startCommands: [
        {
          command: 'echo fs.inotify.max_user_watches=524288 >> /etc/sysctl.conf && sysctl -p',
          status: 'CONFIGURING_ENVIRONMENT'
        },
        {
          command: 'npx expo start --tunnel --port 3000',
          status: 'STARTING_DEV_SERVER',
          background: true
        }
      ],
      secrets: {},
      systemPrompt: '# You are building a React Native Expo app...'
    };
  }
  
  return {
    image: template.image,
    startCommands: template.startCommands || [],
    secrets: template.secrets || {},
    systemPrompt: template.systemPrompt
  };
}

/**
 * Create session job function
 */
export const createSession = getInngest().createFunction(
  {
    id: 'soryos/create.session',
    retries: 0,
    concurrency: 25,
    onFailure: async ({ error, event }) => {
      const { sessionId, id } = event.data as CreateSessionJobData;
      console.error('[Jobs] Create session failure:', error);
      
      try {
        await updateSessionStatus(id || sessionId, 'error', 'Failed to create session');
        await addMessage(id || sessionId, 
          `⚠️ **Session Creation Failed**\n\n${error instanceof Error ? error.message : String(error)}`,
          'assistant');
      } catch (failureError) {
        console.error('[Jobs] Failed to handle create session failure:', failureError);
      }
    }
  },
  { event: 'soryos/create.session' },
  async ({ event, step }) => {
    const {
      sessionId,
      id,
      message,
      repository,
      token,
      template,
      providerId
    } = event.data as CreateSessionJobData;

    console.log('[Jobs] Create session started:', { sessionId, id, message: message?.substring(0, 50) });

    const actualId = id || sessionId;

    try {
      // Step 1: Create sandbox and trigger agent immediately
      const sandboxData = await step.run('create sandbox', async () => {
        // Generate session title
        const title = message ? await generateSessionTitle(message) : 'New Session';

        // Update session status
        await updateSessionStatus(actualId, 'IN_PROGRESS', 'Creating sandbox...');

        // Get template configuration
        const templateConfig = await getTemplateConfig(template);

        // Create the sandbox
        const providerIdToUse = providerId || 'e2b';
        const provider = await sandboxRegistry.createProvider(providerIdToUse, sessionId);
        
        const sandboxId = await provider.create({
          sessionId,
          envVars: templateConfig.secrets
        });

        // Update session with sandbox ID
        await updateSessionStatus(actualId, 'CLONING_REPO', 'Sandbox created', undefined, sandboxId);

        return {
          sandboxId,
          title,
          templateConfig,
          providerId: providerIdToUse
        };
      });

      // Step 2: Start dev server in parallel
      const data = await step.run('start dev server', async () => {
        // Get provider and connect
        const providerIdToUse = sandboxData.providerId || 'e2b';
        const provider = await sandboxRegistry.createProvider(providerIdToUse, sessionId);
        await provider.connect(sandboxData.sandboxId);

        // If repository is provided, clone it
        if (repository && token) {
          await updateSessionStatus(actualId, 'CLONING_REPO', 'Cloning repository...');
          await provider.executeCommand(
            `git clone https://${token}@github.com/${repository}.git .`,
            { cwd: sandboxData.templateConfig.startCommands?.[0]?.command.includes('/vibe0') ? '/vibe0' : undefined }
          );
        }

        await updateSessionStatus(actualId, 'INSTALLING_DEPENDENCIES');

        // Execute start commands
        for (const cmd of sandboxData.templateConfig.startCommands || []) {
          await updateSessionStatus(actualId, cmd.status, undefined, undefined, sandboxData.sandboxId);
          await provider.executeCommand(cmd.command, {
            background: cmd.background,
            cwd: cmd.command.includes('expo') ? '/vibe0' : undefined
          });
        }

        // Wait for dev server to start and get tunnel URL
        await updateSessionStatus(actualId, 'CREATING_TUNNEL');

        // Try to get host for common ports
        const ports = [3000, 8080, 8000, 5173];
        let tunnelUrl: string | null = null;
        
        for (const port of ports) {
          try {
            tunnelUrl = await (provider as any).getHost(port);
            if (tunnelUrl) {
              console.log(`[Jobs] Tunnel URL found on port ${port}: ${tunnelUrl}`);
              break;
            }
          } catch {
            // Port not available
          }
        }

        return {
          sandboxId: sandboxData.sandboxId,
          tunnelUrl: tunnelUrl || '',
          repository: repository,
          title: sandboxData.title
        };
      });

      // Step 3: Update session with tunnel URL
      await step.run('update session', async () => {
        await updateSessionStatus(actualId, 'RUNNING', 'Session ready', data.tunnelUrl, data.sandboxId);
        
        // Also update session name if we generated one
        if (data.title) {
          await SessionStore.update(actualId, { name: data.title });
        }
      });

      // Step 4: Trigger agent if there's a message
      if (message) {
        await step.run('trigger agent', async () => {
          console.log('[Jobs] Triggering agent for first message');
          
          // Send event to run agent
          const { sendEvent } = await import('../client');
          await sendEvent('soryos/run.agent', {
            sessionId,
            id: actualId,
            message,
            template,
            repository,
            token,
            provider: sandboxData.providerId
          });
        });
      }

      console.log('[Jobs] Create session completed:', { sandboxId: data.sandboxId, tunnelUrl: data.tunnelUrl });
      return data;

    } catch (error) {
      console.error('[Jobs] Create session error:', error);
      throw error;
    }
  }
);

/**
 * Helper function to create a session directly
 */
export async function createSessionDirectly(data: CreateSessionJobData): Promise<JobResult> {
  try {
    // Send event to Inngest
    const { sendEvent } = await import('../client');
    await sendEvent('soryos/create.session', data);
    return { success: true };
  } catch (error) {
    console.error('[Jobs] Failed to create session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
