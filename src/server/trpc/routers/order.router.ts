import { z } from 'zod';
import { eq, and, desc, inArray, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import * as schema from '@/../drizzle/schema';
import type { TRPCContext } from '@/server/trpc/init';
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from '@/server/trpc/init';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
} from '@/schemas/order.schema';
import { orderNumberService } from '@/server/services/order-number.service';
import type { VeloxWebOrderPayload } from '@/server/services/velox-pos.service';
import { calculateShippingCost, SHIPPING_CONFIG } from '@/server/services/shipping.service';
import {
  resolveLookbookSaleRecipe,
  type LookbookSaleRecipe,
  type LookbookSaleRule,
} from '@/server/services/lookbook-recipe.service';

export const orderRouter = createTRPCRouter({
  /**
   * Create a new order.
   *
   * Flow (storefront v2):
   * 1. Re-validate stock against Velox for each item (per variant when
   *    available). Fail fast with 400 if any item is short.
   * 2. Persist order + orderItems in a single transaction.
   * 3. Enqueue the upsertWebOrder call in the outbox with `order.id` as
   *    the idempotency key. The outbox worker is the only thing that
   *    talks to Velox from this point on — this handler returns 201
   *    immediately so the customer can keep moving.
   * 4. Track sync state in `ordersSync` for the admin UI.
   */
  getShippingCost: publicProcedure
    .input(
      z.object({
        state: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
        itemsTotalUsd: z.number(),
        totalQuantity: z.number(),
      })
    )
    .query(({ input }) => {
      return calculateShippingCost(input);
    }),

  create: publicProcedure
    .input(createOrderSchema)
    .mutation(async ({ ctx, input }) => {
      let exchangeRate: number;
      try {
        exchangeRate = await ctx.veloxService.getCurrentExchangeRate();
      } catch (error) {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: `No se pudo consultar la tasa vigente de Velox: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }

      const resolvedItems = await resolveOrderItems(ctx, input, exchangeRate);
      const lookbookSale = input.lookbookSlug
        ? await validateLookbookSale(ctx, input.lookbookSlug, resolvedItems)
        : null;

      // 1) Stock re-validation. Each item can have a variantId; we
      //    call Velox for the parent product and (when relevant) the
      //    variant. A 4xx from Velox here means the storefront cache
      //    is stale — we reject the order with a friendly message.
      for (const item of resolvedItems) {
        try {
          const stock = await ctx.veloxService.getStock(
            item.productId,
            item.veloxVariantId ?? undefined,
          );
          if (stock.current_stock < item.quantity) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Stock insuficiente para ${item.productId}${
                item.veloxVariantId ? ` (variante ${item.veloxVariantId})` : ''
              }. Disponible: ${stock.current_stock}, solicitado: ${item.quantity}`,
            });
          }
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'SERVICE_UNAVAILABLE',
            message: `No se pudo validar el stock en Velox: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          // If Velox is unreachable, we still allow the order to be
          // recorded locally — the outbox worker will retry stock
          // verification when it pushes to Velox.
        }
      }

      const customerId = await resolveCustomerId(ctx, input);
      const orderNumber = await orderNumberService.generate();

      // Calculate item totals
      let itemsTotalUsd = 0;
      let totalQuantity = 0;
      for (const item of resolvedItems) {
        itemsTotalUsd += item.unitPriceUsd * item.quantity;
        totalQuantity += item.quantity;
      }

      const shipping = calculateShippingCost({
        state: input.deliveryState,
        city: input.deliveryCity,
        lat: input.deliveryLat,
        lng: input.deliveryLng,
        itemsTotalUsd,
        totalQuantity,
      });

      const subtotalUsd = itemsTotalUsd;
      const totalUsd = Number((subtotalUsd + shipping.totalFee).toFixed(2));
      const totalBss = Number((totalUsd * exchangeRate).toFixed(2));

      // Inject delivery item if there is a fee
      if (shipping.totalFee > 0) {
        resolvedItems.push({
          productId: SHIPPING_CONFIG.VELOX_DELIVERY_PRODUCT_ID,
          veloxVariantId: null,
          productSku: 'DELIVERY-FEE',
          variantSku: null,
          size: null,
          color: null,
          productName: `Costo de Envío${shipping.isLocal ? ' Local' : ' Nacional'}${shipping.volumeSurcharge > 0 ? ' (+Volumen)' : ''}`,
          quantity: 1,
          unitPriceUsd: shipping.totalFee,
          unitPriceBs: Number((shipping.totalFee * exchangeRate).toFixed(2)),
        });
      }

      const idempotencyKey = randomUUID();

      const methodMap: Record<string, 'PAGO_MOVIL' | 'TRANSFER' | 'ZELLE' | 'CASH_USD' | 'CASH_BSS' | 'BINANCE'> = {
        pago_movil: 'PAGO_MOVIL',
        transferencia: 'TRANSFER',
        zelle: 'ZELLE',
        binance: 'BINANCE',
        zinli: 'CASH_USD',
        wally: 'CASH_USD',
        efectivo_usd: 'CASH_USD',
        punto_venta: 'CASH_BSS', // Map custom methods to enums
      };

      const dbMethod = methodMap[input.paymentMethod] ?? 'CASH_USD';
      const paymentAmount = input.currency === 'USD' ? totalUsd : totalBss;
      const paymentCurrency = input.currency === 'USD' ? 'USD' : 'BSS';

      const order = await ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .insert(schema.orders)
          .values({
            orderNumber,
            customerId,
            status: 'PENDING',
            subtotalUsd: String(subtotalUsd),
            discountUsd: '0',
            totalUsd: String(totalUsd),
            totalBss: String(totalBss),
            exchangeRateUsed: String(exchangeRate),
            shippingAddressId: normalizeOptionalUuid(input.shippingAddressId),
            deliveryMethod: input.deliveryMethod,
            deliveryAddressText: input.deliveryAddressText ?? null,
            deliveryLat:
              input.deliveryLat === undefined ? null : String(input.deliveryLat),
            deliveryLng:
              input.deliveryLng === undefined ? null : String(input.deliveryLng),
            customerNotes: input.note ?? null,
            lookbookId: lookbookSale?.lookbookId ?? null,
            lookbookSlug: lookbookSale?.slug ?? null,
            lookbookTitle: lookbookSale?.title ?? null,
            idempotencyKey,
          })
          .returning();

        if (!order) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'No se pudo crear el pedido',
          });
        }

        await tx.insert(schema.orderItems).values(
          resolvedItems.map((item) => ({
            orderId: order.id,
            veloxProductId: item.productId,
            variantId: item.veloxVariantId,
            variantSku: item.variantSku,
            lookbookItemId: item.lookbookItemId ?? null,
            lookbookRole: item.lookbookRole ?? null,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity,
            unitPriceUsd: String(item.unitPriceUsd),
            unitPriceBs: String(item.unitPriceBs),
            totalUsd: String(item.unitPriceUsd * item.quantity),
          })),
        );

        await tx.insert(schema.payments).values({
          orderId: order.id,
          method: dbMethod,
          amount: String(paymentAmount),
          currency: paymentCurrency,
          status: 'PENDING',
        });

        const payload: VeloxWebOrderPayload = {
          source: 'clazico',
          external_order_id: order.id,
          external_order_number: order.orderNumber,
          status: 'PENDING_PAYMENT',
          customer: {
            name: input.customerName,
            email: input.customerEmail,
            phone: input.customerPhone ?? null,
            document_id: input.customerDocumentId ?? null,
          },
          items: resolvedItems.map((item) => ({
            product_id: item.productId,
            variant_id: item.veloxVariantId ?? undefined,
            sku: item.variantSku ?? item.productSku,
            name: item.productName,
            quantity: item.quantity,
            unit_price_usd: item.unitPriceUsd,
            unit_price_bs: item.unitPriceBs,
            size: item.size ?? undefined,
            color: item.color ?? undefined,
          })),
          subtotal_usd: subtotalUsd,
          total_usd: totalUsd,
          total_bs: totalBss,
          exchange_rate: exchangeRate,
          delivery_method: input.deliveryMethod,
          delivery: {
            state: input.deliveryState ?? null,
            city: input.deliveryCity ?? null,
            address_line: input.deliveryAddressText ?? null,
            lat: input.deliveryLat ?? null,
            lng: input.deliveryLng ?? null,
            map_provider:
              input.deliveryLat !== undefined && input.deliveryLng !== undefined
                ? 'openstreetmap'
                : null,
            notes: input.note ?? null,
          },
          payment: ['PAGO_MOVIL', 'TRANSFER', 'ZELLE'].includes(dbMethod)
            ? {
                method: dbMethod as 'PAGO_MOVIL' | 'TRANSFER' | 'ZELLE',
                reference: null,
                bank: null,
                currency: paymentCurrency === 'BSS' ? 'BS' : paymentCurrency,
                amount_usd: input.currency === 'USD' ? paymentAmount : totalUsd,
                amount_bs: input.currency === 'BS' ? paymentAmount : totalBss,
                reported_at: null,
              }
            : null,
          notes: formatOrderNotes(input.note, lookbookSale),
        };

        await tx.insert(schema.outbox).values({
          type: 'web_order.upsert',
          aggregateId: order.id,
          payload: payload as unknown as Record<string, unknown>,
          idempotencyKey,
          status: 'pending',
          attempts: 0,
          maxAttempts: 10,
          nextAttemptAt: new Date(),
        });

        await tx.insert(schema.ordersSync).values({
          orderId: order.id,
          syncStatus: 'pending',
        });

        return order;
      });

      const { flushOutboxBestEffort } = await import('@/server/services/outbox-worker');
      await flushOutboxBestEffort('order.create', order.id);

      return order;
    }),

  /**
   * Update order status (admin only).
   */
  updateStatus: adminProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, input.orderId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pedido no encontrado',
        });
      }

      // Map lowercase string status to uppercase enum
      const statusMap: Record<string, 'PENDING' | 'PAYMENT_UPLOADED' | 'PAYMENT_VERIFIED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'> = {
        pending: 'PENDING',
        payment_pending: 'PENDING',
        payment_submitted: 'PAYMENT_UPLOADED',
        payment_verified: 'PAYMENT_VERIFIED',
        processing: 'PROCESSING',
        shipped: 'SHIPPED',
        delivered: 'DELIVERED',
        cancelled: 'CANCELLED',
        refunded: 'REFUNDED',
      };

      const dbStatus = statusMap[input.status] ?? 'PENDING';

      const [updated] = await ctx.db
        .update(schema.orders)
        .set({
          status: dbStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, input.orderId))
        .returning();

      // Log status history
      await ctx.db.insert(schema.orderStatusHistory).values({
        orderId: input.orderId,
        status: dbStatus,
        notes: input.reason ?? null,
      });

      return updated;
    }),

  /**
   * List orders (admin).
   */
  list: adminProcedure
    .input(listOrdersSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        const statusMap: Record<string, 'PENDING' | 'PAYMENT_UPLOADED' | 'PAYMENT_VERIFIED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'> = {
          pending: 'PENDING',
          payment_pending: 'PENDING',
          payment_submitted: 'PAYMENT_UPLOADED',
          payment_verified: 'PAYMENT_VERIFIED',
          processing: 'PROCESSING',
          shipped: 'SHIPPED',
          delivered: 'DELIVERED',
          cancelled: 'CANCELLED',
          refunded: 'REFUNDED',
        };
        conditions.push(eq(schema.orders.status, statusMap[input.status]));
      }

      if (input.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(
          sql`(${schema.orders.orderNumber} ILIKE ${searchTerm})`,
        );
      }
      if (input.startDate) {
        conditions.push(sql`${schema.orders.createdAt} >= ${input.startDate}`);
      }
      if (input.endDate) {
        conditions.push(sql`${schema.orders.createdAt} <= ${input.endDate}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await ctx.db
        .select()
        .from(schema.orders)
        .where(whereClause)
        .orderBy(desc(schema.orders.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.orders)
        .where(whereClause);

      return {
        items,
        total: countResult?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Get a single order by ID (admin or owner).
   */
  getById: protectedProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pedido no encontrado',
        });
      }

      // Ensure user owns the order or is admin
      const isAdmin = ctx.session.user.role === 'admin';
      if (order.customerId !== ctx.session.user.id && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No tienes acceso a este pedido',
        });
      }

      // Fetch order items
      const items = await ctx.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));

      return { ...order, items };
    }),

  /**
   * Get current user's orders.
   */
  myOrders: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
        status: z
          .enum([
            'pending',
            'payment_pending',
            'payment_submitted',
            'payment_verified',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded',
          ])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const customerId = ctx.session.user.id;

      const conditions = [eq(schema.orders.customerId, customerId)];
      if (input.status) {
        const statusMap: Record<string, 'PENDING' | 'PAYMENT_UPLOADED' | 'PAYMENT_VERIFIED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'> = {
          pending: 'PENDING',
          payment_pending: 'PENDING',
          payment_submitted: 'PAYMENT_UPLOADED',
          payment_verified: 'PAYMENT_VERIFIED',
          processing: 'PROCESSING',
          shipped: 'SHIPPED',
          delivered: 'DELIVERED',
          cancelled: 'CANCELLED',
          refunded: 'REFUNDED',
        };
        conditions.push(eq(schema.orders.status, statusMap[input.status]));
      }

      const orders = await ctx.db
        .select()
        .from(schema.orders)
        .where(and(...conditions))
        .orderBy(desc(schema.orders.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const orderIds = orders.map((order) => order.id);
      const orderItems =
        orderIds.length === 0
          ? []
          : await ctx.db
              .select()
              .from(schema.orderItems)
              .where(inArray(schema.orderItems.orderId, orderIds));

      const itemsByOrder = new Map<string, typeof orderItems>();
      for (const item of orderItems) {
        const current = itemsByOrder.get(item.orderId) ?? [];
        current.push(item);
        itemsByOrder.set(item.orderId, current);
      }

      const [countResult] = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.orders)
        .where(and(...conditions));

      return {
        items: orders.map((order) => ({
          ...order,
          items: itemsByOrder.get(order.id) ?? [],
        })),
        total: countResult?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
  }),
});

