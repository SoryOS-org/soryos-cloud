import { BaseOpenAICompatibleProvider } from "./base-openai";
import type { ModelInfo } from "../../providers";

export class GrokProvider extends BaseOpenAICompatibleProvider {
  readonly id = "grok";
  readonly name = "xAI Grok";

  getEndpoint(): string {
    return "https://api.x.ai/v1/chat/completions";
  }

  getDefaultModel(): string {
    return "grok-2-latest";
  }

  listModels(): ModelInfo[] {
    return [
      {
        id: "grok-2-latest",
        name: "Grok 2",
        providerId: "grok",
        providerName: "xAI Grok",
        isFree: false,
        badge: "Flagship",
        description: "Modèle de pointe de xAI pour développement logiciel et déductions logiques.",
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
    ];
  }
}
