import { z } from 'zod';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import * as schema from '@/../drizzle/schema';
import {
  createTRPCRouter,
  publicProcedure,
} from '@/server/trpc/init';

export const productRouter = createTRPCRouter({
  /**
   * List products with pagination, filtering, and sorting.
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(250).default(20),
        offset: z.number().int().min(0).default(0),
        category: z.string().optional(),
        sortBy: z.enum(['name', 'price', 'newest']).default('newest'),
        minPrice: z.number().min(0).optional(),
        maxPrice: z.number().min(0).optional(),
        inStock: z.boolean().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const {
        limit = 20,
        offset = 0,
        category,
        sortBy = 'newest',
        minPrice,
        maxPrice,
        inStock,
      } = input ?? {};

      const conditions = [eq(schema.productCache.isActive, true)];

      if (category) {
        conditions.push(eq(schema.productCache.category, category));
      }
      if (minPrice !== undefined) {
        conditions.push(sql`CAST(${schema.productCache.priceUsd} AS REAL) >= ${minPrice}`);
      }
      if (maxPrice !== undefined) {
        conditions.push(sql`CAST(${schema.productCache.priceUsd} AS REAL) <= ${maxPrice}`);
      }
      if (inStock) {
        conditions.push(sql`${schema.productCache.currentStock} > 0`);
      }

      const orderByClause =
        sortBy === 'name'
          ? asc(schema.productCache.name)
          : sortBy === 'price'
            ? asc(schema.productCache.priceUsd)
            : desc(schema.productCache.createdAt);

      const products = await ctx.db
        .select()
        .from(schema.productCache)
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.productCache)
        .where(and(...conditions));

      return {
        items: products,
        total: countResult?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Get a single product by slug, including its variants (size/color/stock).
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .select()
        .from(schema.productCache)
        .where(
          and(
            eq(schema.productCache.slug, input.slug),
            eq(schema.productCache.isActive, true),
          ),
        )
        .limit(1);

      if (!product) {
        return null;
      }

      // Fetch variants + images for the storefront v2 PDP selector.
      const [variants, images] = await Promise.all([
        ctx.db
          .select()
          .from(schema.productVariants)
          .where(
            and(
              eq(schema.productVariants.productCacheId, product.id),
              eq(schema.productVariants.isActive, true),
            ),
          )
          .orderBy(
            asc(schema.productVariants.sortOrder),
            asc(schema.productVariants.size),
          ),
        ctx.db
          .select()
          .from(schema.productImageCache)
          .where(eq(schema.productImageCache.productId, product.id))
          .orderBy(
            asc(schema.productImageCache.sortOrder),
          ),
      ]);

      // Optionally fetch real-time stock from Velox (parent product only —
      // per-variant stock already comes from the local cache).
      try {
        const stockData = await ctx.veloxService.getStock(product.veloxId);
        return {
          ...product,
          variants,
          images,
          currentStock: stockData.current_stock,
        };
      } catch {
        return {
          ...product,
          variants,
          images,
        };
      }
    }),

  /**
   * Search products by name, SKU, or barcode.
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const searchTerm = `%${input.query}%`;

      const products = await ctx.db
        .select()
        .from(schema.productCache)
        .where(
          and(
            eq(schema.productCache.isActive, true),
            sql`(
              ${schema.productCache.name} ILIKE ${searchTerm} OR
              ${schema.productCache.sku} ILIKE ${searchTerm} OR
              ${schema.productCache.barcode} ILIKE ${searchTerm}
            )`,
          ),
        )
        .orderBy(asc(schema.productCache.name))
        .limit(input.limit);

      return products;
    }),

  /**
   * Get featured / highlighted products.
   */
  featured: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(20).default(8),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 8;

      const products = await ctx.db
        .select()
        .from(schema.productCache)
        .where(
          and(
            eq(schema.productCache.isActive, true),
            eq(schema.productCache.isFeatured, true),
          ),
        )
        .orderBy(desc(schema.productCache.createdAt))
        .limit(limit);

      return products;
    }),

  /**
   * Get all unique categories.
   */
  categories: publicProcedure.query(async ({ ctx }) => {
    const categories = await ctx.db
      .selectDistinct({ category: schema.productCache.category })
      .from(schema.productCache)
      .where(eq(schema.productCache.isActive, true))
      .orderBy(asc(schema.productCache.category));

    return categories.map((c) => c.category);
  }),
});