async function resolveCustomerId(
  ctx: TRPCContext,
  input: z.infer<typeof createOrderSchema>,
): Promise<string> {
  if (ctx.session?.user?.id) {
    await ctx.db
      .update(schema.users)
      .set({
        name: input.customerName,
        email: input.customerEmail.trim().toLowerCase(),
        phone: input.customerPhone ?? null,
        cedula: input.customerDocumentId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, ctx.session.user.id));

    return ctx.session.user.id;
  }

  const email = input.customerEmail.trim().toLowerCase();
  const [existing] = await ctx.db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    await ctx.db
      .update(schema.users)
      .set({
        name: input.customerName,
        phone: input.customerPhone ?? null,
        cedula: input.customerDocumentId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing.id));

    return existing.id;
  }

  const id = randomUUID();
  await ctx.db.insert(schema.users).values({
    id,
    name: input.customerName,
    email,
    emailVerified: false,
    role: 'customer',
    phone: input.customerPhone ?? null,
    cedula: input.customerDocumentId ?? null,
  });

  return id;
}

function normalizeOptionalUuid(value: string | undefined): string | null {
  if (!value || value === '00000000-0000-0000-0000-000000000000') {
    return null;
  }

  return value;
}

interface ResolvedOrderItem {
  productId: string;
  veloxVariantId: string | null;
  variantSku: string | null;
  size: string | null;
  color: string | null;
  productName: string;
  productSku: string;
  quantity: number;
  unitPriceUsd: number;
  unitPriceBs: number;
  lookbookItemId?: string | null;
  lookbookRole?: string | null;
}

