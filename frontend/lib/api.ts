const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export type Direction = "pm2rd" | "rd2pm";

export interface TranslateResponse {
  status: "success" | "error";
  data?: {
    original: string;
    translated: string;
    meta: { model: string; tokens: number; direction: Direction };
  };
  error?: { code: string; message: string };
}

/**
 * translateSync — standard (non-streaming) translate request.
 */
export async function translateSync(
  content: string,
  direction: Direction
): Promise<TranslateResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, direction, stream: false }),
  });

  const json: TranslateResponse = await res.json();

  if (!res.ok) {
    throw new ApiError(
      json.error?.code ?? "unknown_error",
      json.error?.message ?? `HTTP ${res.status}`
    );
  }

  return json;
}

/**
 * translateStream — SSE streaming translate request.
 * Calls onChunk for each text delta, onDone when complete.
 */
export async function translateStream(
  content: string,
  direction: Direction,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (code: string, message: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, direction, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({})) as TranslateResponse;
    throw new ApiError(
      json.error?.code ?? "network_error",
      json.error?.message ?? `HTTP ${res.status}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: chunk")) continue;
      if (line.startsWith("event: done")) {
        onDone();
        return;
      }
      if (line.startsWith("event: error")) continue;

      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (!raw) continue;

        // Error event payload is JSON
        try {
          const parsed = JSON.parse(raw) as { code?: string; message?: string; direction?: string };
          if (parsed.code && parsed.message) {
            onError(parsed.code, parsed.message);
            return;
          }
          if (parsed.direction) {
            onDone();
            return;
          }
        } catch {
          // Plain text chunk
          onChunk(raw);
        }
      }
    }
  }

  onDone();
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
