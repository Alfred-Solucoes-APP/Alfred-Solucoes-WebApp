import type { FunctionsError } from "@supabase/supabase-js";

export class RateLimitError extends Error {
  retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
      ? Math.max(0, Math.round(retryAfterSeconds))
      : undefined;
  }
}

type FunctionsErrorLike = Pick<FunctionsError, "status" | "message" | "name"> & {
  response?: Response;
  details?: unknown;
};

const DEFAULT_RATE_LIMIT_MESSAGE = "Detectamos muitas requisições em sequência.";

function extractRetryAfterFromObject(source: unknown): number | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const candidate = (source as Record<string, unknown>).retryAfterSeconds;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  return undefined;
}

function extractRetryAfterFromString(value: string): number | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return extractRetryAfterFromObject(parsed);
  } catch {
    return undefined;
  }
}

function extractRetryAfterHeader(response?: Response): number | undefined {
  if (!response) {
    return undefined;
  }
  const header = response.headers.get("Retry-After");
  if (!header) {
    return undefined;
  }

  const numeric = Number.parseInt(header, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function formatDurationPtBr(seconds?: number): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const rounded = Math.max(1, Math.round(seconds));

  if (rounded < 60) {
    return `${rounded} segundo${rounded === 1 ? "" : "s"}`;
  }

  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  const parts: string[] = [];

  if (minutes > 0) {
    parts.push(`${minutes} minuto${minutes === 1 ? "" : "s"}`);
  }

  if (remainingSeconds > 0) {
    parts.push(`${remainingSeconds} segundo${remainingSeconds === 1 ? "" : "s"}`);
  }

  return parts.join(" e ");
}

export async function toRateLimitError(error: FunctionsErrorLike | null): Promise<RateLimitError | null> {
  if (!error || typeof error.status !== "number" || error.status !== 429) {
    return null;
  }

  let message = (error.message ?? DEFAULT_RATE_LIMIT_MESSAGE).trim();
  if (message === "") {
    message = DEFAULT_RATE_LIMIT_MESSAGE;
  }

  let retryAfterSeconds = extractRetryAfterHeader(error.response);

  if (error.response) {
    try {
      const cloned = error.response.clone();
      const payload = (await cloned.json()) as unknown;
      if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        const payloadMessage = record.error;
        if (typeof payloadMessage === "string" && payloadMessage.trim() !== "") {
          message = payloadMessage.trim();
        }
        retryAfterSeconds = retryAfterSeconds ?? extractRetryAfterFromObject(payload);
      }
    } catch {
      // ignore JSON parse issues
    }
  }

  if (retryAfterSeconds === undefined) {
    if (typeof error.details === "string") {
      retryAfterSeconds = extractRetryAfterFromString(error.details);
    } else {
      retryAfterSeconds = extractRetryAfterFromObject(error.details);
    }
  }

  return new RateLimitError(message, retryAfterSeconds);
}

export function formatRateLimitError(error: RateLimitError, baseMessage = DEFAULT_RATE_LIMIT_MESSAGE): string {
  const waitTime = formatDurationPtBr(error.retryAfterSeconds);
  const prefix = error.message && error.message !== DEFAULT_RATE_LIMIT_MESSAGE
    ? error.message
    : baseMessage;

  if (!waitTime) {
    return `${prefix} Tente novamente em instantes.`;
  }

  return `${prefix} Tente novamente em ${waitTime}.`;
}
