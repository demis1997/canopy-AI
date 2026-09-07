import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@canopy/database";
import { requireOrgUser, jsonError, requirePerm } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgUser();
    if (!ctx.tenant) return NextResponse.json({ error: "No organization" }, { status: 400 });
    requirePerm(ctx, "conversations.view");
    const body = z
      .object({
        displayName: z.string().min(1),
        platformHandle: z.string().min(1),
        adultStatus: z
          .enum([
            "VERIFIED_ADULT",
            "PLATFORM_ASSUMED_ADULT",
            "UNCERTAIN",
            "SUSPECTED_MINOR",
            "CONFIRMED_MINOR",
          ])
          .default("UNCERTAIN"),
      })
      .parse(await request.json());
    const subscriber = await prisma.subscriber.create({
      data: {
        organizationId: ctx.tenant.organizationId,
        displayName: body.displayName,
        platformHandle: body.platformHandle,
        adultStatus: body.adultStatus,
      },
    });
    return NextResponse.json({ id: subscriber.id });
  } catch (error) {
    return jsonError(error);
  }
}
