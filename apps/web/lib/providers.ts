export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  isFree: boolean;
  badge?: string;
  description: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  badge?: string;
  hasFreeTier: boolean;
  endpoint: string;
  defaultKey?: string;
  description: string;
  models: ModelInfo[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    badge: "Public Key",
    hasFreeTier: true,
    endpoint: "https://opencode.ai/zen/v1",
    defaultKey: "public",
    description: "OpenCode Zen gateway with public 'Bearer public' key access for free coding models",
    models: [
      {
        id: "opencode/zen-coder-free",
        name: "OpenCode Zen Coder",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Free Public",
        description: "Optimized for full-stack code scaffolding and rapid generation",
      },
      {
        id: "opencode/zen-coder-fast",
        name: "Zen Coder Fast",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Free",
        description: "Ultra low-latency streaming code assistant",
      },
      {
        id: "opencode/starcoder2-15b",
        name: "StarCoder2 15B",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Free",
        description: "Open-source big code foundation model for programming",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    badge: "Free Models",
    hasFreeTier: true,
    endpoint: "https://openrouter.ai/api/v1",
    description: "Universal model router with free community access",
    models: [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free",
        description: "Meta's flagship open model with instruction tuning",
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Reasoning",
        description: "Frontier reasoning model with extended reflection",
      },
      {
        id: "qwen/qwen-2.5-coder-32b-instruct:free",
        name: "Qwen 2.5 Coder 32B",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Code",
        description: "Alibaba's benchmark leader for code synthesis",
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash Exp",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free",
        description: "Experimental high-speed multimodal reasoning",
      },
      {
        id: "mistralai/mistral-7b-instruct:free",
        name: "Mistral 7B Instruct",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free",
        description: "Compact, efficient French foundation model",
      },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    badge: "Free Tier",
    hasFreeTier: true,
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    description: "State-of-the-art multimodal reasoning and coding",
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Recommended",
        description: "Sub-second latency, massive context window, excellent code generation",
      },
      {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Free Tier",
        description: "Cost-efficient lightweight intelligence for fast edits",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "General",
        description: "General-purpose agent workflows and complex task completion",
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    hasFreeTier: false,
    endpoint: "https://api.mistral.ai/v1",
    description: "European champion open weights and specialized coding models",
    models: [
      {
        id: "codestral-latest",
        name: "Codestral",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Code Pro",
        description: "Mistral's dedicated generative code completion model",
      },
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Flagship",
        description: "Top-tier reasoning with native multi-lingual capabilities",
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Fast",
        description: "Low-latency balanced model for rapid prototyping",
      },
    ],
  },
  {
    id: "grok",
    name: "xAI Grok",
    hasFreeTier: false,
    endpoint: "https://api.x.ai/v1",
    description: "Real-time knowledge and unfiltered reasoning by xAI",
    models: [
      {
        id: "grok-beta",
        name: "Grok Beta",
        providerId: "grok",
        providerName: "xAI Grok",
        isFree: false,
        badge: "Reasoning",
        description: "Frontier mathematical and logic deduction agent",
      },
      {
        id: "grok-2",
        name: "Grok 2",
        providerId: "grok",
        providerName: "xAI Grok",
        isFree: false,
        badge: "Flagship",
        description: "General conversational and software engineering model",
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    hasFreeTier: true,
    endpoint: "https://api.deepseek.com/v1",
    description: "Open-weights reasoning, coder, and chat architectures",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "Popular",
        description: "671B MoE architecture with exceptional code and reasoning",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "CoT",
        description: "In-depth chain-of-thought verification for edge cases",
      },
    ],
  },
];

export const DEFAULT_MODEL_ID = "opencode/zen-coder-free";

export function getAllModels(): ModelInfo[] {
  return PROVIDERS.flatMap((p) => p.models);
}

export function getModelById(id?: string | null): ModelInfo {
  if (!id) {
    return (
      getAllModels().find((m) => m.id === DEFAULT_MODEL_ID) ||
      PROVIDERS[0].models[0]
    );
  }
  const found = getAllModels().find((m) => m.id === id);
  if (found) return found;
  return (
    getAllModels().find((m) => m.id === DEFAULT_MODEL_ID) ||
    PROVIDERS[0].models[0]
  );
}
