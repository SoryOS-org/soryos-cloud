import { BaseOpenAICompatibleProvider } from "./base-openai";
import type { ModelInfo } from "../../providers";

export class DeepSeekProvider extends BaseOpenAICompatibleProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";

  getEndpoint(): string {
    return "https://api.deepseek.com/v1/chat/completions";
  }

  getDefaultModel(): string {
    return "deepseek-chat";
  }

  listModels(): ModelInfo[] {
    return [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: false,
        badge: "MoE Flagship",
        description: "Architecture 671B MoE avec excellence éprouvée pour code et raisonnement général.",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        providerId: "deepseek",
        providerName: "DeepSeek",
        isFree: false,
        badge: "CoT Frontier",
        description: "Chaîne de pensée (Chain-of-Thought) approfondie pour algorithmes pointus et edge-cases.",
      },
    ];
  }
}
