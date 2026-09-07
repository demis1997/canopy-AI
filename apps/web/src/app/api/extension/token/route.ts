import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/session";
import { issueExtensionToken } from "@/server/security";

export async function POST() {
  try {
    const ctx = await requireUser();
    const issued = await issueExtensionToken(ctx.userId);
    return NextResponse.json(issued);
  } catch (error) {
    return jsonError(error);
  }
}
