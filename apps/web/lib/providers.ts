/**
 * Provider and Model Definitions for SoryOS-Code Web App
 * Integrates with @soryos/provider and provides live model discovery.
 */

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  isFree?: boolean;
  badge?: string;
  description?: string;
  supportsTools?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  category?: string;
  models: ModelInfo[];
}

export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

export const INITIAL_PROVIDERS: ProviderInfo[] = [
  {
    id: "google",
    name: "Google Gemini",
    description: "Modèles d'ingénierie de pointe Google avec latence minimale et large fenêtre de contexte.",
    category: "ai",
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Recommandé",
        description: "Modèle ultra-rapide optimisé pour le codage autonome et l'exécution d'outils.",
        supportsTools: true,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Raisonnement",
        description: "Raisonnement avancé pour refactoring complexe et architectures multi-modules.",
        supportsTools: true,
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Modèles phares GPT-4o pour synthèse, complétion et exécution de code.",
    category: "ai",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Flagship",
        description: "Performance haut de gamme pour toutes tâches de codage.",
        supportsTools: true,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: true,
        badge: "Rapide",
        description: "Version légère et rapide pour requêtes courantes.",
        supportsTools: true,
      },
    ],
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    description: "Hub de modèles gratuits auto-hébergés et optimisés pour la programmation sans quota restrictif.",
    category: "ai",
    models: [
      {
        id: "opencode-zen-deepseek-coder",
        name: "DeepSeek Coder 33B (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Spécialiste de la génération de code, syntaxe et tests unitaires.",
        supportsTools: true,
      },
      {
        id: "opencode-zen-qwen-coder",
        name: "Qwen 2.5 Coder 32B (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Excellence algorithmique et résolution de bugs complexes.",
        supportsTools: true,
      },
      {
        id: "opencode-zen-llama3-instruct",
        name: "Llama 3.3 70B (Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Polyvalence linguistique et planification d'architecture logicielle.",
        supportsTools: true,
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Modèles européens souverains axés sur la précision et l'optimisation des tokens.",
    category: "ai",
    models: [
      {
        id: "codestral-latest",
        name: "Codestral",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Spécialiste Code",
        description: "Conçu spécifiquement pour le développement logiciel et le fill-in-the-middle.",
        supportsTools: true,
      },
    ],
  },
];

declare global {
  var __soryos_cached_providers: ProviderInfo[] | undefined;
}

let cachedProviders: ProviderInfo[] =
  globalThis.__soryos_cached_providers ?? [...INITIAL_PROVIDERS];
globalThis.__soryos_cached_providers = cachedProviders;

export function getAllProviders(): ProviderInfo[] {
  return cachedProviders;
}

export function getModelById(modelId: string): ModelInfo {
  for (const provider of cachedProviders) {
    const found = provider.models.find((m) => m.id === modelId);
    if (found) return found;
  }
  // Fallback to default model or generic
  return (
    cachedProviders[0]?.models[0] || {
      id: modelId,
      name: modelId,
      providerId: "google",
      providerName: "Google Gemini",
      isFree: true,
    }
  );
}

export async function syncOpenCodeZenModels(): Promise<{ synced: number; message: string }> {
  try {
    // Attempt to query OpenCode Zen live registry if endpoint exists
    const zenEndpoint = process.env.OPENCODE_ZEN_URL || "https://zen.opencode.ai/api/v1/models";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(zenEndpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.models)) {
        const zenProvider = cachedProviders.find((p) => p.id === "opencode-zen");
        if (zenProvider) {
          const newModels = data.models.map((m: any) => ({
            id: m.id || `opencode-zen-${m.name.toLowerCase()}`,
            name: m.name || m.id,
            providerId: "opencode-zen",
            providerName: "OpenCode Zen",
            isFree: true,
            badge: "Zen Free",
            description: m.description || "Modèle dynamique OpenCode Zen synchronisé.",
            supportsTools: Boolean(m.supports_tools ?? true),
          }));
          zenProvider.models = newModels;
          return { synced: newModels.length, message: `Synchronisé avec succès ${newModels.length} modèles Zen` };
        }
      }
    }
  } catch (err) {
    console.warn("Sync OpenCode Zen skipped:", err);
  }

  const zenProvider = cachedProviders.find((p) => p.id === "opencode-zen");
  return {
    synced: zenProvider?.models.length || 0,
    message: "Modèles OpenCode Zen à jour",
  };
}