async function resolveOrderItems(
  ctx: TRPCContext,
  input: z.infer<typeof createOrderSchema>,
  exchangeRate: number,
): Promise<ResolvedOrderItem[]> {
  const resolved: ResolvedOrderItem[] = [];

  for (const item of input.items) {
    const [product] = await ctx.db
      .select()
      .from(schema.productCache)
      .where(
        and(
          eq(schema.productCache.veloxId, item.productId),
          eq(schema.productCache.isActive, true),
        ),
      )
      .limit(1);

    if (!product) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `El producto ${item.productId} ya no está disponible`,
      });
    }

    const requestedVariantId =
      item.variantId &&
      !item.variantId.startsWith('product::') &&
      !item.variantId.startsWith('legacy::')
        ? item.variantId
        : null;

    const [variant] = requestedVariantId
      ? await ctx.db
          .select()
          .from(schema.productVariants)
          .where(
            and(
              eq(schema.productVariants.productCacheId, product.id),
              eq(schema.productVariants.isActive, true),
              or(
                eq(schema.productVariants.id, requestedVariantId),
                eq(schema.productVariants.veloxVariantId, requestedVariantId),
              ),
            ),
          )
          .limit(1)
      : [];

    if (requestedVariantId && !variant) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `La variante ${requestedVariantId} ya no está disponible`,
      });
    }

    const unitPriceUsd = Number(variant?.priceUsdOverride ?? product.priceUsd);
    resolved.push({
      productId: product.veloxId,
      veloxVariantId: variant?.veloxVariantId ?? null,
      variantSku: variant?.sku ?? null,
      size: variant?.size ?? item.size ?? null,
      color: variant?.color ?? item.color ?? null,
      productName: product.name,
      productSku: product.sku,
      quantity: item.quantity,
      unitPriceUsd,
      unitPriceBs: Number((unitPriceUsd * exchangeRate).toFixed(2)),
      lookbookItemId: null,
      lookbookRole: null,
    });
  }

  return resolved;
}

