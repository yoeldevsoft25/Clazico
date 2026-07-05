import 'server-only';
import { db } from '@/server/db';
import * as schema from '@/../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { veloxPosService, type VeloxProduct, type VeloxProductVariant } from './velox-pos.service';

// ─── Types ───────────────────────────────────────────────────────────────────

const syncConfig = {
  productBatchSize: Number(process.env.PRODUCT_SYNC_PRODUCT_BATCH_SIZE || 80),
  stockBatchSize: Number(process.env.PRODUCT_SYNC_STOCK_BATCH_SIZE || 40),
  stockConcurrency: Number(process.env.PRODUCT_SYNC_STOCK_CONCURRENCY || 4),
  productsTimeoutMs: Number(process.env.PRODUCT_SYNC_PRODUCTS_TIMEOUT_MS || 15_000),
  stockTimeoutMs: Number(process.env.PRODUCT_SYNC_STOCK_TIMEOUT_MS || 5_000),
  maxRunMs: Number(process.env.PRODUCT_SYNC_MAX_RUN_MS || 20_000),
  minProductsBeforeDeactivate: Number(process.env.PRODUCT_SYNC_MIN_DEACTIVATE_COUNT || 50),
};

type ProductSyncMetadata = {
  isVisiblePublic?: boolean;
  veloxUpdatedAt?: string | null;
  stockSyncedAt?: string | null;
  [key: string]: unknown;
};

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  processed: number;
  remaining: number;
  deactivated: number;
  errors: string[];
  variantsSynced: number;
  stockSynced: number;
  stockSkipped: number;
  staleCachePreserved: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ProductSyncService {
  private static instance: ProductSyncService | null = null;
  private activeSync: Promise<SyncResult> | null = null;

  private constructor() { }

  static getInstance(): ProductSyncService {
    if (!ProductSyncService.instance) {
      ProductSyncService.instance = new ProductSyncService();
    }
    return ProductSyncService.instance;
  }

  /**
   * Full sync: fetch all products from Velox POS and upsert into local
   * ProductCache + ProductVariants + ProductImageCache.
   */
  async syncAll(): Promise<SyncResult> {
    if (this.activeSync) {
      return this.activeSync;
    }

    this.activeSync = this.runFullSync().finally(() => {
      this.activeSync = null;
    });

    return this.activeSync;
  }

  private async runFullSync(): Promise<SyncResult> {
    const startedAt = Date.now();
    const result: SyncResult = {
      total: 0,
      created: 0,
      updated: 0,
      processed: 0,
      remaining: 0,
      deactivated: 0,
      errors: [],
      variantsSynced: 0,
      stockSynced: 0,
      stockSkipped: 0,
      staleCachePreserved: false,
    };

    let veloxProducts: VeloxProduct[];
    try {
      veloxProducts = await withTimeout(
        veloxPosService.getProducts({ limit: 10000 }),
        syncConfig.productsTimeoutMs,
        'Velox product list timed out',
      );
    } catch (error) {
      result.staleCachePreserved = true;
      result.errors.push(`Velox unavailable; keeping cached products: ${formatError(error)}`);
      return result;
    }

    result.total = veloxProducts.length;

    if (veloxProducts.length === 0) {
      result.staleCachePreserved = true;
      result.errors.push('Velox returned an empty product list; keeping cached products active');
      return result;
    }

    const existingRows = await db
      .select({
        id: schema.productCache.id,
        veloxId: schema.productCache.veloxId,
        currentStock: schema.productCache.currentStock,
        metadata: schema.productCache.metadata,
      })
      .from(schema.productCache);
    const existingByVeloxId = new Map(existingRows.map((row) => [row.veloxId, row]));
    const knownVeloxIds = new Set(existingByVeloxId.keys());
    const productTargets = this.selectProductTargets(
      veloxProducts,
      existingByVeloxId,
      syncConfig.productBatchSize,
    );
    const stockTargets = this.selectStockTargets(productTargets, existingByVeloxId);
    const stockByProductId = await this.fetchStockBatch(stockTargets, result);
    const veloxProductIds = new Set<string>();

    for (const product of productTargets) {
      if (Date.now() - startedAt >= syncConfig.maxRunMs) {
        result.staleCachePreserved = true;
        break;
      }

      veloxProductIds.add(product.id);

      try {
        const syncedVariants = await this.upsertProduct(
          product,
          result,
          existingByVeloxId.get(product.id),
          stockByProductId,
        );
        result.variantsSynced += syncedVariants;
        result.processed++;
        knownVeloxIds.add(product.id);
      } catch (error) {
        result.errors.push(`Failed to sync product ${product.id} (${product.sku ?? 'sin-sku'}): ${formatError(error)}`);
      }
    }

    for (const product of veloxProducts) {
      veloxProductIds.add(product.id);
    }
    result.remaining = veloxProducts.filter((product) => !knownVeloxIds.has(product.id)).length;

    if (veloxProducts.length >= syncConfig.minProductsBeforeDeactivate) {
      result.deactivated = await this.deactivateMissingProducts(veloxProductIds);
    } else {
      result.staleCachePreserved = true;
    }

    return result;
  }

  /**
   * Sync a single product by fetching its stock and updating the cache.
   */
  async syncProduct(veloxProductId: string): Promise<void> {
    const products = await veloxPosService.getProducts({ limit: 10000 });
    const product = products.find((p) => p.id === veloxProductId);

    if (!product) {
      throw new Error(`Product ${veloxProductId} not found in Velox POS`);
    }

    const result: SyncResult = {
      total: 1,
      created: 0,
      updated: 0,
      processed: 0,
      remaining: 0,
      deactivated: 0,
      errors: [],
      variantsSynced: 0,
      stockSynced: 0,
      stockSkipped: 0,
      staleCachePreserved: false,
    };
    const existing = await db
      .select({
        id: schema.productCache.id,
        currentStock: schema.productCache.currentStock,
        metadata: schema.productCache.metadata,
      })
      .from(schema.productCache)
      .where(eq(schema.productCache.veloxId, product.id))
      .limit(1);
    const stockByProductId = await this.fetchStockBatch([product], result);
    await this.upsertProduct(product, result, existing[0], stockByProductId);
    result.processed = 1;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private async upsertProduct(
    product: VeloxProduct,
    result: SyncResult,
    existingCache: {
      id: string;
      currentStock: number;
      metadata: unknown;
    } | undefined,
    stockByProductId: Map<string, number>,
  ): Promise<number> {
    const variants = product.variants ?? [];
    const stock = stockByProductId.get(product.id) ?? existingCache?.currentStock ?? variants.reduce((sum, v) => sum + v.current_stock, 0);
    if (!stockByProductId.has(product.id)) {
      result.stockSkipped++;
    }

    const productData = {
      veloxId: product.id,
      name: product.public_name ?? product.name,
      sku: product.sku ?? product.id,
      barcode: product.barcode,
      priceUsd: String(product.price_usd),
      priceBs: String(product.price_bs),
      isActive: product.is_active !== false,
      imageUrl: this.normalizeVeloxImageUrl(product.public_image_url ?? product.image_url),
      category: product.public_category ?? product.category,
      currentStock: stock,
      metadata: {
        ...normalizeMetadata(existingCache?.metadata),
        isVisiblePublic: product.is_visible_public !== false,
        veloxUpdatedAt: product.updated_at ?? null,
        stockSyncedAt: stockByProductId.has(product.id)
          ? new Date().toISOString()
          : normalizeMetadata(existingCache?.metadata).stockSyncedAt ?? null,
      },
      syncedAt: new Date(),
    };

    let productCacheId: string;

    if (existingCache) {
      productCacheId = existingCache.id;
      await db
        .update(schema.productCache)
        .set(productData)
        .where(eq(schema.productCache.id, productCacheId));
      result.updated++;
    } else {
      const [inserted] = await db
        .insert(schema.productCache)
        .values({
          ...productData,
          slug: this.generateSlug(product.name, product.sku ?? product.id),
        })
        .returning({ id: schema.productCache.id });
      if (!inserted) {
        throw new Error('Insert returned no row');
      }
      productCacheId = inserted.id;
      result.created++;
    }

    // Sync variants (if any) and image cache. The image cache stores both
    // the parent product image and any variant-level image, so the PDP can
    // swap images by color.
    await this.syncVariants(productCacheId, variants);
    await this.syncImages(productCacheId, product.public_image_url ?? product.image_url, variants);

    return variants.length;
  }

  private selectProductTargets(
    products: VeloxProduct[],
    existingByVeloxId: Map<string, { currentStock: number; metadata: unknown }>,
    limit: number,
  ): VeloxProduct[] {
    const scored = products.map((product, index) => {
      const existing = existingByVeloxId.get(product.id);
      const metadata = normalizeMetadata(existing?.metadata);
      const isNew = !existing;
      const changed = metadata.veloxUpdatedAt !== (product.updated_at ?? null);
      const stockMissing = !metadata.stockSyncedAt;
      const stockSyncedAt = metadata.stockSyncedAt ? Date.parse(metadata.stockSyncedAt) : 0;
      return {
        product,
        score: isNew ? 0 : changed ? 1 : stockMissing ? 2 : 3,
        stockSyncedAt: Number.isFinite(stockSyncedAt) ? stockSyncedAt : 0,
        index,
      };
    });

    return scored
      .sort((a, b) => a.score - b.score || a.stockSyncedAt - b.stockSyncedAt || a.index - b.index)
      .slice(0, Math.max(1, limit))
      .map((entry) => entry.product);
  }

  private selectStockTargets(
    products: VeloxProduct[],
    existingByVeloxId: Map<string, { currentStock: number; metadata: unknown }>,
  ): VeloxProduct[] {
    const scored = products.map((product, index) => {
      const existing = existingByVeloxId.get(product.id);
      const metadata = normalizeMetadata(existing?.metadata);
      const stockSyncedAt = metadata.stockSyncedAt ? Date.parse(metadata.stockSyncedAt) : 0;
      return {
        product,
        stockSyncedAt: Number.isFinite(stockSyncedAt) ? stockSyncedAt : 0,
        index,
      };
    });

    return scored
      .sort((a, b) => a.stockSyncedAt - b.stockSyncedAt || a.index - b.index)
      .slice(0, Math.max(0, syncConfig.stockBatchSize))
      .map((entry) => entry.product);
  }

  private async fetchStockBatch(
    products: VeloxProduct[],
    result: SyncResult,
  ): Promise<Map<string, number>> {
    const stockByProductId = new Map<string, number>();
    let cursor = 0;

    const workers = Array.from({ length: Math.min(syncConfig.stockConcurrency, products.length) }, async () => {
      while (cursor < products.length) {
        const product = products[cursor++];
        if (!product) return;

        try {
          const stockData = await withTimeout(
            veloxPosService.getStock(product.id),
            syncConfig.stockTimeoutMs,
            `Velox stock timed out for ${product.id}`,
          );
          stockByProductId.set(product.id, stockData.current_stock);
          result.stockSynced++;
        } catch (error) {
          result.errors.push(`Stock preserved for ${product.id}: ${formatError(error)}`);
        }
      }
    });

    await Promise.all(workers);
    return stockByProductId;
  }

  private async syncVariants(
    productCacheId: string,
    variants: VeloxProductVariant[],
  ): Promise<void> {
    if (variants.length === 0) {
      // No variants in Velox — drop any local variants left over from a
      // previous sync so the PDP doesn't show stale size/color data.
      await db
        .delete(schema.productVariants)
        .where(eq(schema.productVariants.productCacheId, productCacheId));
      return;
    }

    // Get the existing variants so we can determine which ones to remove
    // (Velox may have deleted variants since the last sync).
    const existing = await db
      .select({ id: schema.productVariants.id, veloxVariantId: schema.productVariants.veloxVariantId })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productCacheId, productCacheId));

    const incomingIds = new Set(variants.map((v) => v.id));
    const staleIds = existing
      .filter((row) => !incomingIds.has(row.veloxVariantId))
      .map((row) => row.id);

    if (staleIds.length > 0) {
      await db
        .delete(schema.productVariants)
        .where(inArray(schema.productVariants.id, staleIds));
    }

    // Bulk upsert via INSERT ... ON CONFLICT (velox_variant_id) DO UPDATE.
    // Drizzle exposes this via onConflictDoUpdate.
    for (const variant of variants) {
      await db
        .insert(schema.productVariants)
        .values({
          veloxVariantId: variant.id,
          productCacheId,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          colorHex: variant.color_hex,
          imageUrl: this.normalizeVeloxImageUrl(variant.image_url),
          additionalImages: variant.additional_images ?? [],
          sortOrder: variant.sort_order ?? 0,
          priceUsdOverride:
            variant.price_usd_override === null
              ? null
              : String(variant.price_usd_override),
          priceBsOverride:
            variant.price_bs_override === null
              ? null
              : String(variant.price_bs_override),
          currentStock: variant.current_stock,
          isActive: variant.is_active,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.productVariants.veloxVariantId,
          set: {
            productCacheId,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            colorHex: variant.color_hex,
            imageUrl: this.normalizeVeloxImageUrl(variant.image_url),
            additionalImages: variant.additional_images ?? [],
            sortOrder: variant.sort_order ?? 0,
            priceUsdOverride:
              variant.price_usd_override === null
                ? null
                : String(variant.price_usd_override),
            priceBsOverride:
              variant.price_bs_override === null
                ? null
                : String(variant.price_bs_override),
            currentStock: variant.current_stock,
            isActive: variant.is_active,
            syncedAt: new Date(),
          },
        });
    }
  }

  private async syncImages(
    productCacheId: string,
    productImageUrl: string | null,
    variants: VeloxProductVariant[],
  ): Promise<void> {
    // Build the deduped image list:
    // 1. parent product image (isPrimary)
    // 2. variant images (one entry per color, by variant)
    const seen = new Set<string>();
    const imageRows: Array<{
      url: string;
      sortOrder: number;
      isPrimary: boolean;
    }> = [];

    const parentImage = this.normalizeVeloxImageUrl(productImageUrl);
    if (parentImage) {
      seen.add(parentImage);
      imageRows.push({ url: parentImage, sortOrder: 0, isPrimary: true });
    }

    let order = 1;
    for (const variant of variants) {
      const url = this.normalizeVeloxImageUrl(variant.image_url);
      if (url && !seen.has(url)) {
        seen.add(url);
        imageRows.push({ url, sortOrder: order++, isPrimary: false });
      }
      for (const additional of variant.additional_images ?? []) {
        const norm = this.normalizeVeloxImageUrl(additional);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          imageRows.push({ url: norm, sortOrder: order++, isPrimary: false });
        }
      }
    }

    // Replace all images for this product. Simpler than diffing and
    // acceptable because the list is small.
    await db
      .delete(schema.productImageCache)
      .where(eq(schema.productImageCache.productId, productCacheId));

    if (imageRows.length > 0) {
      await db.insert(schema.productImageCache).values(
        imageRows.map((row) => ({
          productId: productCacheId,
          url: row.url,
          sortOrder: row.sortOrder,
          isPrimary: row.isPrimary,
        })),
      );
    }
  }

  private async deactivateMissingProducts(activeIds: Set<string>): Promise<number> {
    const allCached = await db
      .select({ veloxId: schema.productCache.veloxId })
      .from(schema.productCache)
      .where(eq(schema.productCache.isActive, true));

    let deactivatedCount = 0;

    for (const row of allCached) {
      if (!activeIds.has(row.veloxId)) {
        await db
          .update(schema.productCache)
          .set({ isActive: false, syncedAt: new Date() })
          .where(eq(schema.productCache.veloxId, row.veloxId));
        deactivatedCount++;
      }
    }

    return deactivatedCount;
  }

  private generateSlug(name: string, sku: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${base}-${sku.toLowerCase()}`;
  }

  private normalizeVeloxImageUrl(imageUrl: string | null | undefined): string | null {
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
}

export const productSyncService = ProductSyncService.getInstance();
export default ProductSyncService;

function normalizeMetadata(value: unknown): ProductSyncMetadata {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ProductSyncMetadata;
  }

  return {};
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
