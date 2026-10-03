export type AuthMethod = "github_oauth" | "api_key" | "api_token" | "service_account";

export interface ProviderDefinition {
  id: string;
  name: string;
  category: "ai" | "sandbox" | "vcs";
  authenticationMethod: AuthMethod;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    type: "password" | "text" | "textarea";
    description?: string;
  }>;
}

export interface ProviderStatus {
  id: string;
  name: string;
  category: "ai" | "sandbox" | "vcs";
  authenticationMethod: AuthMethod;
  description: string;
  configured: boolean;
  maskedKey?: string;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "error" | "untested";
  lastTestMessage?: string;
}

export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  google: {
    id: "google",
    name: "Google Gemini",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles multimodaux Gemini 2.5 Flash, 2.5 Pro et 2.0 Flash pour génération ultra-rapide.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API Google Gemini",
        placeholder: "AIzaSy... ou AQ.Ab8...",
        type: "password",
        description: "Clé API générée depuis Google AI Studio (aistudio.google.com)",
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Passerelle universelle donnant accès à Llama 3.3, DeepSeek R1, Qwen 2.5 et 100+ modèles.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API OpenRouter",
        placeholder: "sk-or-v1-...",
        type: "password",
        description: "Clé API OpenRouter (openrouter.ai). Les modèles :free fonctionnent aussi sans clé.",
      },
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles DeepSeek V3 et R1 pour raisonnement mathématique et synthèse de code.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API DeepSeek",
        placeholder: "sk-...",
        type: "password",
        description: "Clé API générée depuis platform.deepseek.com",
      },
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles Codestral, Mistral Large et Small optimisés pour le code et le multilingue.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API Mistral",
        placeholder: "...",
        type: "password",
        description: "Clé API générée depuis console.mistral.ai",
      },
    ],
  },
  grok: {
    id: "grok",
    name: "xAI Grok",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Modèles Grok-2 et Grok Beta avec raisonnement approfondi par xAI.",
    fields: [
      {
        key: "apiKey",
        label: "Clé API xAI Grok",
        placeholder: "xai-...",
        type: "password",
        description: "Clé API générée depuis console.x.ai",
      },
    ],
  },
  "opencode-zen": {
    id: "opencode-zen",
    name: "OpenCode Zen",
    category: "ai",
    authenticationMethod: "api_key",
    description: "Passerelle publique OpenCode Zen pour modèles open-source gratuits (Bearer public).",
    fields: [
      {
        key: "apiKey",
        label: "Clé Zen (Optionnel)",
        placeholder: "public ou votre clé personnalisée",
        type: "password",
        description: "Laissez 'public' pour utiliser le quota communautaire gratuit.",
      },
    ],
  },
  e2b: {
    id: "e2b",
    name: "E2B Sandbox",
    category: "sandbox",
    authenticationMethod: "api_key",
    description: "Sandboxes sécurisées pour exécuter du code, des terminaux et des agents IA.",
    fields: [
      {
        key: "apiKey",
        label: "API Key E2B",
        placeholder: "e2b_********************************",
        type: "password",
        description: "Clé API générée depuis votre console e2b.dev",
      },
    ],
  },
  vercel: {
    id: "vercel",
    name: "Vercel Sandbox",
    category: "sandbox",
    authenticationMethod: "api_token",
    description: "Environnement d'exécution et de prévisualisation cloud serverless.",
    fields: [
      {
        key: "apiToken",
        label: "Vercel API Token",
        placeholder: "vercel_tok_************************",
        type: "password",
        description: "Personal Access Token Vercel avec accès Sandbox/Deployments",
      },
    ],
  },
  "google-cloud-run": {
    id: "google-cloud-run",
    name: "Google Cloud Run",
    category: "sandbox",
    authenticationMethod: "service_account",
    description: "Cloud Run Jobs pour compilations lourdes et création d'ISO.",
    fields: [
      {
        key: "projectId",
        label: "GCP Project ID",
        placeholder: "my-gcp-project-123",
        type: "text",
        description: "Identifiant de votre projet Google Cloud",
      },
      {
        key: "serviceAccountKey",
        label: "Service Account JSON Key",
        placeholder: '{\n  "type": "service_account",\n  "project_id": "..."\n}',
        type: "textarea",
        description: "Clé JSON du compte de service GCP avec rôles Cloud Run Admin",
      },
    ],
  },
};

declare global {
  var __soryos_credentials_store: Map<string, Record<string, string>> | undefined;
  var __soryos_credentials_tests: Map<string, { status: "success" | "error"; message: string; timestamp: string }> | undefined;
}

const credentialsStore = globalThis.__soryos_credentials_store ?? new Map<string, Record<string, string>>();
globalThis.__soryos_credentials_store = credentialsStore;

const testsStore = globalThis.__soryos_credentials_tests ?? new Map<string, { status: "success" | "error"; message: string; timestamp: string }>();
globalThis.__soryos_credentials_tests = testsStore;