async function validateLookbookSale(
  ctx: TRPCContext,
  slug: string,
  items: ResolvedOrderItem[],
): Promise<LookbookSaleRecipe> {
  const recipe = await resolveLookbookSaleRecipe(ctx.db, slug);
  if (!recipe) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Este lookbook no tiene una receta de venta activa',
    });
  }

  if (recipe.rules.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Este lookbook no tiene piezas vendibles configuradas',
    });
  }

  const customerItems = items.filter(
    (item) => item.productId !== SHIPPING_CONFIG.VELOX_DELIVERY_PRODUCT_ID,
  );

  for (const item of customerItems) {
    const rule = findMatchingLookbookRule(recipe.rules, item);
    if (!rule) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${item.productName} no pertenece al lookbook ${recipe.title}`,
      });
    }

    if (item.quantity < rule.minQuantity || item.quantity > rule.maxQuantity) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${item.productName} debe comprarse en cantidad ${rule.minQuantity}-${rule.maxQuantity} dentro del lookbook ${recipe.title}`,
      });
    }

    item.lookbookItemId = rule.id;
    item.lookbookRole = rule.role;
  }

  for (const rule of recipe.rules) {
    if (!rule.isRequired) continue;

    const quantity = customerItems
      .filter((item) => ruleMatchesResolvedItem(rule, item))
      .reduce((sum, item) => sum + item.quantity, 0);

    if (quantity < rule.minQuantity) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `El lookbook ${recipe.title} requiere ${rule.productName}`,
      });
    }
  }

  return recipe;
}

function findMatchingLookbookRule(
  rules: LookbookSaleRule[],
  item: ResolvedOrderItem,
): LookbookSaleRule | undefined {
  return rules.find((rule) => ruleMatchesResolvedItem(rule, item));
}

function ruleMatchesResolvedItem(
  rule: LookbookSaleRule,
  item: ResolvedOrderItem,
): boolean {
  if (rule.productId !== item.productId) return false;
  return !rule.variantId || rule.variantId === item.veloxVariantId;
}

function formatOrderNotes(note: string | undefined, lookbookSale: LookbookSaleRecipe | null): string | null {
  const parts = [
    note?.trim() || null,
    lookbookSale ? `Lookbook: ${lookbookSale.title} (${lookbookSale.slug})` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : null;
}
