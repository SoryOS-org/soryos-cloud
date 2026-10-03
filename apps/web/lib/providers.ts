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

// OpenCode Zen actual supported catalog
export const REAL_OPENCODE_ZEN_FREE_MODELS: ModelInfo[] = [
  {
    id: "mimo-v2.5-free",
    name: "MiMo V2.5 (Free)",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Zen Free",
    description: "Modèle de raisonnement et de refactorisation de code sur la passerelle Zen.",
    pricing: "Free (Bearer public)",
  },
  {
    id: "deepseek-v4-flash-free",
    name: "DeepSeek v4 Flash (Free)",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Zen Ultra Fast",
    description: "Synthèse de code sub-seconde et génération dynamique sur passerelle Zen.",
    pricing: "Free",
  },
  {
    id: "nemotron-3-ultra-free",
    name: "Nemotron 3 Ultra (Free)",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "NVIDIA MoE",
    description: "Architecture de planification logicielle et compréhension avancée du code.",
    pricing: "Free",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (Zen Route)",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Zen Gateway",
    description: "Routage du modèle Gemini 3.8 Flash via la passerelle OpenCode Zen.",
    pricing: "Free",
  },
];

declare global {
  var __codeforge_dynamic_providers: ProviderInfo[] | undefined;
  var __codeforge_last_synced_at: string | undefined;
}

export const INITIAL_PROVIDERS: ProviderInfo[] = [
  {
    id: "google",
    name: "Google Gemini",
    badge: "Recommandé",
    hasFreeTier: true,
    endpoint: "https://generativelanguage.googleapis.com",
    description: "Modèles officiels Google Gemini 3.8 Flash, 3.1 Pro et 3.1 Flash Lite.",
    models: [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Recommandé",
        description: "Vitesse d'inférence exceptionnelle, fenêtre de contexte massive et excellent en code.",
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Frontier",
        description: "Raisonnement avancé, mathématiques et architecture système complexe.",
      },
      {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Ultra Rapide",
        description: "Latence minimale et coût réduit pour modifications légères et itérations.",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    badge: "Officiel",
    hasFreeTier: false,
    endpoint: "https://api.openai.com/v1/chat/completions",
    description: "Modèles officiels OpenAI GPT-4o, GPT-4o Mini et o3-mini.",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Flagship",
        description: "Modèle multimodal frontière d'OpenAI pour raisonnement et code complexe.",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Fast",
        description: "Compact, ultra-rapide et économique pour génération quotidienne.",
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Reasoning",
        description: "Modèle de raisonnement avancé pour logique et mathématiques.",
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Pro 128k",
        description: "Version 128k context pour grands dépôts de code.",
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    badge: "European Pro",
    hasFreeTier: false,
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    description: "Modèles Codestral, Mistral Large et Small optimisés pour le code.",
    models: [
      {
        id: "codestral-latest",
        name: "Codestral",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Code Pro",
        description: "Modèle Mistral dédié à la complétion et la génération de code.",
      },
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Flagship",
        description: "Raisonnement général de premier rang avec capacités multilingues.",
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Fast",
        description: "Faible latence pour revues de code et assistants réactifs.",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    badge: "Free Models",
    hasFreeTier: true,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    description: "Passerelle universelle donnant accès à Llama 3.3, DeepSeek R1 et Qwen 2.5.",
    models: [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle open-source phare de Meta pour programmation et instructions.",
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Reasoning",
        description: "Modèle de raisonnement avec réflexion approfondie.",
      },
      {
        id: "qwen/qwen-2.5-coder-32b-instruct:free",
        name: "Qwen 2.5 Coder 32B (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Code",
        description: "Modèle d'Alibaba spécialement entraîné sur les langages de code.",
      },
      {
        id: "mistralai/mistral-7b-instruct:free",
        name: "Mistral 7B Instruct (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Fast Free",
        description: "Modèle compact et agile pour requêtes rapides.",
      },
    ],
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    badge: "Zen Gateway",
    hasFreeTier: true,
    endpoint: "https://opencode.ai/zen/v1",
    defaultKey: "public",
    description: "Passerelle publique OpenCode Zen pour modèles coding communautaires.",
    models: [...REAL_OPENCODE_ZEN_FREE_MODELS],
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    badge: "MoE",
    hasFreeTier: true,
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    description: "Modèles DeepSeek V3 et DeepSeek R1 pour calculs et code.",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "Popular MoE",
        description: "671B MoE très rapide avec compétences avancées en programmation.",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: true,
        badge: "Reasoning CoT",
        description: "Vérification étape par étape pour algorithmes difficiles.",
      },
    ],
  },
  {
    id: "grok",
    name: "xAI Grok",
    badge: "xAI",
    hasFreeTier: false,
    endpoint: "https://api.x.ai/v1/chat/completions",
    description: "Raisonnement non filtré et connaissances en temps réel.",
    models: [
      {
        id: "grok-2-latest",
        name: "Grok 2",
        providerId: "grok",
        providerName: "xAI Grok",
        isFree: false,
        badge: "Flagship",
        description: "Modèle de pointe conversationnel et génie logiciel par xAI.",
      },
      {
        id: "grok-beta",
        name: "Grok Beta",
        providerId: "grok",
        providerName: "xAI Grok",
        isFree: false,
        badge: "Fast Beta",
        description: "Version d'expérimentation rapide pour déductions et interactions.",
      },
    ],
  },
];

export const PROVIDERS: ProviderInfo[] =
  globalThis.__codeforge_dynamic_providers ?? JSON.parse(JSON.stringify(INITIAL_PROVIDERS));
globalThis.__codeforge_dynamic_providers = PROVIDERS;

export const DEFAULT_MODEL_ID = "gemini-3.8-flash";

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
        data?: Array<{ id: string; name?: string; description?: string }>;
      } | null;

      if (data && Array.isArray(data.data) && data.data.length > 0) {
        const parsedModels: ModelInfo[] = data.data.map((item) => ({
          id: item.id,
          name: item.name || item.id.split("/").pop() || item.id,
          providerId: "opencode-zen",
          providerName: "OpenCode Zen",
          isFree: true,
          badge: "Live Zen",
          description:
            item.description || "Modèle découvert dynamiquement depuis OpenCode Zen",
        }));

        registerDynamicZenModels(parsedModels);
      }
    }
  } catch (err) {
    console.warn("OpenCode Zen live fetch skipped or timed out:", err);
  }

  const updatedZen = getAllProviders().find((p) => p.id === "opencode-zen");
  return {
    success: true,
    modelCount: updatedZen?.models.length || REAL_OPENCODE_ZEN_FREE_MODELS.length,
    models: updatedZen?.models || REAL_OPENCODE_ZEN_FREE_MODELS,
    lastSyncedAt: updatedZen?.lastSyncedAt || new Date().toISOString(),
  };
}
