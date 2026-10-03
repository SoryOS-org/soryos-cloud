import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { MistralProvider } from "./providers/mistral";
import { OpenRouterProvider } from "./providers/openrouter";
import { OpenCodeZenProvider } from "./providers/opencode-zen";
import { DeepSeekProvider } from "./providers/deepseek";
import { GrokProvider } from "./providers/grok";
import type {
  AIProvider,
  ProviderAITestResult,
  ProviderConnectionTestResult,
} from "./types";
import type { ModelInfo, ProviderInfo } from "../providers";

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.register(new GeminiProvider());
    this.register(new OpenAIProvider());
    this.register(new MistralProvider());
    this.register(new OpenRouterProvider());
    this.register(new OpenCodeZenProvider());
    this.register(new DeepSeekProvider());
    this.register(new GrokProvider());
  }

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  getRequiredProvider(providerId: string): AIProvider {
    const p = this.providers.get(providerId);
    if (!p) {
      throw new Error(`Fournisseur IA non reconnu ou introuvable : '${providerId}'`);
    }
    return p;
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getAllModels(): ModelInfo[] {
    return this.getAllProviders().flatMap((p) => p.listModels());
  }

  /**
   * Identifies the exact provider matching a model identifier.
   */
  getProviderForModel(modelId: string): AIProvider {
    // 1. Direct matching from model definitions
    for (const p of this.providers.values()) {
      const models = p.listModels();
      if (models.some((m) => m.id === modelId)) {
        return p;
      }
    }

    // 2. Pattern matching based on model prefix
    const lower = modelId.toLowerCase();
    if (lower.startsWith("gemini-") || lower.startsWith("google/")) {
      return this.getRequiredProvider("google");
    }
    if (lower.startsWith("gpt-") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("chatgpt")) {
      return this.getRequiredProvider("openai");
    }
    if (lower.startsWith("mistral") || lower.startsWith("codestral") || lower.startsWith("pixtral")) {
      return this.getRequiredProvider("mistral");
    }
    if (lower.startsWith("deepseek")) {
      return this.getRequiredProvider("deepseek");
    }
    if (lower.startsWith("grok")) {
      return this.getRequiredProvider("grok");
    }
    if (lower.includes("opencode") || lower.includes("zen") || lower.includes("mimo")) {
      return this.getRequiredProvider("opencode-zen");
    }
    if (lower.includes("/")) {
      return this.getRequiredProvider("openrouter");
    }

    // Default to Google Gemini if model is unknown
    return this.getRequiredProvider("google");
  }

  async testConnection(
    providerId: string,
    options?: { sessionId?: string; modelId?: string },
  ): Promise<ProviderConnectionTestResult> {
    const provider = this.getRequiredProvider(providerId);
    return provider.testConnection(options);
  }

  async testAI(
    providerId: string,
    options?: { sessionId?: string; modelId?: string; prompt?: string },
  ): Promise<ProviderAITestResult> {
    const provider = this.getRequiredProvider(providerId);
    return provider.testAI(options);
  }

  async runFullMatrixDiagnostics(
    sessionId?: string,
  ): Promise<Record<string, ProviderConnectionTestResult>> {
    const results: Record<string, ProviderConnectionTestResult> = {};
    const providers = this.getAllProviders();

    await Promise.all(
      providers.map(async (p) => {
        try {
          results[p.id] = await p.testConnection({ sessionId });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Erreur imprévue";
          results[p.id] = {
            success: false,
            status: "error",
            message: msg,
            latencyMs: 0,
            diagnostics: {
              providerId: p.id,
              providerName: p.name,
              credentialStatus: "missing",
              credentialSource: "none",
              credentialSourceLabel: "Erreur",
              runtimeStatus: "error",
              endpoint: p.getEndpoint(),
              model: p.getDefaultModel(),
              networkStatus: "failed",
              authStatus: "failed",
              apiStatus: "failed",
              finalResult: "runtime_error",
              errorMessage: msg,
            },
          };
        }
      }),
    );

    return results;
  }

  toProviderInfoList(): ProviderInfo[] {
    return this.getAllProviders().map((p) => {
      const cred = p.resolveCredentials();
      return {
        id: p.id,
        name: p.name,
        badge: cred.isConfigured ? "Actif" : "Configuration requise",
        hasFreeTier: p.id === "google" || p.id === "openrouter" || p.id === "opencode-zen",
        endpoint: p.getEndpoint(),
        defaultKey: p.id === "opencode-zen" ? "public" : undefined,
        description: `Provider officiel ${p.name}`,
        models: p.listModels(),
      };
    });
  }
}

// Global singleton
declare global {
  var __soryos_ai_provider_registry: AIProviderRegistry | undefined;
}

export const aiProviderRegistry =
  globalThis.__soryos_ai_provider_registry ?? new AIProviderRegistry();
globalThis.__soryos_ai_provider_registry = aiProviderRegistry;