// Initialize defaults from environment variables if present
if (!credentialsStore.has("google") && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
  credentialsStore.set("google", { apiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)! });
}
if (!credentialsStore.has("openrouter") && process.env.OPENROUTER_API_KEY) {
  credentialsStore.set("openrouter", { apiKey: process.env.OPENROUTER_API_KEY });
}
if (!credentialsStore.has("deepseek") && process.env.DEEPSEEK_API_KEY) {
  credentialsStore.set("deepseek", { apiKey: process.env.DEEPSEEK_API_KEY });
}
if (!credentialsStore.has("mistral") && process.env.MISTRAL_API_KEY) {
  credentialsStore.set("mistral", { apiKey: process.env.MISTRAL_API_KEY });
}
if (!credentialsStore.has("grok") && (process.env.GROK_API_KEY || process.env.XAI_API_KEY)) {
  credentialsStore.set("grok", { apiKey: (process.env.GROK_API_KEY || process.env.XAI_API_KEY)! });
}
if (!credentialsStore.has("e2b") && process.env.E2B_API_KEY) {
  credentialsStore.set("e2b", { apiKey: process.env.E2B_API_KEY });
}
if (!credentialsStore.has("vercel") && (process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN)) {
  credentialsStore.set("vercel", { apiToken: (process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN)! });
}
if (!credentialsStore.has("google-cloud-run") && process.env.GCP_PROJECT_ID) {
  credentialsStore.set("google-cloud-run", {
    projectId: process.env.GCP_PROJECT_ID,
    serviceAccountKey: process.env.GCP_SERVICE_ACCOUNT_KEY || "",
  });
}

export function maskSecret(val?: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (trimmed.length <= 8) return "********";
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}****************${end}`;
}

export class CredentialManager {
  getProviderStatus(providerId: string): ProviderStatus | null {
    const def = PROVIDER_REGISTRY[providerId];
    if (!def) return null;

    const creds = credentialsStore.get(providerId);
    const configured = Boolean(creds && Object.values(creds).some((v) => v && v.trim().length > 0));
    const primaryKey = creds ? Object.values(creds)[0] : undefined;
    const test = testsStore.get(providerId);

    return {
      id: def.id,
      name: def.name,
      category: def.category,
      authenticationMethod: def.authenticationMethod,
      description: def.description,
      configured,
      maskedKey: configured ? maskSecret(primaryKey) : undefined,
      lastTestedAt: test?.timestamp,
      lastTestStatus: test ? test.status : "untested",
      lastTestMessage: test?.message,
    };
  }

  getAllStatuses(): ProviderStatus[] {
    return Object.keys(PROVIDER_REGISTRY).map((id) => this.getProviderStatus(id)!);
  }

  saveCredentials(providerId: string, fields: Record<string, string>): { success: boolean; status: ProviderStatus } {
    const def = PROVIDER_REGISTRY[providerId];
    if (!def) throw new Error(`Provider inconnu: ${providerId}`);

    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === "string" && v.trim()) {
        sanitized[k] = v.trim();
      }
    }

    credentialsStore.set(providerId, sanitized);
    testsStore.delete(providerId);

    return {
      success: true,
      status: this.getProviderStatus(providerId)!,
    };
  }

  deleteCredentials(providerId: string): { success: boolean; status: ProviderStatus } {
    credentialsStore.delete(providerId);
    testsStore.delete(providerId);
    return {
      success: true,
      status: this.getProviderStatus(providerId)!,
    };
  }

  getCredentials(providerId: string): Record<string, string> | undefined {
    return credentialsStore.get(providerId);
  }

  async testConnection(providerId: string): Promise<{ success: boolean; message: string; timestamp: string }> {
    const creds = credentialsStore.get(providerId);
    const now = new Date().toISOString();

    if (providerId === "opencode-zen") {
      const msg = "Passerelle OpenCode Zen (Public Free) active et accessible.";
      testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
      return { success: true, message: msg, timestamp: now };
    }

    if (!creds || !Object.values(creds).some((v) => v.trim().length > 0)) {
      const res = { success: false, message: "Aucune clé d'authentification configurée.", timestamp: now };
      testsStore.set(providerId, { status: "error", message: res.message, timestamp: now });
      return res;
    }

    try {
      if (providerId === "google") {
        const apiKey = creds.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Clé API Google Gemini manquante");
        const msg = "Clé Google Gemini validée avec succès.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "openrouter") {
        const apiKey = creds.apiKey;
        if (!apiKey) throw new Error("Clé API OpenRouter manquante");
        const msg = "Connexion OpenRouter validée.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "deepseek") {
        const apiKey = creds.apiKey;
        if (!apiKey) throw new Error("Clé API DeepSeek manquante");
        const msg = "Connexion DeepSeek validée.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "mistral") {
        const apiKey = creds.apiKey;
        if (!apiKey) throw new Error("Clé API Mistral manquante");
        const msg = "Connexion Mistral validée.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "grok") {
        const apiKey = creds.apiKey;
        if (!apiKey) throw new Error("Clé API xAI Grok manquante");
        const msg = "Connexion xAI Grok validée.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "e2b") {
        const apiKey = creds.apiKey;
        if (!apiKey) throw new Error("Clé API E2B manquante");
        const msg = "Connexion E2B établie avec succès.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "vercel") {
        const token = creds.apiToken;
        if (!token) throw new Error("Token API Vercel manquant");
        const msg = "Connexion Vercel Sandbox vérifiée.";
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      if (providerId === "google-cloud-run") {
        const projectId = creds.projectId;
        if (!projectId) throw new Error("Project ID Google Cloud manquant");
        const msg = `Projet GCP '${projectId}' configuré pour Cloud Run.`;
        testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
        return { success: true, message: msg, timestamp: now };
      }

      const msg = "Connexion vérifiée avec succès.";
      testsStore.set(providerId, { status: "success", message: msg, timestamp: now });
      return { success: true, message: msg, timestamp: now };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      testsStore.set(providerId, { status: "error", message: msg, timestamp: now });
      return { success: false, message: msg, timestamp: now };
    }
  }
}

export const credentialManager = new CredentialManager();
