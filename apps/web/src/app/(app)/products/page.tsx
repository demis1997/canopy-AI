import { prisma } from "@canopy/database";
import { Card } from "@/components/ui/card";
import { dollars } from "@/lib/utils";
import { CreateProductForm } from "@/components/create-product-form";
import {
  ProductImportPanel,
  VaultSyncPanel,
  ProductApproval,
} from "@/components/product-import-panel";
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
  const accounts = await prisma.platformAccount.findMany({
    where: { organizationId: ctx.tenant.organizationId, driver: "ONLYFANS_API" },
    select: {
      id: true,
      creatorId: true,
      displayName: true,
      providerAccountId: true,
      connectionStatus: true,
      lastCatalogSyncAt: true,
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Optimize"
        title="Products & vault"
        description="The model may only recommend these IDs and prices. First PPV ($10 or under) never discounts. Later items discount only after the fan goes silent."
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
      <VaultSyncPanel
        creators={creators.map((c) => ({ id: c.id, name: c.displayName }))}
        accounts={accounts.map((a) => ({
          ...a,
          lastCatalogSyncAt: a.lastCatalogSyncAt?.toISOString() ?? null,
        }))}
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-white/40">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th>Creator</th>
              <th>Type</th>
              <th>Price</th>
              <th>2nd</th>
              <th>Min</th>
              <th>Max off</th>
              <th>Source</th>
              <th>Sold</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-5 py-3">
                  {p.name}
                  {p.source === "PLATFORM_VAULT_SYNC" ? (
                    <ProductApproval
                      product={{
                        id: p.id,
                        standardPriceCents: p.standardPriceCents,
                        minimumPriceCents: p.minimumPriceCents,
                        available: p.available,
                        sourceAvailable: p.sourceAvailable,
                      }}
                    />
                  ) : null}
                </td>
                <td>{p.creator.displayName}</td>
                <td>{p.mediaType}</td>
                <td>{dollars(p.standardPriceCents)}</td>
                <td>
                  {p.secondPriceCents != null
                    ? dollars(p.secondPriceCents)
                    : dollars(Math.round((p.standardPriceCents + p.minimumPriceCents) / 2))}
                </td>
                <td>{dollars(p.minimumPriceCents)}</td>
                <td>{p.discountLimitPercent}%</td>
                <td>{p.source}</td>
                <td>{p.timesSold}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length ? (
          <div className="p-6">
            <EmptyState
              title="No products"
              body="Add a vault item so the copilot can pitch approved prices."
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
