export function platformLog(
  event: string,
  ids: { organizationId?: string; platformAccountId?: string; conversationId?: string },
  extra?: Record<string, unknown>,
) {
  const safe = { ...extra };
  delete safe.body;
  delete safe.text;
  delete safe.cookies;
  delete safe.authorization;
  delete safe.profilePath;
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      organizationId: ids.organizationId,
      platformAccountId: ids.platformAccountId,
      conversationId: ids.conversationId,
      ...safe,
    }),
  );
}
