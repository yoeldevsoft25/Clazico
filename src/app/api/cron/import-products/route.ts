import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const importedProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  public_name: z.string().nullish(),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  price_usd: z.coerce.number().default(0),
  price_bs: z.coerce.number().default(0),
  is_active: z.coerce.boolean().default(true),
  is_visible_public: z.coerce.boolean().optional(),
  image_url: z.string().nullish(),
  public_image_url: z.string().nullish(),
  category: z.string().nullish(),
  public_category: z.string().nullish(),
  current_stock: z.coerce.number().int().default(0),
  updated_at: z.string().nullish(),
});

const importPayloadSchema = z.object({
  products: z.array(importedProductSchema),
  activeVeloxIds: z.array(z.string().min(1)).optional(),
  deactivateMissing: z.boolean().optional(),
});

type ImportedProduct = z.infer<typeof importedProductSchema>;

function generateSlug(name: string, sku: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base}-${sku.toLowerCase()}`;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const storefrontSecretHeader = req.headers.get('x-storefront-secret');
    const allowedSecrets = [
      process.env.CRON_SECRET,
      process.env.STOREFRONT_API_SECRET,
      process.env.VELOX_WEBHOOK_SECRET,
    ].filter((value): value is string => Boolean(value));

    if (
      allowedSecrets.length > 0 &&
      !allowedSecrets.some((secret) =>
        authHeader === `Bearer ${secret}` || storefrontSecretHeader === secret
      )
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = importPayloadSchema.parse(await req.json());
    const [{ db }, schema, { eq }] = await Promise.all([
      import('@/server/db'),
      import('@/../drizzle/schema'),
      import('drizzle-orm'),
    ]);

    let created = 0;
    let updated = 0;
    let deactivated = 0;

    for (const product of body.products) {
      const sku = product.sku || product.id;
      const productData = toProductCacheData(product, sku);

      const existing = await db
        .select({ id: schema.productCache.id })
        .from(schema.productCache)
        .where(eq(schema.productCache.veloxId, product.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.productCache)
          .set(productData)
          .where(eq(schema.productCache.veloxId, product.id));
        updated++;
      } else {
        await db.insert(schema.productCache).values({
          ...productData,
          slug: generateSlug(product.name, sku),
        });
        created++;
      }
    }

    if (body.deactivateMissing && body.activeVeloxIds && body.activeVeloxIds.length >= 50) {
      const activeIds = new Set(body.activeVeloxIds);
      const activeRows = await db
        .select({ veloxId: schema.productCache.veloxId })
        .from(schema.productCache)
        .where(eq(schema.productCache.isActive, true));

      for (const row of activeRows) {
        if (!activeIds.has(row.veloxId)) {
          await db
            .update(schema.productCache)
            .set({ isActive: false, syncedAt: new Date() })
            .where(eq(schema.productCache.veloxId, row.veloxId));
          deactivated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: body.products.length,
      created,
      updated,
      deactivated,
    });
  } catch (error) {
    console.error('Product import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

function toProductCacheData(product: ImportedProduct, sku: string) {
  return {
    veloxId: product.id,
    name: product.public_name ?? product.name,
    sku,
    barcode: product.barcode ?? null,
    priceUsd: String(product.price_usd),
    priceBs: String(product.price_bs),
    isActive: product.is_active !== false,
    imageUrl: normalizeVeloxImageUrl(product.public_image_url ?? product.image_url),
    category: product.public_category ?? product.category ?? null,
    currentStock: product.current_stock,
    metadata: {
      isVisiblePublic: product.is_visible_public !== false,
      veloxUpdatedAt: product.updated_at ?? null,
      stockSyncedAt: new Date().toISOString(),
    },
    syncedAt: new Date(),
  };
}

function normalizeVeloxImageUrl(imageUrl: string | null | undefined): string | null {
  const value = imageUrl?.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  const baseUrl = process.env.VELOX_PUBLIC_ASSET_URL || process.env.VELOX_POS_API_URL;
  if (!baseUrl) return value;

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${normalizedBase}${normalizedPath}`;
}
