import { describe, it, expect, vi } from "vitest";
import { OnlyFansApiClient, messageSchema, messageDirection } from "./onlyfans-api-client";
import { ApiOnlyFansAdapter } from "./onlyfans-api-adapter";

const message = (over = {}) => ({
  id: 5,
  fromUser: { id: 1 },
  text: "<p>I'm good</p>",
  createdAt: "2026-10-08T10:00:00Z",
  price: 0,
  ...over,
});
const response = (data: unknown, next?: string | null) =>
  new Response(
    JSON.stringify({ data, ...(next !== undefined ? { _pagination: { next_page: next } } : {}) }),
    { status: 200 },
  );

describe("OnlyFansAPI authorship", () => {
  it("uses the fan identity when the chat ID differs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ list: [{ id: 99, fan: { id: 2, name: "Fan" } }] }))
      .mockResolvedValueOnce(response([message({ fromUser: { id: 2 } })]));
    const adapter = new ApiOnlyFansAdapter(
      new OnlyFansApiClient("acct_test", "test-key", fetcher),
      "1",
    );
    await adapter.listInboxConversations();
    await adapter.openConversation("99");
    expect((await adapter.readFanMetadata()).externalFanId).toBe("2");
    expect((await adapter.readVisibleMessages())[0]?.direction).toBe("INBOUND");
  });
  it("keeps a creator's 'I'm good' outgoing even after a fan asks how are you", () => {
    expect(messageDirection(messageSchema.parse(message()), "1", "2")).toBe("OUTBOUND");
    expect(
      messageDirection(
        messageSchema.parse(message({ fromUser: { id: 2 }, text: "how are you?" })),
        "1",
        "2",
      ),
    ).toBe("INBOUND");
  });
  it("rejects absent, unknown or contradictory sender identity", () => {
    expect(() => messageSchema.parse(message({ fromUser: undefined }))).toThrow();
    expect(() =>
      messageDirection(messageSchema.parse(message({ fromUser: { id: 3 } })), "1", "2"),
    ).toThrow("MESSAGE_AUTHOR_MISMATCH");
    expect(() =>
      messageDirection(messageSchema.parse(message({ isSentByMe: false })), "1", "2"),
    ).toThrow("MESSAGE_AUTHOR_MISMATCH");
  });
});

describe("OnlyFansAPI pagination and retries", () => {
  it("follows a short page's next_page and does not stop based on page size", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          [message()],
          "https://app.onlyfansapi.com/api/acct_test/chats/2/messages?first_id=5",
        ),
      )
      .mockResolvedValueOnce(response([], null));
    const client = new OnlyFansApiClient("acct_test", "test-key", fetcher);
    const pages = [];
    for await (const page of client.pages("chats/2/messages?limit=100")) pages.push(page);
    expect(pages).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("never sends credentials to a foreign origin or another account via pagination", async () => {
    for (const next of [
      "https://evil.example/api/acct_test/chats",
      "https://app.onlyfansapi.com/api/acct_other/chats",
    ]) {
      const fetcher = vi.fn().mockResolvedValueOnce(response([], next));
      const client = new OnlyFansApiClient("acct_test", "test-key", fetcher);
      await expect(
        (async () => {
          for await (const page of client.pages("chats")) void page;
        })(),
      ).rejects.toThrow("UNSAFE_PROVIDER_URL");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("rejects repeated cursors instead of silently finishing an incomplete import", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response([], "https://app.onlyfansapi.com/api/acct_test/chats"));
    const client = new OnlyFansApiClient("acct_test", "test-key", fetcher);
    await expect(
      (async () => {
        for await (const page of client.pages("chats")) void page;
      })(),
    ).rejects.toThrow("INVALID_PROVIDER_PAGINATION");
  });
  it("retries a rate limit with bounded wait and the same idempotency key", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(response(message()));
    const wait = vi.fn().mockResolvedValue(undefined);
    const client = new OnlyFansApiClient("acct_test", "test-key", fetcher, wait);
    await client.request(client.path("chats/2/messages"), { text: "I'm good" }, "action-1");
    expect(wait).toHaveBeenCalledWith(1000);
    expect(fetcher.mock.calls.map((c) => c[1].headers["Idempotency-Key"])).toEqual([
      "action-1",
      "action-1",
    ]);
  });
});

describe("OnlyFansAPI PPV delivery", () => {
  it("sends media, free previews, price and a stable key and validates the receipt", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response(
        message({
          price: 9,
          media: [
            { id: 10, type: "video" },
            { id: 11, type: "photo" },
          ],
          previews: [11],
        }),
      ),
    );
    const adapter = new ApiOnlyFansAdapter(
      new OnlyFansApiClient("acct_test", "test-key", fetcher),
      "1",
    );
    await adapter.openConversation("2");
    const result = await adapter.sendMessage({
      text: "I'm good",
      price: 9,
      mediaIds: ["10"],
      previewIds: ["11"],
      idempotencyKey: "action-0",
    });
    expect(result.verified).toBe(true);
    const opts = fetcher.mock.calls[0]![1];
    expect(JSON.parse(opts.body)).toMatchObject({ price: 9, mediaFiles: ["10"], previews: ["11"] });
    expect(opts.headers["Idempotency-Key"]).toBe("action-0");
  });
  it("does not report success if paid media or price is missing", async () => {
    const adapter = new ApiOnlyFansAdapter(
      new OnlyFansApiClient(
        "acct_test",
        "test-key",
        vi.fn().mockResolvedValue(response(message())),
      ),
      "1",
    );
    await adapter.openConversation("2");
    expect(
      (
        await adapter.sendMessage({
          text: "I'm good",
          price: 9,
          mediaIds: ["10"],
          idempotencyKey: "a",
        })
      ).verified,
    ).toBe(false);
  });
  it("imports outgoing and incoming messages in source chronological order", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response(
        [
          message({ id: 6 }),
          message({
            id: 5,
            fromUser: { id: 2 },
            text: "how are you?",
            createdAt: "2026-10-08T09:59:00Z",
          }),
        ],
        null,
      ),
    );
    const adapter = new ApiOnlyFansAdapter(
      new OnlyFansApiClient("acct_test", "test-key", fetcher),
      "1",
    );
    await adapter.openConversation("2");
    const messages = await adapter.readVisibleMessages();
    expect(messages.map((m) => [m.body, m.direction])).toEqual([
      ["how are you?", "INBOUND"],
      ["I'm good", "OUTBOUND"],
    ]);
  });
});
