// Shared input-validation helper for edge functions.
// Uses zod via npm: specifier — resolves without an import map.
// Goal: stop accepting unbounded user input and never leak raw DB errors.
import { z, ZodSchema } from "npm:zod@3.23.8";

export { z };

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: { error: string; fields?: unknown } };

/**
 * Parse JSON body against a zod schema. Caps body size at 64 KiB by default
 * to bound payload abuse without infra rate-limiting.
 */
export async function parseJson<T>(
  req: Request,
  schema: ZodSchema<T>,
  opts: { maxBytes?: number } = {},
): Promise<ParseResult<T>> {
  const max = opts.maxBytes ?? 64 * 1024;
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, body: { error: "unsupported_media_type" } };
  }
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len && len > max) {
    return { ok: false, status: 413, body: { error: "payload_too_large" } };
  }
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > max) {
      return { ok: false, status: 413, body: { error: "payload_too_large" } };
    }
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 400, body: { error: "invalid_json" } };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_input", fields: parsed.error.flatten().fieldErrors },
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Validate URL search params against a zod schema.
 */
export function parseQuery<T>(req: Request, schema: ZodSchema<T>): ParseResult<T> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_query", fields: parsed.error.flatten().fieldErrors },
    };
  }
  return { ok: true, data: parsed.data };
}
