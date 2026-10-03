import { BaseOpenAICompatibleProvider } from "./base-openai";
import type { ModelInfo } from "../../providers";

export class OpenCodeZenProvider extends BaseOpenAICompatibleProvider {
  readonly id = "opencode-zen";
  readonly name = "OpenCode Zen";

  getEndpoint(): string {
    return "https://opencode.ai/zen/v1/chat/completions";
  }

  getDefaultModel(): string {
    return "mimo-v2.5-free";
  }

  protected override getExtraHeaders(): Record<string, string> {
    return {
      "x-opencode-client": "open-source-web",
    };
  }

  listModels(): ModelInfo[] {
    return [
      {
        id: "mimo-v2.5-free",
        name: "MiMo V2.5 (Free)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Free",
        description: "Modèle de raisonnement et de refactorisation de code sur la passerelle Zen.",
      },
      {
        id: "deepseek-v4-flash-free",
        name: "DeepSeek v4 Flash (Free)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Ultra Fast",
        description: "Synthèse de code sub-seconde et génération dynamique sur passerelle Zen.",
      },
      {
        id: "nemotron-3-ultra-free",
        name: "Nemotron 3 Ultra (Free)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "NVIDIA MoE",
        description: "Architecture de planification logicielle et compréhension avancée du code.",
      },
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash (via Zen)",
        providerId: "opencode-zen",
        providerName: "OpenCode Zen",
        isFree: true,
        badge: "Zen Route",
        description: "Routage du modèle Gemini 3.8 Flash via la passerelle OpenCode Zen.",
      },
    ];
  }
}
