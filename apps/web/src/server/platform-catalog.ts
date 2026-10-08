import { prisma, decryptSecret, type PlatformAccount, type Prisma } from "@canopy/database";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { OnlyFansApiClient, mediaSchema, messageSchema, postSchema, chatSchema, messageDirection, plainText, type ApiMedia } from "../platform/onlyfans-api-client";

export function apiClient(account: PlatformAccount) {
  if (account.driver !== "ONLYFANS_API" || !account.providerAccountId || !account.encryptedApiKey || !account.externalAccountId) {
    throw new Error("ONLYFANS_API_NOT_CONNECTED");
  }
  return new OnlyFansApiClient(account.providerAccountId, decryptSecret(account.encryptedApiKey));
}

function mediaType(items: ApiMedia[]): "PHOTO" | "VIDEO" | "AUDIO" | "BUNDLE" | "TEXT" {
  if (items.length > 1) return "BUNDLE";
  return items[0]?.type === "video" ? "VIDEO" : items[0]?.type === "audio" ? "AUDIO" : items.length ? "PHOTO" : "TEXT";
}

export async function syncPlatformCatalog(input: { organizationId: string; platformAccountId: string; syncRunId: string }, clientOverride?: OnlyFansApiClient) {
  const account = await prisma.platformAccount.findFirstOrThrow({ where: { id: input.platformAccountId, organizationId: input.organizationId } });
  const run = await prisma.catalogSyncRun.findFirstOrThrow({ where: { id: input.syncRunId, platformAccountId: account.id, organizationId: account.organizationId } });
  if (run.status === "SUCCEEDED") return;
  const token = randomUUID();
  const startedAt = new Date();
  const claim = await prisma.platformAccount.updateMany({ where: { id: account.id, organizationId: account.organizationId,
    OR: [{ syncLockUntil: null }, { syncLockUntil: { lt: startedAt } }] },
    data: { syncLockToken: token, syncLockUntil: new Date(Date.now() + 30 * 60_000) } });
  if (!claim.count) throw new Error("CATALOG_SYNC_BUSY");
  let importedMedia = 0; let importedProducts = 0;
  let client: OnlyFansApiClient;
  const org = account.organizationId;
  const progress = async (stage: string) => {
    const renewed = await prisma.platformAccount.updateMany({ where: { id: account.id, syncLockToken: token },
      data: { syncLockUntil: new Date(Date.now() + 30 * 60_000) } });
    if (!renewed.count) throw new Error("CATALOG_SYNC_LOCK_LOST");
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { importedMedia, importedProducts, progress: { stage } } });
  };
  const importMedia = async (tx: Prisma.TransactionClient, item: ApiMedia) => {
    const available = item.isReady !== false && item.hasError !== true && item.canView !== false;
    const result = await tx.mediaAsset.upsert({ where: { importKey: `${account.id}:media:${item.id}` },
      create: { importKey: `${account.id}:media:${item.id}`, organizationId: org, creatorId: account.creatorId,
        platformAccountId: account.id, externalId: item.id, title: `OnlyFans ${item.type} ${item.id}`, mediaType: mediaType([item]),
        source: "PLATFORM_VAULT_SYNC", available, lastSyncedAt: new Date(), sourceMetadata: { duration: item.duration ?? null } },
      update: { available, lastSyncedAt: new Date(), sourceMetadata: { duration: item.duration ?? null } } });
    importedMedia++;
    return result;
  };
  const importProduct = async (sourceId: string, kind: string, text: string, price: number | null, media: ApiMedia[], previewIds: string[], chatId?: string) => {
    const previews = new Set(previewIds);
    const paid = media.filter((item) => !previews.has(item.id));
    // A paid offer cannot be safely recreated if the provider omitted its preview/media mapping.

    await prisma.$transaction(async (tx) => {
      const assets = new Map<string, string>();
      for (const item of media) assets.set(item.id, (await importMedia(tx, item)).id);
      for (const id of previewIds) if (!assets.has(id)) {
        const preview = await tx.mediaAsset.findUnique({ where: { importKey: `${account.id}:media:${id}` } });
        if (preview?.available) assets.set(id, preview.id);
      }
      const complete = previewIds.every((id) => assets.has(id));
      const available = complete && paid.length > 0 && paid.every((item) => item.isReady !== false && item.hasError !== true && item.canView !== false);
      const cents = price == null ? null : Math.round(price * 100);
      const metadata = { kind, sourceId, chatId: chatId ?? null, currency: "USD", paidMediaIds: paid.map((m) => m.id), previewIds };
      const previousProduct = await tx.product.findUnique({ where: { importKey: `${account.id}:${kind}:${sourceId}` } });
      const product = await tx.product.upsert({ where: { importKey: `${account.id}:${kind}:${sourceId}` },
        create: { importKey: `${account.id}:${kind}:${sourceId}`, organizationId: org, creatorId: account.creatorId,
          platformAccountId: account.id, platform: "onlyfans", externalId: `${kind}:${sourceId}`,
          name: plainText(text).slice(0, 100) || `OnlyFans ${kind} ${sourceId}`, description: plainText(text), mediaType: mediaType(paid),
          standardPriceCents: cents ?? 0, minimumPriceCents: cents ?? 0, sourcePriceCents: cents,
          source: "PLATFORM_VAULT_SYNC", sourceAvailable: available, available: false, approvedForAutomation: false,
          platformMediaReference: paid[0]?.id, sourceMetadata: metadata, lastSyncedAt: new Date() },
        update: { sourcePriceCents: cents, sourceAvailable: available, sourceMetadata: metadata, lastSyncedAt: new Date(),
          platformMediaReference: paid[0]?.id } });
      await tx.productMedia.deleteMany({ where: { productId: product.id } });
      await tx.productPreview.deleteMany({ where: { productId: product.id } });
      for (const [sortOrder, item] of paid.entries()) await tx.productMedia.create({ data: { productId: product.id, mediaId: assets.get(item.id)!, sortOrder } });
      for (const [sortOrder, id] of previewIds.entries()) if (assets.has(id)) await tx.productPreview.create({ data: { productId: product.id, mediaId: assets.get(id)!, sortOrder } });
      // Changed bundle contents invalidate prior automation approval; operator prices remain intact.
      if (product.approvedForAutomation) {
        const previous = previousProduct?.sourceMetadata as { paidMediaIds?: string[]; previewIds?: string[] } | null;
        if (JSON.stringify(previous?.paidMediaIds) !== JSON.stringify(metadata.paidMediaIds) || JSON.stringify(previous?.previewIds) !== JSON.stringify(metadata.previewIds)) {
          await tx.product.update({ where: { id: product.id }, data: { approvedForAutomation: false, available: false } });
        }
      }
    });
    importedProducts++;
  };
  try {
    client = clientOverride ?? apiClient(account);
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: "RUNNING", lastError: null } });
    const me = await client.me();
    if (me.id !== account.externalAccountId || me.isAuth === false) throw new Error("ACCOUNT_MISMATCH");
    for await (const page of client.pages("media/vault?limit=100")) {
      for (const raw of page) { const media = mediaSchema.parse(raw); await importProduct(media.id, "vault", "", null, [media], []); }
      await progress("vault");
    }
    for await (const page of client.pages("posts?limit=100&offset=0")) {
      for (const raw of page) {
        const summary = postSchema.parse(raw);
        const post = raw && typeof raw === "object" && "price" in raw && "media" in raw ? summary :
          postSchema.parse((await client.request(client.path(`posts/${summary.id}`))).data);
        if (post.author.id !== me.id) throw new Error("POST_AUTHOR_MISMATCH");
        if (post.price > 0) await importProduct(post.id, "post", post.text, post.price, post.media,
          post.previews.map((p) => typeof p === "string" ? p : p.id));
      }
      await progress("posts");
    }
    for await (const page of client.pages("chats?limit=100")) {
      for (const raw of page) {
        const chat = chatSchema.parse(raw); const fan = chat.withUser ?? chat.fan;
        if (!fan) throw new Error("CHAT_IDENTITY_MISSING");
        const chatId = chat.id ?? fan.id;
        for await (const messages of client.pages(`chats/${chatId}/messages?limit=100&order=desc`)) {
          for (const rawMessage of messages) {
            const m = messageSchema.parse(rawMessage);
            if (messageDirection(m, me.id, fan.id) === "OUTBOUND" && m.price > 0) {
              await importProduct(`${chatId}:${m.id}`, "message", m.text, m.price, m.media,
                m.previews.map((p) => typeof p === "string" ? p : p.id), chatId);
            }
          }
          await progress("paid messages");
        }
      }
    }
    // Only a complete successful scan may retire unseen source items.
    await prisma.$transaction([
      prisma.product.updateMany({ where: { platformAccountId: account.id, source: "PLATFORM_VAULT_SYNC", lastSyncedAt: { lt: startedAt } }, data: { sourceAvailable: false } }),
      prisma.mediaAsset.updateMany({ where: { platformAccountId: account.id, source: "PLATFORM_VAULT_SYNC", lastSyncedAt: { lt: startedAt } }, data: { available: false } }),
      prisma.platformAccount.update({ where: { id: account.id }, data: { lastCatalogSyncAt: new Date() } }),
      prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", importedMedia, importedProducts, progress: { stage: "complete" } } }),
    ]);
  } catch (error) {
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 160) : "SYNC_FAILED" } });
    throw error;
  } finally {
    await prisma.platformAccount.updateMany({ where: { id: account.id, syncLockToken: token }, data: { syncLockUntil: null, syncLockToken: null } });
  }
}

