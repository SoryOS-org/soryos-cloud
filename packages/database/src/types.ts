/**
 * @soryos/database
 * Type Definitions for Real-time Database
 */

import { Id } from '@soryos/shared';

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus =
  | 'IN_PROGRESS'
  | 'CLONING_REPO'
  | 'INSTALLING_DEPENDENCIES'
  | 'STARTING_DEV_SERVER'
  | 'CREATING_TUNNEL'
  | 'RUNNING'
  | 'CUSTOM'
  | 'CREATING_GITHUB_REPO'
  | 'INITIALIZING_GIT'
  | 'ADDING_FILES'
  | 'COMMITTING_CHANGES'
  | 'PUSHING_TO_GITHUB'
  | 'PUSH_COMPLETE'
  | 'PUSH_FAILED'
  | 'AUTO_PUSHING'
  | 'USING_EXISTING_REPO'
  | 'PAUSED'
  | 'TERMINATED'
  | 'ERROR';

export interface Session {
  _id: Id<'sessions'>;
  _creationTime: number;
  
  // Identification
  id: string;
  sessionId: string; // E2B sandbox ID
  name: string;
  
  // Ownership
  createdBy: string; // Clerk user ID
  
  // Configuration
  templateId: string;
  repository?: string;
  pullRequest?: any;
  
  // State
  status: SessionStatus;
  statusMessage?: string;
  
  // Environment
  tunnelUrl?: string;
  envs?: Record<string, string>;
  
  // GitHub
  githubRepository?: string;
  githubRepositoryUrl?: string;
  githubPushStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  githubPushDate?: number;
  
  // Agent
  agentStopped?: boolean;
  
  // Cost tracking
  totalCostUSD?: number;
  messageCount?: number;
  lastCostUpdate?: number;
  
  // Convex project
  convexProject?: {
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
    projectSlug?: string;
    teamSlug?: string;
  };
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export type ToolType = 
  | 'read'
  | 'edit'
  | 'bash'
  | 'grep'
  | 'searchReplace'
  | 'webSearch'
  | 'mcpTool'
  | 'tool'
  | 'codebaseSearch';

export interface MessageEdit {
  filePath: string;
  oldString: string;
  newString: string;
}

export interface MessageRead {
  filePath: string;
}

export interface MessageBash {
  command: string;
  output?: string;
  exitCode?: number;
}

export interface MessageTool {
  toolName: string;
  command?: string;
  output?: string;
  exitCode?: number;
  status?: string;
}

export interface MessageSearchReplace {
  filePath: string;
  oldString: string;
  newString: string;
  replacements?: number;
}

export interface MessageWebSearch {
  query: string;
  results?: string;
}

export interface MessageMcpTool {
  toolName: string;
  input?: any;
  output?: any;
  status?: string;
}

export interface MessageCodebaseSearch {
  query: string;
  results?: string;
  targetDirectories?: string[];
}

export interface Message {
  _id: Id<'messages'>;
  _creationTime: number;
  
  // Identification
  id: string;
  sessionId: Id<'sessions'>;
  
  // Content
  role: MessageRole;
  content: string;
  
  // Tools
  edits?: MessageEdit;
  read?: MessageRead;
  bash?: MessageBash;
  tool?: MessageTool;
  searchReplace?: MessageSearchReplace;
  webSearch?: MessageWebSearch;
  mcpTool?: MessageMcpTool;
  codebaseSearch?: MessageCodebaseSearch;
  
  // Attachments
  images?: Array<{
    fileName: string;
    path: string;
    storageId?: Id<'_storage'>;
  }>;
  audios?: Array<{
    fileName: string;
    path: string;
    storageId?: Id<'_storage'>;
  }>;
  videos?: Array<{
    fileName: string;
    path: string;
    storageId?: Id<'_storage'>;
  }>;
  
  // Tasks
  todos?: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
  }>;
  
  // Metadata
  checkpoint?: {
    branch: string;
    patch?: string;
  };
  thinking?: string;
  streamId?: string;
  
  // Cost tracking
  costUSD?: number;
  modelUsed?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  durationMs?: number;
  createdAt?: number;
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface SubscriptionOptions {
  sessionId?: string;
  messageLimit?: number;
  includeMessages?: boolean;
  includeFiles?: boolean;
}

export interface SubscriptionCallback<T> {
  (data: T, error?: Error): void;
}

export interface Subscription {
  unsubscribe: () => void;
  isActive: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export type DatabaseEventType =
  | 'message.added'
  | 'message.updated'
  | 'message.removed'
  | 'session.created'
  | 'session.updated'
  | 'session.removed'
  | 'error';

export interface DatabaseEvent {
  type: DatabaseEventType;
  timestamp: string;
  data?: any;
  error?: Error;
}

export interface DatabaseEventListener {
  (event: DatabaseEvent): void;
}

// ============================================================================
// Query Types
// ============================================================================

export interface QueryOptions {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export interface SessionQueryOptions extends QueryOptions {
  createdBy?: string;
  status?: SessionStatus;
  templateId?: string;
}

export interface MessageQueryOptions extends QueryOptions {
  sessionId?: string;
  role?: MessageRole;
}
