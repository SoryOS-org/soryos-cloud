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

export const SUPPORTED_AI_MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    providerId: "google",
    providerName: "Google Gemini",
    isFree: true,
    badge: "Recommandé",
    description: "Modèle ultra-rapide optimisé pour le codage autonome.",
    supportsTools: true,
  } as ModelInfo,
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    providerId: "google",
    providerName: "Google Gemini",
    isFree: false,
    badge: "Raisonnement",
    description: "Modèle à haute capacité de raisonnement.",
    supportsTools: true,
  } as ModelInfo,
  {
    id: "gpt-4o",
    name: "GPT-4o",
    providerId: "openai",
    providerName: "OpenAI",
    isFree: false,
    badge: "Flagship",
    description: "Modèle polyvalent OpenAI.",
    supportsTools: true,
  } as ModelInfo,
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    providerId: "opencode-zen",
    providerName: "OpenCode Zen",
    isFree: true,
    badge: "Zen Free",
    description: "Modèle optimisé OpenCode Zen.",
    supportsTools: true,
  } as ModelInfo,
];
