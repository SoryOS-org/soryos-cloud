import { credentialManager } from "../../credentials/manager";
import {
  fetchOpenAICompatibleChat,
  streamOpenAICompatibleChat,
  redactSecretText,
  parseResponseError,
} from "../helpers";
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

export abstract class BaseOpenAICompatibleProvider implements AIProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly category = "ai" as const;

  abstract getEndpoint(): string;
  abstract getDefaultModel(): string;
  abstract listModels(): ModelInfo[];

  protected getAuthHeaderPrefix(): string {
    return "Bearer";
  }

  protected getExtraHeaders(): Record<string, string> {
    return {};
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
      diagnostics.errorMessage = `Aucune clé d'authentification configurée pour ${this.name}.`;
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

      const res = await fetchOpenAICompatibleChat({
        endpoint,
        apiKey: cred.apiKey,
        authHeaderPrefix: this.getAuthHeaderPrefix(),
        model,
        messages: [{ role: "user", content: "Ping connection test" }],
        extraHeaders: this.getExtraHeaders(),
      });

      const latencyMs = Date.now() - startTime;
      diagnostics.latencyMs = latencyMs;
      diagnostics.authStatus = "passed";
      diagnostics.apiStatus = "passed";
      diagnostics.httpStatus = 200;
      diagnostics.finalResult = "connected";

      const msg = `Connecté avec succès à ${this.name} (${model}) en ${latencyMs}ms.`;
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

      let httpStatus = (err as { statusCode?: number })?.statusCode || 500;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = redactSecretText(rawMsg, [cred.apiKey]);

      let finalResult: ProviderDiagnosticsResult["finalResult"] = "runtime_error";

      if (httpStatus === 401 || safeMsg.includes("401") || safeMsg.toLowerCase().includes("unauthorized") || safeMsg.toLowerCase().includes("invalid api key")) {
        httpStatus = 401;
        diagnostics.authStatus = "failed";
        finalResult = "auth_failed";
      } else if (httpStatus === 403 || safeMsg.includes("403") || safeMsg.toLowerCase().includes("forbidden")) {
        httpStatus = 403;
        diagnostics.authStatus = "failed";
        finalResult = "auth_failed";
      } else if (httpStatus === 404 || safeMsg.includes("404") || safeMsg.toLowerCase().includes("not found")) {
        httpStatus = 404;
        diagnostics.authStatus = "passed";
        diagnostics.apiStatus = "failed";
        finalResult = "invalid_model";
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
    const startTime = Date.now();

    const testConn = await this.testConnection(options);
    if (!testConn.success || !cred.apiKey) {
      return {
        success: false,
        prompt,
        response: "",
        model,
        latencyMs: testConn.latencyMs,
        httpStatus: testConn.httpStatus,
        error: testConn.message,
        diagnostics: testConn.diagnostics,
      };
    }

    try {
      const res = await fetchOpenAICompatibleChat({
        endpoint: this.getEndpoint(),
        apiKey: cred.apiKey,
        authHeaderPrefix: this.getAuthHeaderPrefix(),
        model,
        messages: [{ role: "user", content: prompt }],
        extraHeaders: this.getExtraHeaders(),
      });

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        prompt,
        response: res.text.trim(),
        model,
        latencyMs,
        httpStatus: 200,
        diagnostics: testConn.diagnostics,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = redactSecretText(rawMsg, [cred.apiKey]);

      return {
        success: false,
        prompt,
        response: "",
        model,
        latencyMs,
        error: safeMsg,
        diagnostics: testConn.diagnostics,
      };
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const cred = this.resolveCredentials(options.sessionId);
    if (!cred.isConfigured || !cred.apiKey) {
      throw new Error(`${this.name} non configuré : aucune clé API trouvée (${cred.sourceLabel})`);
    }

    const model = options.modelId || this.getDefaultModel();
    const startTime = Date.now();

    const res = await fetchOpenAICompatibleChat({
      endpoint: this.getEndpoint(),
      apiKey: cred.apiKey,
      authHeaderPrefix: this.getAuthHeaderPrefix(),
      model,
      messages: options.messages,
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      extraHeaders: this.getExtraHeaders(),
    });

    const latencyMs = Date.now() - startTime;
    return {
      text: res.text,
      model,
      providerId: this.id,
      providerName: this.name,
      latencyMs,
      usage: res.usage,
    };
  }

  async *stream(options: StreamOptions): AsyncIterable<StreamChunk> {
    const cred = this.resolveCredentials(options.sessionId);
    if (!cred.isConfigured || !cred.apiKey) {
      throw new Error(`${this.name} non configuré : aucune clé API trouvée (${cred.sourceLabel})`);
    }

    const model = options.modelId || this.getDefaultModel();
    yield* streamOpenAICompatibleChat({
      endpoint: this.getEndpoint(),
      apiKey: cred.apiKey,
      authHeaderPrefix: this.getAuthHeaderPrefix(),
      model,
      messages: options.messages,
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      extraHeaders: this.getExtraHeaders(),
      signal: options.signal,
    });
  }
}
