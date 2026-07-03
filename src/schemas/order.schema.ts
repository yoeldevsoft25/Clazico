import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es requerido'),
  variantId: z.string().optional(),
  lookbookItemId: z.string().optional(),
  lookbookRole: z.string().max(100).optional(),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  unitPriceUsd: z.number().positive('El precio unitario USD debe ser mayor a 0'),
  unitPriceBs: z.number().positive('El precio unitario Bs debe ser mayor a 0'),
  size: z.string().optional(),
  color: z.string().optional(),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, 'El pedido debe tener al menos un producto'),
  lookbookSlug: z.string().min(1).max(300).optional(),
  shippingAddressId: z.string().optional(),
  billingAddressId: z.string().optional(),
  currency: z.enum(['USD', 'BS']),
  exchangeRate: z.number().positive('La tasa de cambio debe ser positiva'),
  paymentMethod: z.enum([
    'pago_movil',
    'transferencia',
    'zelle',
    'binance',
    'zinli',
    'wally',
    'efectivo_usd',
    'punto_venta',
  ]),
  note: z.string().max(500, 'La nota no debe exceder 500 caracteres').optional(),
  customerName: z.string().min(1, 'El nombre del cliente es requerido').max(200),
  customerEmail: z.string().email('Correo inválido').max(255),
  customerDocumentId: z.string().optional(),
  customerPhone: z
    .string()
    .trim()
    .min(10, 'Indica un WhatsApp disponible para coordinar tu pedido')
    .refine((value) => value.replace(/\D/g, '').length >= 10, {
      message: 'Indica un WhatsApp válido con código de operadora',
    }),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  deliveryState: z.string().max(100).optional(),
  deliveryCity: z.string().max(100).optional(),
  deliveryAddressText: z.string().max(800).optional(),
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
}).superRefine((value, ctx) => {
  const isNationalShipping =
    value.deliveryMethod === 'DELIVERY' &&
    /^env[ií]o nacional/i.test(value.note ?? '');

  if (isNationalShipping && value.paymentMethod === 'efectivo_usd') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['paymentMethod'],
      message: 'El envío nacional no permite pago en efectivo',
    });
  }
});

export const orderStatusEnum = z.enum([
  'pending',
  'payment_pending',
  'payment_submitted',
  'payment_verified',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, 'El ID del pedido es requerido'),
  status: orderStatusEnum,
  reason: z.string().max(500).optional(),
  trackingNumber: z.string().max(100).optional(),
});

export const listOrdersSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  status: orderStatusEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderStatus = z.infer<typeof orderStatusEnum>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