const receiptSchema = z.object({ id: z.string(), amount: z.coerce.number(), currency: z.string(), status: z.string(), type: z.string(),
  createdAt: z.string().datetime({ offset: true }), user: z.object({ id: z.union([z.string(), z.number()]).transform(String) }).optional(),
  messageId: z.union([z.string(), z.number()]).transform(String).optional() });

export async function syncPlatformReceipts(input: { organizationId: string; platformAccountId: string }) {
  const account = await prisma.platformAccount.findFirstOrThrow({ where: { id: input.platformAccountId, organizationId: input.organizationId } });
  const client = apiClient(account);
  await client.me().then((me) => { if (me.id !== account.externalAccountId) throw new Error("ACCOUNT_MISMATCH"); });
  // Overlap catches late settlement and refunds; external IDs make repeats idempotent.
  const since = new Date((account.lastReceiptSyncAt?.getTime() ?? Date.now() - 90 * 86_400_000) - 7 * 86_400_000).toISOString();
  for await (const page of client.pages(`transactions?limit=100&startDate=${encodeURIComponent(since)}`)) {
    for (const raw of page) {
      const r = receiptSchema.parse(raw);
      const receipt = await prisma.platformReceipt.upsert({ where: { platformAccountId_externalId: { platformAccountId: account.id, externalId: r.id } },
        create: { organizationId: account.organizationId, platformAccountId: account.id, externalId: r.id, externalFanId: r.user?.id,
          sourceMessageId: r.messageId, amountCents: Math.round(r.amount * 100), currency: r.currency, sourceStatus: r.status, sourceType: r.type, occurredAt: new Date(r.createdAt) },
        update: { sourceStatus: r.status, amountCents: Math.round(r.amount * 100) } });
      // Provider transaction list often has no message/product ID. Never infer a purchase by matching price.
      if (!r.messageId || !r.user || r.currency !== "USD") continue;
      const product = await prisma.product.findFirst({ where: { platformAccountId: account.id, externalId: `message:${r.user.id}:${r.messageId}` } });
      const thread = await prisma.platformConversation.findFirst({ where: { platformAccountId: account.id, externalFanId: r.user.id }, include: { canopyConversation: true } });
      if (!product || !thread || !["paid", "completed", "refunded"].includes(r.status.toLowerCase())) continue;
      await prisma.$transaction(async (tx) => {
        await tx.purchase.upsert({ where: { externalReceiptId: `${account.id}:${r.id}` }, create: { externalReceiptId: `${account.id}:${r.id}`,
          organizationId: account.organizationId, productId: product.id, subscriberId: thread.canopyConversation.subscriberId,
          conversationId: thread.canopyConversationId, amountCents: receipt.amountCents, refunded: r.status.toLowerCase() === "refunded", createdAt: new Date(r.createdAt) },
          update: { refunded: r.status.toLowerCase() === "refunded", amountCents: receipt.amountCents } });
        await tx.platformReceipt.update({ where: { id: receipt.id }, data: { reconciled: true } });
      });
    }
  }
  await prisma.platformAccount.update({ where: { id: account.id }, data: { lastReceiptSyncAt: new Date() } });
}
