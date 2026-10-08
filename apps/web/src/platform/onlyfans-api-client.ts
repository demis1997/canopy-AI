import { z } from "zod";

const id = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative().refine(Number.isSafeInteger)])
  .transform(String);
export const mediaSchema = z
  .object({
    id,
    type: z.enum(["photo", "gif", "video", "audio"]),
    isReady: z.boolean().optional(),
    hasError: z.boolean().optional(),
    canView: z.boolean().optional(),
    duration: z.number().nonnegative().optional(),
  })
  .passthrough();
export const messageSchema = z
  .object({
    id,
    text: z.string().default(""),
    fromUser: z.object({ id }),
    createdAt: z.string().datetime({ offset: true }),
    isSentByMe: z.boolean().optional(),
    price: z.coerce.number().nonnegative().default(0),
    isOpened: z.boolean().optional(),
    isTip: z.boolean().optional(),
    media: z.array(mediaSchema).default([]),
    previews: z.array(z.union([id, z.object({ id })])).default([]),
  })
  .passthrough();
export const postSchema = z
  .object({
    id,
    author: z.object({ id }),
    text: z.string().default(""),
    price: z.coerce.number().nonnegative().default(0),
    media: z.array(mediaSchema).default([]),
    previews: z.array(z.union([id, z.object({ id })])).default([]),
  })
  .passthrough();
export const chatSchema = z
  .object({
    id: id.optional(),
    withUser: z
      .object({ id, name: z.string().optional(), username: z.string().optional() })
      .optional(),
    fan: z.object({ id, name: z.string().optional(), username: z.string().optional() }).optional(),
  })
  .passthrough();
export type ApiMessage = z.infer<typeof messageSchema>;
export type ApiMedia = z.infer<typeof mediaSchema>;
export type ApiPost = z.infer<typeof postSchema>;

export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

// IDs, not text or left/right bubble layout, determine authorship. Contradictions fail closed.
export function messageDirection(
  message: ApiMessage,
  creatorId: string,
  fanId: string,
): "INBOUND" | "OUTBOUND" {
  const direction =
    message.fromUser.id === creatorId
      ? "OUTBOUND"
      : message.fromUser.id === fanId
        ? "INBOUND"
        : null;
  if (
    !direction ||
    (message.isSentByMe !== undefined && message.isSentByMe !== (direction === "OUTBOUND"))
  ) {
    throw new Error("MESSAGE_AUTHOR_MISMATCH");
  }
  return direction;
}

export class OnlyFansApiError extends Error {
  constructor(readonly status: number) {
    super(`OnlyFansAPI request failed (${status})`);
  }
}

export class OnlyFansApiClient {
  private readonly base = new URL("https://app.onlyfansapi.com");
  constructor(
    readonly accountId: string,
    private readonly key: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {
    if (!/^acct_[A-Za-z0-9_-]+$/.test(accountId) || !key.trim())
      throw new Error("Invalid OnlyFansAPI configuration");
  }

  private url(path: string): URL {
    const url = new URL(path, this.base);
    if (
      url.origin !== this.base.origin ||
      !url.pathname.startsWith(`/api/${this.accountId}/`) ||
      url.username ||
      url.password
    ) {
      throw new Error("UNSAFE_PROVIDER_URL");
    }
    return url;
  }

  async request(
    path: string,
    body?: object,
    idempotencyKey?: string,
  ): Promise<{ data: unknown; _pagination?: { next_page?: string | null } }> {
    const url = this.url(path);
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await this.fetcher(url, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${this.key}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (
        (response.status === 429 ||
          response.status >= 500 ||
          (response.status === 409 && idempotencyKey)) &&
        attempt < 2 &&
        (!body || idempotencyKey)
      ) {
        const retry = Number(response.headers.get("retry-after"));
        await this.wait(
          Math.min(
            30_000,
            Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1000 * 2 ** attempt,
          ),
        );
        continue;
      }
      if (!response.ok) throw new OnlyFansApiError(response.status);
      const parsed = z
        .object({
          data: z.unknown(),
          _pagination: z.object({ next_page: z.string().nullable().optional() }).optional(),
        })
        .parse(await response.json());
      if (!("data" in parsed)) throw new Error("INVALID_PROVIDER_RESPONSE");
      return { data: parsed.data, _pagination: parsed._pagination };
    }
    throw new Error("Provider retries exhausted");
  }

  path(suffix: string) {
    return `/api/${this.accountId}/${suffix}`;
  }
  async me() {
    return z
      .object({
        id,
        name: z.string().optional(),
        username: z.string().optional(),
        isAuth: z.boolean().optional(),
      })
      .parse((await this.request(this.path("me"))).data);
  }

  async *pages(suffix: string): AsyncGenerator<unknown[]> {
    const first = this.url(this.path(suffix));
    let next: URL | null = first;
    const visited = new Set<string>();
    for (let page = 0; next; page++) {
      if (page >= 10_000 || visited.has(next.href) || next.pathname !== first.pathname)
        throw new Error("INVALID_PROVIDER_PAGINATION");
      visited.add(next.href);
      const result = await this.request(next.href);
      const data = result.data;
      const object =
        data && !Array.isArray(data) && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;
      const rows = Array.isArray(data) ? data : object?.list;
      if (!Array.isArray(rows)) throw new Error("INVALID_PROVIDER_PAGE");
      yield rows;
      const explicit = result._pagination?.next_page;
      if (explicit) next = this.url(explicit);
      else if (object?.hasMore === true) {
        if (result._pagination && explicit === null)
          throw new Error("INCOMPLETE_PROVIDER_PAGINATION");
        if (!rows.length) throw new Error("EMPTY_PROVIDER_PAGE_WITH_MORE");
        const nextOffset: URL = new URL(next.href);
        if (object.nextMarker != null)
          nextOffset.searchParams.set("marker", String(object.nextMarker));
        else
          nextOffset.searchParams.set(
            "offset",
            String(Number(nextOffset.searchParams.get("offset") ?? 0) + rows.length),
          );
        next = nextOffset;
      } else next = null;
    }
  }
}
