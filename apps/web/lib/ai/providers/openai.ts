import { BaseOpenAICompatibleProvider } from "./base-openai";
import type { ModelInfo } from "../../providers";

export class OpenAIProvider extends BaseOpenAICompatibleProvider {
  readonly id = "openai";
  readonly name = "OpenAI";

  getEndpoint(): string {
    return "https://api.openai.com/v1/chat/completions";
  }

  getDefaultModel(): string {
    return "gpt-4o";
  }

  listModels(): ModelInfo[] {
    return [
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
        description: "Modèle compact ultra-rapide et économique pour la majorité des tâches de programmation.",
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Reasoning",
        description: "Modèle de raisonnement avancé pour résolution d'algorithmes et architecture système.",
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        providerId: "openai",
        providerName: "OpenAI",
        isFree: false,
        badge: "Legacy Pro",
        description: "Version haute capacité 128k context pour grands dépôts de code.",
      },
    ];
  }
}
