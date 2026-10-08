import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";

export function profileRoot() {
  return process.env.CANOPY_BROWSER_PROFILE_ROOT ?? path.join(process.cwd(), ".canopy-profiles");
}

export function profileDirFor(accountId: string) {
  return path.join(profileRoot(), accountId);
}

/**
 * Persistent local profile. Never upload this directory. Never send cookies to the API.
 */
export async function openPersistentContext(
  accountId: string,
  headed = true,
): Promise<BrowserContext> {
  const dir = profileDirFor(accountId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return chromium.launchPersistentContext(dir, {
    headless: !headed,
    viewport: { width: 1280, height: 800 },
  });
}

export type RemoteBrowserHandle = {
  kind: "persistent-local" | "remote-cdp";
};

export function describeBrowserHost(): RemoteBrowserHandle {
  if (process.env.CANOPY_BROWSER_CDP_URL) {
    return { kind: "remote-cdp" };
  }
  return { kind: "persistent-local" };
}

/**
 * Production adapter: a remotely hosted Chromium via CDP.
 * The worker still owns cookies locally to that browser; they are never sent to the Canopy API.
 */
export async function openHostedOrLocalContext(
  accountId: string,
  headed = true,
): Promise<BrowserContext> {
  const mapping: Record<string, string> = JSON.parse(process.env.CANOPY_BROWSER_CDP_URLS ?? "{}");
  const cdp =
    mapping[accountId] ??
    (process.env.CANOPY_BROWSER_CDP_ACCOUNT_ID === accountId
      ? process.env.CANOPY_BROWSER_CDP_URL
      : undefined);
  if (process.env.CANOPY_BROWSER_CDP_URL && !cdp)
    throw new Error("CDP endpoint must be bound to this account");
  if (cdp && Object.values(mapping).filter((url) => url === cdp).length > 1)
    throw new Error("CDP endpoint cannot be shared across accounts");
  if (cdp) {
    const browser = await chromium.connectOverCDP(cdp);
    return browser.contexts()[0] ?? (await browser.newContext());
  }
  return openPersistentContext(accountId, headed);
}
