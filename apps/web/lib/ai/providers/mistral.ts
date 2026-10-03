import { BaseOpenAICompatibleProvider } from "./base-openai";
import type { ModelInfo } from "../../providers";

export class MistralProvider extends BaseOpenAICompatibleProvider {
  readonly id = "mistral";
  readonly name = "Mistral AI";

  getEndpoint(): string {
    return "https://api.mistral.ai/v1/chat/completions";
  }

  getDefaultModel(): string {
    return "codestral-latest";
  }

  listModels(): ModelInfo[] {
    return [
      {
        id: "codestral-latest",
        name: "Codestral Latest",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Code Flagship",
        description: "Modèle génératif spécialisé de Mistral pour la complétion et refactorisation de code.",
      },
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Frontier",
        description: "Raisonnement général de premier plan avec capacités multilingues natives.",
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        providerId: "mistral",
        providerName: "Mistral AI",
        isFree: false,
        badge: "Low Latency",
        description: "Modèle réactif et économique pour prototypage rapide et revues de code.",
      },
    ];
  }
}
