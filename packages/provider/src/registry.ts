import type { AIProvider, ProviderAITestResult, ProviderConnectionTestResult } from "./types";
import type { ModelInfo } from "./models";
import { SUPPORTED_AI_MODELS } from "./models";

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

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
    return SUPPORTED_AI_MODELS;
  }

  getProviderForModel(modelId: string): AIProvider {
    for (const p of this.providers.values()) {
      const models = p.listModels();
      if (models.some((m) => m.id === modelId)) {
        return p;
      }
    }
    return this.getRequiredProvider("google");
  }

  resolveApiKey(providerId: string): string {
    if (providerId === "google") {
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    }
    if (providerId === "openai") {
      return process.env.OPENAI_API_KEY || "";
    }
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  }
}

export const aiProviderRegistry = new AIProviderRegistry();
