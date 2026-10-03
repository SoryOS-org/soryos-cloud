import crypto from "crypto";
import type { ChatMessage, StreamChunk } from "./types";

/**
 * Computes a secure non-reversible SHA-256 fingerprint for a credential string.
 * Example output: "sha256:8f4c2e...b3a1"
 */
export function computeFingerprint(secret?: string): string {
  if (!secret || secret.trim().length === 0) return "none";
  const trimmed = secret.trim();
  const hash = crypto.createHash("sha256").update(trimmed).digest("hex");
  return `sha256:${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

/**
 * Masks a secret string showing only the first few and last few characters.
 */
export function maskSecret(val?: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (trimmed.length <= 8) return "••••••••";
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}••••••••${end}`;
}

/**
 * Redacts known secret headers for safe logging and diagnostics.
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (
      lk.includes("auth") ||
      lk.includes("key") ||
      lk.includes("token") ||
      lk.includes("secret") ||
      lk.includes("password")
    ) {
      safe[k] = "[REDACTED]";
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

/**
 * Sanitizes any string to remove accidentally embedded API keys or tokens.
 */
export function redactSecretText(text: string, secretsToRedact: string[] = []): string {
  let result = text;
  for (const sec of secretsToRedact) {
    if (sec && sec.length > 5) {
      result = result.split(sec).join("[REDACTED]");
    }
  }
  // Generic patterns for AI keys
  result = result.replace(/AIza[0-9A-Za-z-_]{35}/g, "AIza[REDACTED]");
  result = result.replace(/sk-[0-9A-Za-z-_]{20,}/g, "sk-[REDACTED]");
  result = result.replace(/xai-[0-9A-Za-z-_]{20,}/g, "xai-[REDACTED]");
  return result;
}

export interface ParsedApiError {
  statusCode: number;
  errorType: string;
  message: string;
  endpoint: string;
}

/**
 * Parses structured JSON errors from OpenAI / Mistral / OpenRouter / DeepSeek endpoints.
 */
export async function parseResponseError(
  res: Response,
  endpoint: string,
  apiKeyToRedact?: string,
): Promise<ParsedApiError> {
  let rawBody = "";
  try {
    rawBody = await res.text();
  } catch {
    rawBody = "(empty response)";
  }

  let errorType = `HTTP_${res.status}`;
  let message = `Request to ${endpoint} failed with HTTP status ${res.status}`;

  try {
    const json = JSON.parse(rawBody);
    if (json.error) {
      if (typeof json.error === "string") {
        message = json.error;
      } else if (typeof json.error === "object") {
        message = json.error.message || json.error.code || message;
        errorType = json.error.type || json.error.code || errorType;
      }
    } else if (json.message) {
      message = json.message;
    }
  } catch {
    if (rawBody && rawBody.length > 0) {
      message = rawBody.slice(0, 300);
    }
  }

  // Ensure secrets are stripped
  const safeMessage = redactSecretText(message, apiKeyToRedact ? [apiKeyToRedact] : []);

  return {
    statusCode: res.status,
    errorType,
    message: safeMessage,
    endpoint,
  };
}

/**
 * Standard OpenAI-compatible HTTP Chat Completion POST.
 */
export async function fetchOpenAICompatibleChat(options: {
  endpoint: string;
  apiKey?: string;
  authHeaderPrefix?: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  extraHeaders?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<{
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  rawResponse: Response;
}> {
  const {
    endpoint,
    apiKey,
    authHeaderPrefix = "Bearer",
    model,
    messages,
    systemPrompt,
    temperature = 0.7,
    extraHeaders = {},
    signal,
  } = options;

  const authHeader = apiKey ? `${authHeaderPrefix} ${apiKey}` : "Bearer public";

  const allMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt && systemPrompt.trim()) {
    allMessages.push({ role: "system", content: systemPrompt.trim() });
  }
  for (const m of messages) {
    allMessages.push({ role: m.role, content: m.content });
  }

  const effectiveSignal = signal || AbortSignal.timeout(12000);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      temperature,
    }),
    signal: effectiveSignal,
  });

  if (!res.ok) {
    const parsed = await parseResponseError(res, endpoint, apiKey);
    const err = new Error(
      `[${model}] ${parsed.message} (HTTP ${parsed.statusCode})`,
    );
    (err as unknown as { statusCode: number }).statusCode = parsed.statusCode;
    (err as unknown as { parsedError: ParsedApiError }).parsedError = parsed;
    throw err;
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content !== "string") {
    throw new Error(`Invalid response format from ${endpoint}: missing choices[0].message.content`);
  }

  return {
    text: content,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
    rawResponse: res,
  };
}

/**
 * Standard OpenAI-compatible Server-Sent-Events (SSE) Streaming Chat Completion.
 */
export async function* streamOpenAICompatibleChat(options: {
  endpoint: string;
  apiKey?: string;
  authHeaderPrefix?: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  extraHeaders?: Record<string, string>;
  signal?: AbortSignal;
}): AsyncIterable<StreamChunk> {
  const {
    endpoint,
    apiKey,
    authHeaderPrefix = "Bearer",
    model,
    messages,
    systemPrompt,
    temperature = 0.7,
    extraHeaders = {},
    signal,
  } = options;

  const authHeader = apiKey ? `${authHeaderPrefix} ${apiKey}` : "Bearer public";

  const allMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt && systemPrompt.trim()) {
    allMessages.push({ role: "system", content: systemPrompt.trim() });
  }
  for (const m of messages) {
    allMessages.push({ role: m.role, content: m.content });
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const parsed = await parseResponseError(res, endpoint, apiKey);
    const err = new Error(
      `[${model}] ${parsed.message} (HTTP ${parsed.statusCode})`,
    );
    (err as unknown as { statusCode: number }).statusCode = parsed.statusCode;
    (err as unknown as { parsedError: ParsedApiError }).parsedError = parsed;
    throw err;
  }

  if (!res.body) {
    throw new Error(`No response stream body returned from ${endpoint}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        if (trimmed === "data: [DONE]") {
          yield { delta: "", isComplete: true };
          return;
        }

        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              yield { delta, isComplete: false };
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { delta: "", isComplete: true };
}
