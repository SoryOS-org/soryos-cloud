export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  isFree: boolean;
  badge?: string;
  description: string;
  contextLength?: string;
  pricing?: string;
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
  lastSyncedAt?: string;
}

// The real OpenCode Zen free models catalog
export const REAL_OPENCODE_ZEN_FREE_MODELS: ModelInfo[] = [
  {
    id: "opencode/zen-coder-free",
    name: "OpenCode Zen Coder",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Free Public",
    description: "Flagship default coding agent model on OpenCode Zen free tier",
    pricing: "Free (Bearer public)",
  },
  {
    id: "mimo-v2.5:free",
    name: "MiMo V2.5",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Free Tier",
    description: "High-accuracy code reasoning & refactoring model on Zen free tier",
    pricing: "Free",
  },
  {
    id: "deepseek-v4-flash:free",
    name: "DeepSeek v4 Flash",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Ultra Fast",
    description: "Sub-second inference and code synthesis on Zen free tier",
    pricing: "Free",
  },
  {
    id: "laguna-s-2.1:free",
    name: "Laguna S 2.1",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Top Free",
    description: "Leading benchmark performer for full-stack frontend & backend apps",
    pricing: "Free",
  },
  {
    id: "nemotron-3-ultra:free",
    name: "Nemotron 3 Ultra",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "NVIDIA MoE",
    description: "Advanced code comprehension & architectural planning",
    pricing: "Free",
  },
  {
    id: "north-mini-code:free",
    name: "North Mini Code",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Low Latency",
    description: "Lightweight, ultra-responsive model for quick code edits & diffs",
    pricing: "Free",
  },
  {
    id: "qwen/qwen-2.5-coder-32b:free",
    name: "Qwen 2.5 Coder 32B",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Free Code",
    description: "Top-tier 32B parameter code synthesis model via Zen gateway",
    pricing: "Free",
  },
  {
    id: "opencode/starcoder2-15b",
    name: "StarCoder2 15B",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "BigCode Free",
    description: "Open-source big code foundation model for programming",
    pricing: "Free",
  },
];

// Global dynamic storage for dynamically discovered OpenCode Zen models
declare global {
  var __codeforge_dynamic_providers: ProviderInfo[] | undefined;
  var __codeforge_last_synced_at: string | undefined;
}

export const INITIAL_PROVIDERS: ProviderInfo[] = [
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    badge: "Public Key",
    hasFreeTier: true,
    endpoint: "https://opencode.ai/zen/v1",
    defaultKey: "public",
    description: "OpenCode Zen gateway with public 'Bearer public' key access for free coding models",
    models: [...REAL_OPENCODE_ZEN_FREE_MODELS],
    lastSyncedAt: new Date().toISOString(),
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

// In-memory mutable providers list that updates whenever OpenCode Zen adds new models
export const PROVIDERS: ProviderInfo[] =
  globalThis.__codeforge_dynamic_providers ?? JSON.parse(JSON.stringify(INITIAL_PROVIDERS));
globalThis.__codeforge_dynamic_providers = PROVIDERS;

export const DEFAULT_MODEL_ID = "opencode/zen-coder-free";

export function getAllProviders(): ProviderInfo[] {
  return globalThis.__codeforge_dynamic_providers ?? PROVIDERS;
}

export function getAllModels(): ModelInfo[] {
  const currentProviders = getAllProviders();
  return currentProviders.flatMap((p) => p.models);
}

export function getModelById(id?: string | null): ModelInfo {
  const all = getAllModels();
  if (!id) {
    return all.find((m) => m.id === DEFAULT_MODEL_ID) || all[0];
  }
  const found = all.find((m) => m.id === id);
  if (found) return found;
  return all.find((m) => m.id === DEFAULT_MODEL_ID) || all[0];
}

/**
 * Merges newly discovered models from OpenCode Zen into the OpenCode Zen provider.
 * Ensures duplicate model IDs are updated and new ones are appended.
 */
export function registerDynamicZenModels(newModels: ModelInfo[]): ProviderInfo[] {
  const providers = getAllProviders();
  const zen = providers.find((p) => p.id === "opencode-zen");
  if (!zen) return providers;

  const existingMap = new Map(zen.models.map((m) => [m.id, m]));

  for (const m of newModels) {
    existingMap.set(m.id, {
      ...m,
      providerId: "opencode-zen",
      providerName: "OpenCode Zen",
      isFree: true,
    });
  }

  zen.models = Array.from(existingMap.values());
  zen.lastSyncedAt = new Date().toISOString();
  globalThis.__codeforge_last_synced_at = zen.lastSyncedAt;
  return providers;
}

/**
 * Live sync with OpenCode Zen API endpoint (`/models`).
 * If remote responds with live models, merges them into the in-memory catalog.
 */
export async function syncOpenCodeZenModels(): Promise<{
  success: boolean;
  modelCount: number;
  models: ModelInfo[];
  lastSyncedAt: string;
}> {
  const zenProvider = getAllProviders().find((p) => p.id === "opencode-zen");
  const endpoint = zenProvider?.endpoint || "https://opencode.ai/zen/v1";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${endpoint}/models`, {
      headers: {
        Authorization: "Bearer public",
        "x-opencode-client": "open-source-web",
        Accept: "application/json",
      },
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const data = (await res.json().catch(() => null)) as {
        data?: Array<{ id: string; name?: string; description?: string; pricing?: { prompt?: string } }>;
      } | null;

      if (data && Array.isArray(data.data) && data.data.length > 0) {
        const parsedModels: ModelInfo[] = data.data.map((item) => ({
          id: item.id,
          name: item.name || item.id.split("/").pop() || item.id,
          providerId: "opencode-zen",
          providerName: "OpenCode Zen",
          isFree: true,
          badge: "Live Zen Free",
          description:
            item.description || "Real-time free model dynamically discovered from OpenCode Zen",
        }));

        registerDynamicZenModels(parsedModels);
      }
    }
  } catch (err) {
    console.warn("OpenCode Zen live fetch skipped or timed out, keeping active catalog:", err);
  }

  const updatedZen = getAllProviders().find((p) => p.id === "opencode-zen");
  return {
    success: true,
    modelCount: updatedZen?.models.length || REAL_OPENCODE_ZEN_FREE_MODELS.length,
    models: updatedZen?.models || REAL_OPENCODE_ZEN_FREE_MODELS,
    lastSyncedAt: updatedZen?.lastSyncedAt || new Date().toISOString(),
  };
}
