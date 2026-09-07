import { pathToFileURL } from "node:url";
import path from "node:path";
import { prisma } from "@canopy/database";
import { readFeatureFlags } from "@canopy/shared";
import { MockOnlyFansAdapter, createMockInboxState } from "./mock-adapter";
import { PlaywrightOnlyFansAdapter } from "./onlyfans-adapter";
import { describeBrowserHost, openHostedOrLocalContext } from "./browser";
import { deliverAction, processIncoming, syncInbox } from "./runner";
import { platformLog } from "./logger";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function connect() {
  const flags = readFeatureFlags();
  if (!flags.browserIntegration && !flags.mockPlatform) {
    throw new Error("ONLYFANS_BROWSER_INTEGRATION and ONLYFANS_MOCK_PLATFORM are both disabled");
  }
  const accountId = arg("account");
  if (!accountId) throw new Error("Pass --account <platformAccountId>");
  const account = await prisma.platformAccount.findUniqueOrThrow({ where: { id: accountId } });
  const headed = process.env.NODE_ENV !== "production";
  const context = await openHostedOrLocalContext(account.id, headed);
  platformLog("connect_host", { organizationId: account.organizationId, platformAccountId: account.id }, describeBrowserHost());
  const page = context.pages()[0] ?? (await context.newPage());
  if (account.driver === "MOCK" || flags.mockPlatform) {
    await page.goto(pathToFileURL(path.join(import.meta.dirname, "fixture.html")).href);
  } else {
    await page.goto("https://onlyfans.com/");
    console.log(
      "Complete OnlyFans login and 2FA yourself in the opened window. Canopy does not collect your password.",
    );
  }
  const adapter = new PlaywrightOnlyFansAdapter(page, {
    liveUnverified: account.driver === "BROWSER" && !flags.mockPlatform,
  });
  for (let i = 0; i < 120; i++) {
    const state = await adapter.detectConnectionState();
    platformLog("connect_poll", { organizationId: account.organizationId, platformAccountId: account.id }, { state });
    if (state === "CONNECTED") {
      const identity = await adapter.detectAccount();
      await prisma.platformAccount.update({
        where: { id: account.id },
        data: {
          connectionStatus: "CONNECTED",
          authorizedAt: new Date(),
          externalAccountId: identity.externalAccountId ?? account.externalAccountId,
          displayName: identity.displayName ?? account.displayName,
          lastHeartbeatAt: new Date(),
        },
      });
      console.log("Connected. Close the window when finished. Profile stays on this machine only.");
      return;
    }
    if (state === "CHALLENGE_REQUIRED") {
      await prisma.platformAccount.update({
        where: { id: account.id },
        data: {
          connectionStatus: "CHALLENGE_REQUIRED",
          manualInterventionReason: "Complete the platform challenge in the browser",
        },
      });
    }
    await page.waitForTimeout(5000);
  }
  throw new Error("Timed out waiting for a connected session");
}

async function workerLoop() {
  const flags = readFeatureFlags();
  const accounts = await prisma.platformAccount.findMany({
    where: { autonomyMode: { not: "PAUSED" } },
  });
  for (const account of accounts) {
    if (account.driver === "BROWSER" && !flags.browserIntegration) {
      platformLog("worker_skip_browser", { organizationId: account.organizationId, platformAccountId: account.id });
      continue;
    }
    if (account.driver === "MOCK" || flags.mockPlatform) {
      const adapter = new MockOnlyFansAdapter(createMockInboxState());
      await syncInbox({
        organizationId: account.organizationId,
        platformAccountId: account.id,
        adapter,
      });
    } else if (account.driver === "BROWSER" && flags.browserIntegration) {
      const context = await openHostedOrLocalContext(account.id, process.env.NODE_ENV !== "production");
      const page = context.pages()[0] ?? (await context.newPage());
      const adapter = new PlaywrightOnlyFansAdapter(page, { liveUnverified: true });
      await syncInbox({
        organizationId: account.organizationId,
        platformAccountId: account.id,
        adapter,
      });
    }
    await prisma.platformAccount.update({
      where: { id: account.id },
      data: { lastHeartbeatAt: new Date() },
    });
  }
}

async function mockDemo() {
  const account = await prisma.platformAccount.findFirst({
    where: { driver: "MOCK" },
    include: { conversations: true },
  });
  if (!account) throw new Error("Seed a MOCK platform account (pnpm db:seed)");
  const state = createMockInboxState();
  const adapter = new MockOnlyFansAdapter(state);
  adapter.injectInbound("hey can I get the gym set?");
  await syncInbox({
    organizationId: account.organizationId,
    platformAccountId: account.id,
    adapter,
  });
  const latest = await prisma.automationAction.findFirst({
    where: { platformAccountId: account.id },
    orderBy: { createdAt: "desc" },
  });
  console.log(
    JSON.stringify(
      {
        actionId: latest?.id,
        status: latest?.status,
        reason: latest?.escalationReason,
      },
      null,
      2,
    ),
  );
}

async function validateSelectors() {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(import.meta.dirname, "fixture.html")).href);
  const adapter = new PlaywrightOnlyFansAdapter(page);
  const state = await adapter.detectConnectionState();
  const inbox = await adapter.listInboxConversations();
  await adapter.openConversation(inbox[0]!.externalConversationId);
  const messages = await adapter.readVisibleMessages();
  await adapter.typeMessage("fixture ping");
  await adapter.sendCurrentMessage();
  const verify = await adapter.verifySentMessage("fixture ping");
  console.log(JSON.stringify({ state, inbox: inbox.length, messages: messages.length, verify }, null, 2));
  await browser.close();
}

const command = process.argv[2];
const run = async () => {
  if (command === "connect") return connect();
  if (command === "worker") return workerLoop();
  if (command === "mock-demo") return mockDemo();
  if (command === "validate-selectors") return validateSelectors();
  console.log(`Usage:
  pnpm --filter @canopy/web platform:connect -- --account <id>
  pnpm --filter @canopy/web platform:worker
  pnpm --filter @canopy/web platform:mock-demo
  pnpm --filter @canopy/web platform:validate-selectors`);
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

void processIncoming;
void deliverAction;
