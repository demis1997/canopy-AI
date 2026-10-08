import { NextResponse } from "next/server";
import { requireUser, requireOrgUser, requirePerm, jsonError } from "@/lib/session";
import { issueExtensionToken, listExtensionTokens, revokeExtensionToken } from "@/server/security";

export async function GET() {
  try {
    const ctx = await requireUser();
    const tokens = await listExtensionTokens(ctx.userId);
    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        issuedAt: t.createdAt,
        expiresAt: t.expiresAt,
        revokedAt: t.revokedAt,
        active: !t.revokedAt && t.expiresAt > new Date(),
      })),
      version: "0.1.0",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    const ctx = await requireUser();
    const scoped = await requireOrgUser();
    requirePerm(scoped, "conversations.generate");
    if (!scoped.tenant)
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    const issued = await issueExtensionToken(ctx.userId, scoped.tenant.organizationId);
    return NextResponse.json({
      ...issued,
      warning: "Store this token in the extension session only. It is not shown again.",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const row = await revokeExtensionToken(ctx.userId, id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return jsonError(error);
  }
}
