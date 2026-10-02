import type { AgentEvent, GetSessionResponse } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "";

export async function createSession(
  title?: string,
  message?: string,
): Promise<{ id: string; title: string }> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}

export async function listSessions(): Promise<
  Array<{ id: string; title: string; created_at: string }>
> {
  const res = await fetch(`${API_BASE}/api/sessions`);
  if (!res.ok) return [];
  const data = (await res.json()) as { sessions: Array<{ id: string; title: string; created_at: string }> };
  return data.sessions ?? [];
}

export async function getSession(id: string): Promise<GetSessionResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
  return res.json();
}

export async function abortSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/sessions/${id}/abort`, { method: "POST" });
}

export async function listSessionFiles(sessionId: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/files`);
  if (!res.ok) return [];
  const data = (await res.json()) as { paths: string[] };
  return data.paths ?? [];
}

export async function fetchFile(
  sessionId: string,
  path: string,
): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/files/${encodeURIComponent(path)}`,
  );
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
  return res.text();
}

export async function ensurePreview(
  sessionId: string,
): Promise<{ preview_url: string | null; status: string; output?: string | null }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/preview`);
  if (!res.ok) throw new Error(`Failed to load preview: ${res.statusText}`);
  return res.json();
}

export async function runTerminal(
  sessionId: string,
  command: string,
): Promise<{ output: string; isError: boolean; cwd: string }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/terminal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`Terminal error: ${res.statusText}`);
  return res.json();
}

function parseSseChunk(raw: string): AgentEvent | null {
  const normalized = raw.replace(/\r/g, "");
  for (const line of normalized.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return null;
    try {
      return JSON.parse(payload) as AgentEvent;
    } catch {
      return null;
    }
  }
  return null;
}

async function consumeSse(
  url: string,
  init: RequestInit,
  onEvent: (event: AgentEvent) => void,
): Promise<"streamed" | "already_running"> {
  const res = await fetch(url, init);
  if (res.status === 409) return "already_running";
  if (!res.ok) throw new Error(`Agent error: ${res.statusText}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseSseChunk(part);
      if (event) onEvent(event);
    }
  }

  const tail = parseSseChunk(buffer);
  if (tail) onEvent(tail);
  return "streamed";
}

/** Resume agent on the last saved user message (no duplicate insert). */
export async function streamRun(
  sessionId: string,
  onEvent: (event: AgentEvent) => void,
): Promise<"streamed" | "already_running"> {
  return consumeSse(
    `${API_BASE}/api/sessions/${sessionId}/run`,
    { method: "POST" },
    onEvent,
  );
}

/** New user turn: persist message then stream agent. */
export async function sendMessage(
  sessionId: string,
  content: string,
  onEvent: (event: AgentEvent) => void,
): Promise<"streamed" | "already_running"> {
  return consumeSse(
    `${API_BASE}/api/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
    onEvent,
  );
}
