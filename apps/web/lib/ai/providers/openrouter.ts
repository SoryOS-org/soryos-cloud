import { BaseOpenAICompatibleProvider } from "./base-openai";
import type { ModelInfo } from "../../providers";

export class OpenRouterProvider extends BaseOpenAICompatibleProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";

  getEndpoint(): string {
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  getDefaultModel(): string {
    return "meta-llama/llama-3.3-70b-instruct:free";
  }

  protected override getExtraHeaders(): Record<string, string> {
    return {
      "HTTP-Referer": "https://soryos-code.app",
      "X-Title": "SoryOS-Code Workbench",
    };
  }

  listModels(): ModelInfo[] {
    return [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Tier",
        description: "Modèle ouvert phare de Meta avec alignement pour instructions de code.",
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Reasoning",
        description: "Modèle de raisonnement frontière avec réflexion étendue pour problèmes complexes.",
      },
      {
        id: "qwen/qwen-2.5-coder-32b-instruct:free",
        name: "Qwen 2.5 Coder 32B (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Free Code",
        description: "Modèle d'Alibaba très performant pour la génération et synthèse de code.",
      },
      {
        id: "mistralai/mistral-7b-instruct:free",
        name: "Mistral 7B Instruct (Free)",
        providerId: "openrouter",
        providerName: "OpenRouter",
        isFree: true,
        badge: "Fast Free",
        description: "Modèle français compact et efficace pour assistance rapide.",
      },
    ];
  }
}
