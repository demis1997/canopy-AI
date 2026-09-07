import { NextResponse } from "next/server";

export async function POST() {
  const authorised = process.env.CANOPY_PLATFORM_VAULT_SYNC === "1";
  if (!authorised) {
    return NextResponse.json({
      enabled: false,
      mode: "DEMO",
      message:
        "PLATFORM_VAULT_SYNC is disabled. There is no public OnlyFans API in Canopy. Enable an authorised integration or a permitted “Import selected items” extension workflow — never scrape credentials or session cookies.",
    });
  }
  return NextResponse.json({
    enabled: true,
    mode: "PLATFORM_VAULT_SYNC",
    message: "Authorised vault sync flag is on. This demo still uses seeded vault metadata only.",
  });
}
