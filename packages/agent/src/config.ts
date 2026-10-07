/**
 * @soryos/agent
 * Agent configuration and definitions.
 */

import { AgentDefinition } from './types';

/**
 * Agent Matrix - all available agent definitions
 */
export const AGENT_MATRIX: AgentDefinition[] = [
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet',
    description: 'Fast and capable model for most tasks',
    model: 'claude-4-sonnet-20250513',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'claude-4',
    name: 'Claude 4',
    description: 'Most intelligent model for complex tasks',
    model: 'claude-4-20250513',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'claude-4-opus',
    name: 'Claude 4 Opus',
    description: 'Most powerful model for expert-level tasks',
    model: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast and efficient model for quick tasks',
    model: 'gemini-2.5-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Powerful model for complex tasks',
    model: 'gemini-2.5-pro',
    provider: 'google',
    capabilities: ['code', 'text', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'cursor-small',
    name: 'Cursor Small',
    description: 'Fast coding model from Cursor',
    model: 'cursor-small',
    provider: 'cursor',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are Cursor, an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'cursor-medium',
    name: 'Cursor Medium',
    description: 'Balanced coding model from Cursor',
    model: 'cursor-medium',
    provider: 'cursor',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are Cursor, an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'cursor-large',
    name: 'Cursor Large',
    description: 'Most powerful coding model from Cursor',
    model: 'cursor-large',
    provider: 'cursor',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are Cursor, an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Omni model from OpenAI with vision and audio',
    model: 'gpt-4o',
    provider: 'openai',
    capabilities: ['code', 'text', 'vision', 'audio'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and efficient omni model from OpenAI',
    model: 'gpt-4o-mini',
    provider: 'openai',
    capabilities: ['code', 'text', 'vision', 'audio'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'live-voice',
    name: 'Live Voice Agent',
    description: 'AI agent for real-time voice interactions and commands',
    model: 'gpt-4o',
    provider: 'openai',
    capabilities: ['code', 'text', 'vision', 'audio', 'voice', 'realtime'],
    systemPrompt: 'You are a Live Voice Agent in SoryOS Code. You can receive voice input from users and respond with actions. Process voice commands, execute tools, and provide real-time feedback. Always acknowledge voice input and provide clear, concise responses.'
  }
];

/**
 * Get an agent definition by ID
 */
export function getAgentDefinition(id: string): AgentDefinition | undefined {
  return AGENT_MATRIX.find(agent => agent.id === id || agent.model === id);
}

/**
 * Get all agent definitions
 */
export function getAllAgentDefinitions(): AgentDefinition[] {
  return [...AGENT_MATRIX];
}

/**
 * Get agent definitions by provider
 */
export function getAgentsByProvider(provider: string): AgentDefinition[] {
  return AGENT_MATRIX.filter(agent => agent.provider === provider);
}

/**
 * Get agent definitions by capability
 */
export function getAgentsByCapability(capability: string): AgentDefinition[] {
  return AGENT_MATRIX.filter(agent => agent.capabilities.includes(capability));
}

/**
 * Get default agent definition
 */
export function getDefaultAgent(): AgentDefinition {
  return AGENT_MATRIX.find(agent => agent.id === 'claude-4-sonnet') || AGENT_MATRIX[0];
}

/**
 * Get agent definition by model ID
 */
export function getAgentByModel(model: string): AgentDefinition | undefined {
  return AGENT_MATRIX.find(agent => 
    agent.model === model || 
    agent.id === model ||
    agent.name.toLowerCase().includes(model.toLowerCase())
  );
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  defaultModel: string;
  defaultProvider: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  streaming: boolean;
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  defaultModel: 'claude-4-sonnet',
  defaultProvider: 'anthropic',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
  streaming: true
};
