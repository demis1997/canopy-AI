import { NextResponse } from "next/server";
import { z } from "zod";
import { generationOutputSchema } from "@canopy/shared";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  creator: z.string().optional(),
  style: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { text, creator } = parsed.data;
  const rewritten = `mmm hi${creator ? ` — it's ${creator.split(" ")[0]}` : ""}. ${text.replace(/^hey[,\s—-]*/i, "").trim()} sneak a look if you want the rest 😏`;
  const schemaCheck = generationOutputSchema.safeParse({
    intent: "CASUAL_CHAT",
    funnelStage: "NEW_FAN",
    explicitnessLevel: "SUGGESTIVE",
    recommendedAction: "REPLY",
    replyOptions: [{ text: rewritten.slice(0, 2000), tone: "PLAYFUL", internalReason: "Welcome rewrite from demo model." }],
    recommendedProductId: null,
    approvedPrice: null,
    requiresHumanReview: false,
    riskFlags: [],
    memoryUpdates: [],
    suggestedFunnelTransition: null,
  });
  return NextResponse.json({
    text: rewritten,
    mockMode: true,
    label: "Demo AI response",
    schemaValid: schemaCheck.success,
  });
}
