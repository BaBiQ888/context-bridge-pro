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
    console.log('[SSE] decoded value, buffer length:', buffer.length);
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    // Track whether the previous processed line was a data: line.
    // SSE spec: consecutive data: lines within the same event are separated by \n.
    let prevLineWasData = false;

    for (const line of lines) {
      if (line === "") {
        // Blank line = SSE event separator. Reset data-line tracking.
        prevLineWasData = false;
        continue;
      }

      // ── Event name line: "event:chunk" / "event:done" / "event:error" ──
      if (line.startsWith("event:")) {
        prevLineWasData = false;
        const eventName = line.slice(6).trim();
        if (eventName === "done") {
          onDone();
          return;
        }
        continue; // chunk / error are just markers
      }

      // ── Data line: "data:<content>" ──
      if (line.startsWith("data:")) {
        const raw = line.slice(5); // "data:" = 5 chars

        // SSE spec: consecutive data: lines in the same event are joined with \n.
        // Emit \n BEFORE this data value if a previous data line already ran.
        if (prevLineWasData) {
          onChunk("\n");
        }
        prevLineWasData = true;

        if (raw === "") {
          // Empty data line → contributes just a \n (already emitted above).
          // Nothing more to emit for this line.
          continue;
        }

        // Try JSON parse for done/error object payloads: {"direction":"..."} / {"code":"..."}
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            if (parsed.code && parsed.message) {
              onError(parsed.code as string, parsed.message as string);
              return;
            }
            if (parsed.direction) {
              onDone();
              return;
            }
          }
          // Parsed as non-object (e.g. a JSON string) → treat as text chunk
          onChunk(typeof parsed === "string" ? parsed : raw);
        } catch {
          // Not JSON → raw text chunk from LLM stream
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
