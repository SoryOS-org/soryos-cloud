import { GoogleGenAI } from "@google/genai";
import { credentialManager } from "../../credentials/manager";
import { redactSecretText } from "../helpers";
import type {
  AIProvider,
  GenerateOptions,
  GenerateResult,
  ProviderAITestResult,
  ProviderConnectionTestResult,
  ProviderDiagnosticsResult,
  ResolvedCredential,
  StreamChunk,
  StreamOptions,
} from "../types";
import type { ModelInfo } from "../../providers";

export class GeminiProvider implements AIProvider {
  readonly id = "google";
  readonly name = "Google Gemini";
  readonly category = "ai" as const;

  getEndpoint(): string {
    return "https://generativelanguage.googleapis.com";
  }

  getDefaultModel(): string {
    return "gemini-3.8-flash";
  }

  listModels(): ModelInfo[] {
    return [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Recommandé",
        description: "Modèle de pointe ultra-rapide pour génération de code, raisonnement et agents complets.",
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: false,
        badge: "Frontier",
        description: "Raisonnement approfondi et architecture complexe pour tâches de programmation avancées.",
      },
      {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        providerId: "google",
        providerName: "Google Gemini",
        isFree: true,
        badge: "Ultra Rapide",
        description: "Latence minimale et efficacité optimale pour modifications rapides de code.",
      },
    ];
  }

  resolveCredentials(sessionId?: string): ResolvedCredential {
    return credentialManager.resolveCredentials(this.id, sessionId);
  }

  async testConnection(options?: {
    sessionId?: string;
    modelId?: string;
  }): Promise<ProviderConnectionTestResult> {
    const cred = this.resolveCredentials(options?.sessionId);
    const model = options?.modelId || this.getDefaultModel();
    const endpoint = this.getEndpoint();

    const diagnostics: ProviderDiagnosticsResult = {
      providerId: this.id,
      providerName: this.name,
      credentialStatus: cred.isConfigured ? "found" : "missing",
      credentialSource: cred.source,
      credentialSourceLabel: cred.sourceLabel,
      keyLength: cred.keyLength,
      keyFingerprint: cred.fingerprint,
      runtimeStatus: "initialized",
      endpoint,
      model,
      networkStatus: "pending",
      authStatus: "pending",
      apiStatus: "pending",
      finalResult: cred.isConfigured ? "connected" : "not_configured",
    };

    if (!cred.isConfigured || !cred.apiKey) {
      diagnostics.errorMessage = "Aucune clé API configurée pour Google Gemini.";
      diagnostics.finalResult = "not_configured";
      credentialManager.recordTestResult(this.id, "error", diagnostics.errorMessage);
      return {
        success: false,
        status: "error",
        message: diagnostics.errorMessage,
        latencyMs: 0,
        diagnostics,
      };
    }

    const startTime = Date.now();
    try {
      diagnostics.networkStatus = "passed";

      const ai = new GoogleGenAI({
        apiKey: cred.apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Real network call to test auth and model validity
      const res = await ai.models.generateContent({
        model,
        contents: "Ping connection test",
      });

      const latencyMs = Date.now() - startTime;
      diagnostics.latencyMs = latencyMs;
      diagnostics.authStatus = "passed";
      diagnostics.apiStatus = "passed";
      diagnostics.httpStatus = 200;
      diagnostics.finalResult = "connected";

      const msg = `Connecté avec succès à Google Gemini (${model}) en ${latencyMs}ms.`;
      credentialManager.recordTestResult(this.id, "success", msg, {
        httpStatus: 200,
        latencyMs,
      });

      return {
        success: true,
        status: "connected",
        httpStatus: 200,
        message: msg,
        latencyMs,
        diagnostics,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      diagnostics.latencyMs = latencyMs;

      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = redactSecretText(rawMsg, [cred.apiKey]);

      let httpStatus = 500;
      let finalResult: ProviderDiagnosticsResult["finalResult"] = "runtime_error";

      if (safeMsg.includes("401") || safeMsg.includes("API_KEY_INVALID") || safeMsg.includes("API key not valid")) {
        httpStatus = 401;
        diagnostics.authStatus = "failed";
        finalResult = "auth_failed";
      } else if (safeMsg.includes("404") || safeMsg.includes("not found") || safeMsg.includes("no longer available")) {
        httpStatus = 404;
        diagnostics.authStatus = "passed";
        diagnostics.apiStatus = "failed";
        finalResult = "invalid_model";
      } else if (safeMsg.includes("403") || safeMsg.includes("PERMISSION_DENIED")) {
        httpStatus = 403;
        diagnostics.authStatus = "failed";
        finalResult = "auth_failed";
      } else if (safeMsg.includes("503") || safeMsg.includes("high demand") || safeMsg.includes("UNAVAILABLE")) {
        httpStatus = 503;
        diagnostics.authStatus = "passed";
        diagnostics.apiStatus = "passed";
        finalResult = "runtime_error";

        // Auto-retry with gemini-3.1-flash-lite if 3.8-flash is temporarily unavailable due to Google demand
        if (model !== "gemini-3.1-flash-lite") {
          try {
            const fallbackAi = new GoogleGenAI({
              apiKey: cred.apiKey,
              httpOptions: { headers: { "User-Agent": "aistudio-build" } },
            });
            await fallbackAi.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: "Ping connection test",
            });
            const fallbackLatency = Date.now() - startTime;
            diagnostics.httpStatus = 200;
            diagnostics.latencyMs = fallbackLatency;
            diagnostics.finalResult = "connected";
            diagnostics.model = "gemini-3.1-flash-lite (demand fallback)";
            const msg = `Connecté avec succès à Google Gemini (gemini-3.1-flash-lite) en ${fallbackLatency}ms.`;
            credentialManager.recordTestResult(this.id, "success", msg, {
              httpStatus: 200,
              latencyMs: fallbackLatency,
            });
            return {
              success: true,
              status: "connected",
              httpStatus: 200,
              message: msg,
              latencyMs: fallbackLatency,
              diagnostics,
            };
          } catch {
            // Keep original 503 error
          }
        }
      } else if (safeMsg.includes("429") || safeMsg.includes("RESOURCE_EXHAUSTED")) {
        httpStatus = 429;
        diagnostics.authStatus = "passed";
        finalResult = "runtime_error";
      } else if (safeMsg.includes("ENOTFOUND") || safeMsg.includes("fetch failed") || safeMsg.includes("ECONNREFUSED")) {
        httpStatus = 0;
        diagnostics.networkStatus = "failed";
        finalResult = "network_error";
      }

      diagnostics.httpStatus = httpStatus;
      diagnostics.finalResult = finalResult;
      diagnostics.errorMessage = safeMsg;
      diagnostics.rawErrorDetails = {
        statusCode: httpStatus,
        message: safeMsg,
        endpoint,
      };

      const failMsg = `Échec de connexion (${httpStatus || "Réseau"}): ${safeMsg.slice(0, 150)}`;
      credentialManager.recordTestResult(this.id, "error", failMsg, {
        httpStatus,
        latencyMs,
      });

      return {
        success: false,
        status: "error",
        httpStatus,
        message: failMsg,
        latencyMs,
        diagnostics,
      };
    }
  }

  async testAI(options?: {
    sessionId?: string;
    modelId?: string;
    prompt?: string;
  }): Promise<ProviderAITestResult> {
    const cred = this.resolveCredentials(options?.sessionId);
    const model = options?.modelId || this.getDefaultModel();
    const prompt = options?.prompt || "Réponds uniquement : OK";
    const endpoint = this.getEndpoint();
    const startTime = Date.now();

    const diagnostics: ProviderDiagnosticsResult = {
      providerId: this.id,
      providerName: this.name,
      credentialStatus: cred.isConfigured ? "found" : "missing",
      credentialSource: cred.source,
      credentialSourceLabel: cred.sourceLabel,
      keyLength: cred.keyLength,
      keyFingerprint: cred.fingerprint,
      runtimeStatus: "initialized",
      endpoint,
      model,
      networkStatus: "pending",
      authStatus: "pending",
      apiStatus: "pending",
      finalResult: cred.isConfigured ? "connected" : "not_configured",
    };

    if (!cred.isConfigured || !cred.apiKey) {
      diagnostics.errorMessage = "Clé API manquante pour le test IA.";
      diagnostics.finalResult = "not_configured";
      return {
        success: false,
        prompt,
        response: "",
        model,
        latencyMs: 0,
        error: diagnostics.errorMessage,
        diagnostics,
      };
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: cred.apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let res;
      let usedModel = model;
      try {
        res = await ai.models.generateContent({
          model,
          contents: prompt,
        });
      } catch (err: unknown) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        if ((rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) && model !== "gemini-3.1-flash-lite") {
          usedModel = "gemini-3.1-flash-lite";
          res = await ai.models.generateContent({
            model: usedModel,
            contents: prompt,
          });
        } else {
          throw err;
        }
      }

      const latencyMs = Date.now() - startTime;
      const text = res.text?.trim() || "";

      diagnostics.networkStatus = "passed";
      diagnostics.authStatus = "passed";
      diagnostics.apiStatus = "passed";
      diagnostics.httpStatus = 200;
      diagnostics.latencyMs = latencyMs;
      diagnostics.finalResult = "connected";

      return {
        success: true,
        prompt,
        response: text,
        model: usedModel,
        latencyMs,
        httpStatus: 200,
        diagnostics,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = redactSecretText(rawMsg, [cred.apiKey]);

      diagnostics.networkStatus = "failed";
      diagnostics.apiStatus = "failed";
      diagnostics.latencyMs = latencyMs;
      diagnostics.finalResult = "runtime_error";
      diagnostics.errorMessage = safeMsg;

      return {
        success: false,
        prompt,
        response: "",
        model,
        latencyMs,
        error: safeMsg,
        diagnostics,
      };
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const cred = this.resolveCredentials(options.sessionId);
    if (!cred.isConfigured || !cred.apiKey) {
      throw new Error(`Google Gemini non configuré : aucune clé API trouvée (${cred.sourceLabel})`);
    }

    const model = options.modelId || this.getDefaultModel();
    const ai = new GoogleGenAI({
      apiKey: cred.apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const conversationHistory = options.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\nHistorique de la conversation :\n${conversationHistory}`
      : conversationHistory;

    const startTime = Date.now();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text || "";

      return {
        text,
        model,
        providerId: this.id,
        providerName: this.name,
        latencyMs,
      };
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if ((rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) && model !== "gemini-3.1-flash-lite") {
        console.warn(`[Gemini] ${model} unavailable (503 demand spike), automatically using gemini-3.1-flash-lite`);
        const fallbackRes = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: fullPrompt,
        });
        const latencyMs = Date.now() - startTime;
        return {
          text: fallbackRes.text || "",
          model: "gemini-3.1-flash-lite",
          providerId: this.id,
          providerName: this.name,
          latencyMs,
        };
      }
      throw err;
    }
  }

  async *stream(options: StreamOptions): AsyncIterable<StreamChunk> {
    const cred = this.resolveCredentials(options.sessionId);
    if (!cred.isConfigured || !cred.apiKey) {
      throw new Error(`Google Gemini non configuré : aucune clé API trouvée (${cred.sourceLabel})`);
    }

    let model = options.modelId || this.getDefaultModel();
    const ai = new GoogleGenAI({
      apiKey: cred.apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const conversationHistory = options.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\nHistorique de la conversation :\n${conversationHistory}`
      : conversationHistory;

    let responseStream;
    try {
      responseStream = await ai.models.generateContentStream({
        model,
        contents: fullPrompt,
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if ((rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) && model !== "gemini-3.1-flash-lite") {
        model = "gemini-3.1-flash-lite";
        responseStream = await ai.models.generateContentStream({
          model,
          contents: fullPrompt,
        });
      } else {
        throw err;
      }
    }

    for await (const chunk of responseStream) {
      if (options.signal?.aborted) {
        break;
      }
      const text = chunk.text;
      if (text) {
        yield { delta: text, isComplete: false };
      }
    }

    yield { delta: "", isComplete: true };
  }
}
