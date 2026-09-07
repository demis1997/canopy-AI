import { prisma } from "@canopy/database";
import { requireOrgUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { dollars } from "@/lib/utils";
import { CreateProductForm } from "@/components/create-product-form";
import { ProductImportPanel, VaultSyncPanel } from "@/components/product-import-panel";
import Link from "next/link";

export default async function ProductsPage() {
  const ctx = await requireOrgUser();
  if (!ctx.tenant) redirect("/admin");
  const products = await prisma.product.findMany({
    where: { organizationId: ctx.tenant.organizationId },
    include: { creator: true, media: true, previews: true },
    orderBy: { createdAt: "desc" },
  });
  const creators = await prisma.creator.findMany({
    where: { organizationId: ctx.tenant.organizationId, active: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Products & vault</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/50">
          The model may only recommend these IDs and prices. Invented offers are stripped. Sources: DEMO_SEED,
          MANUAL, CSV_IMPORT, MEDIA_UPLOAD. PLATFORM_VAULT_SYNC is not a public OnlyFans API — it stays off
          without an authorised connector.
        </p>
        <Link className="mt-2 inline-block text-xs text-canopy-300" href="/demo/products">
          Open unauthenticated demo catalogue
        </Link>
      </div>
      <CreateProductForm creators={creators.map((c) => ({ id: c.id, name: c.displayName }))} />
      <ProductImportPanel
        creators={creators.map((c) => ({ id: c.id, name: c.displayName, handle: c.handle }))}
      />
      <VaultSyncPanel />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-white/40">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th>Creator</th>
              <th>Type</th>
              <th>Price</th>
              <th>Min</th>
              <th>Source</th>
              <th>Sold</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-5 py-3">{p.name}</td>
                <td>{p.creator.displayName}</td>
                <td>{p.mediaType}</td>
                <td>{dollars(p.standardPriceCents)}</td>
                <td>{dollars(p.minimumPriceCents)}</td>
                <td>{p.source}</td>
                <td>{p.timesSold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
