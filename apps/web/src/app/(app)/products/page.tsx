import { prisma } from "@canopy/database";
import { Card } from "@/components/ui/card";
import { dollars } from "@/lib/utils";
import { CreateProductForm } from "@/components/create-product-form";
import { ProductImportPanel, VaultSyncPanel } from "@/components/product-import-panel";
import Link from "next/link";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, EmptyState, PageHeader } from "@/components/page-chrome";

export default async function ProductsPage() {
  const { allowed, ctx } = await guardOrgPage("products.manage");
  if (!ctx.tenant) return <AccessDenied title="Select an organization" />;
  if (!allowed) return <AccessDenied />;
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
      <PageHeader
        eyebrow="Optimize"
        title="Products & vault"
        description="The model may only recommend these IDs and prices. Invented offers are stripped. PLATFORM_VAULT_SYNC is not a public OnlyFans API."
        actions={
          <Link className="text-xs text-canopy-300" href="/demo/products">
            Open unauthenticated demo catalogue
          </Link>
        }
      />
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
        {!products.length ? (
          <div className="p-6">
            <EmptyState title="No products" body="Add a vault item so the copilot can pitch approved prices." />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
