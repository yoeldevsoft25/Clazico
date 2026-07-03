'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Loader2,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { STORE_INFO } from '@/lib/constants';
import { useTRPC } from '@/lib/trpc-client';
import { cn, formatBsS, formatDate, formatUSD } from '@/lib/utils';

export default function ProfilePage() {
  const trpc = useTRPC();
  const { data: session, isPending } = useSession();
  const ordersQuery = useQuery(
    {
      ...trpc.order.myOrders.queryOptions({ limit: 20, offset: 0 }),
      enabled: Boolean(session?.user),
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  );

  const orders = ordersQuery.data?.items ?? [];

  return (
    <div className="min-h-dvh bg-zinc-950 pb-28 text-white md:pb-44">
      <section className="store-shell pt-12 md:pt-20">
        <p className="athletic-tag text-brand-primary">Cuenta Clazico</p>
        <h1 className="mt-2 font-outfit text-4xl font-black uppercase italic leading-none text-white md:text-6xl tracking-tight">
          Mi Cuenta
        </h1>

        {isPending ? (
          <div className="mt-8 border border-white/5 bg-zinc-900/30 p-6">
            <div className="h-6 w-40 rounded-full bg-white/10 animate-pulse" />
            <div className="mt-4 h-4 w-64 max-w-full rounded-full bg-white/10 animate-pulse" />
          </div>
        ) : session?.user ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            
            {/* Club Card / User Details */}
            <section className="border border-white/5 bg-zinc-900/30 p-5 md:p-8">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="grid h-16 w-16 place-items-center rounded-none bg-brand-primary text-white font-outfit font-black italic text-xl">
                  {session.user.name?.[0]?.toUpperCase() || 'C'}
                </div>
                <div className="min-w-0">
                  <p className="font-outfit text-xl font-black uppercase italic tracking-tight text-white">
                    {session.user.name || 'Cliente Clazico'}
                  </p>
                  <p className="truncate text-xs font-semibold text-zinc-500 font-mono mt-1">{session.user.email}</p>
                  
                  {/* Status Badge */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Miembro Club Activo
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoTile icon={ShieldCheck} title="Pago Verificado" text="Tus comprobantes se validan manualmente con el banco de origen en Venezuela." />
                <InfoTile icon={PackageCheck} title="Tus Pedidos" text="Las compras realizadas con esta cuenta quedan vinculadas a tu usuario." />
              </div>

              <button
                onClick={() => signOut()}
                className="mt-8 h-12 w-full border border-white/10 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white transition-all cursor-pointer rounded-none"
              >
                Cerrar Sesión
              </button>
            </section>

            <OrdersPanel
              isLoading={ordersQuery.isLoading}
              isError={ordersQuery.isError}
              orders={orders}
              total={ordersQuery.data?.total ?? 0}
            />
          </div>
        ) : (
          <div className="mt-8 border border-white/5 bg-zinc-900/30 p-6 text-center max-w-xl mx-auto">
            <div className="mx-auto grid h-16 w-16 place-items-center bg-zinc-950 border border-white/5">
              <UserRound className="h-6 w-6 text-brand-primary" />
            </div>
            <h2 className="mt-5 font-outfit text-xl font-black uppercase italic">Ingresa a tu Cuenta</h2>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-zinc-500 uppercase tracking-wider font-bold">
              Inicia sesión para guardar tus datos, agilizar el checkout y asociar tus pagos directamente en el POS.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center justify-center border border-white bg-white px-8 text-xs font-black uppercase tracking-widest text-zinc-950 hover:bg-transparent hover:text-white transition-colors"
            >
              Entrar
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

type OrderSummaryRow = {
  id: string;
  orderNumber: string;
  status: string;
  totalUsd: string | number;
  totalBss: string | number | null;
  deliveryMethod: string;
  deliveryAddressText: string | null;
  customerNotes: string | null;
  createdAt: Date | string;
  items?: Array<{
    id: string;
    productName: string;
    productSku: string;
    variantSku: string | null;
    quantity: number;
    totalUsd: string | number;
  }>;
};

type OrdersPanelProps = {
  isLoading: boolean;
  isError: boolean;
  orders: OrderSummaryRow[];
  total: number;
};

type InfoTileProps = {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
};

function InfoTile({ icon: Icon, title, text }: InfoTileProps) {
  return (
    <div className="border border-white/5 bg-zinc-950 p-4">
      <Icon className="h-5 w-5 text-brand-primary animate-pulse" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-white">{title}</p>
      <p className="mt-1.5 text-[10px] leading-5 font-bold uppercase tracking-wider text-zinc-500">{text}</p>
    </div>
  );
}

function OrdersPanel({ isLoading, isError, orders, total }: OrdersPanelProps) {
  return (
    <section className="border border-white/5 bg-zinc-900/30 p-5 md:p-8">
      <div className="flex flex-col gap-3 border-b border-white/5 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-outfit text-lg font-black uppercase italic tracking-wider text-white">
            Mis Pedidos
          </h2>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Historial vinculado a tu cuenta Clazico
          </p>
        </div>
        {total > 0 && (
          <span className="inline-flex h-8 w-fit items-center border border-white/10 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {total} {total === 1 ? 'orden' : 'ordenes'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid min-h-56 place-items-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            <p className="athletic-tag text-zinc-500">Cargando pedidos...</p>
          </div>
        </div>
      ) : isError ? (
        <div className="mt-5 border border-brand-primary/20 bg-brand-primary/10 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-brand-primary">
            No pudimos cargar tus pedidos. Intenta nuevamente en unos segundos.
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-5 grid min-h-56 place-items-center border border-white/5 bg-zinc-950 p-6 text-center">
          <div className="max-w-sm">
            <PackageOpen className="mx-auto h-9 w-9 text-zinc-600" />
            <p className="mt-4 font-outfit text-lg font-black uppercase italic text-white">
              Sin pedidos todavia
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase leading-5 tracking-wider text-zinc-500">
              Cuando compres con esta sesion activa, tus ordenes apareceran aqui.
            </p>
            <Link
              href="/catalog"
              className="mt-5 inline-flex h-11 items-center justify-center border border-white bg-white px-6 text-xs font-black uppercase tracking-widest text-zinc-950 transition-colors hover:bg-transparent hover:text-white"
            >
              Ver Catalogo
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
          {total > orders.length && (
            <p className="pt-2 text-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
              Mostrando las ultimas {orders.length} de {total} ordenes
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function OrderRow({ order }: { order: OrderSummaryRow }) {
  const status = getProfileOrderStatus(order.status);
  const totalBss = order.totalBss === null ? null : Number(order.totalBss);
  const delivery = getOrderDeliveryContext(order);
  const orderItems = order.items ?? [];
  const officialPhones = [
    { label: 'WhatsApp Principal', phone: STORE_INFO.phone },
    { label: 'WhatsApp Secundario', phone: STORE_INFO.phone1 },
  ];

  return (
    <article className="border border-white/5 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white">
            <ReceiptText className="h-4 w-4 text-brand-primary" />
            <p className="truncate font-mono text-sm font-black uppercase tracking-wider">
              {order.orderNumber}
            </p>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(order.createdAt)}
            </span>
            <span>{delivery.label}</span>
          </p>
        </div>
        <div className="shrink-0">
          <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            Estado actual
          </p>
          <span className={cn('inline-flex h-8 w-fit items-center border px-3 text-[10px] font-black uppercase tracking-widest', status.className)}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="mt-4 border border-white/5 bg-zinc-900/40 p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Seguimiento
        </p>
        <p className="mt-1.5 text-xs font-bold uppercase leading-5 tracking-wider text-zinc-300">
          {status.description}
        </p>
      </div>

      <div className="mt-4 grid gap-4 border-t border-white/5 pt-4">
        {orderItems.length > 0 && (
          <div className="border border-white/5 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Productos
            </p>
            <div className="mt-3 space-y-2">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-black uppercase tracking-tight text-white">
                      {item.productName}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      SKU {item.productSku}
                      {item.variantSku ? ` · Variante ${item.variantSku}` : ''} · x{item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-xs font-black text-zinc-300">
                    {formatUSD(Number(item.totalUsd))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border border-white/5 bg-zinc-900/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Entrega
          </p>
          <p className="mt-1.5 text-xs font-bold uppercase leading-5 tracking-wider text-zinc-300">
            {delivery.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Total USD</p>
            <p className="mt-1 font-mono text-sm font-black text-white">{formatUSD(Number(order.totalUsd))}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Total Bs</p>
            <p className="mt-1 font-mono text-sm font-black text-zinc-300">
              {totalBss === null ? 'Por confirmar' : formatBsS(totalBss)}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            Coordinar esta orden
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {officialPhones.map((contact) => (
              <a
                key={contact.phone}
                href={buildOrderWhatsAppUrl(contact.phone, order, status.label, delivery.label)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/10 px-4 text-center text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:border-white hover:bg-white hover:text-zinc-950"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>
                  {contact.label}
                  <span className="mt-1 block font-mono text-[9px] tracking-wider opacity-70">
                    {contact.phone}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function buildOrderWhatsAppUrl(
  phone: string,
  order: OrderSummaryRow,
  statusLabel: string,
  deliveryLabel: string,
): string {
  const whatsappPhone = toWhatsappPhone(phone);
  const message = [
    `Hola Clazico Store. Quiero coordinar mi pedido ${order.orderNumber}.`,
    `Estado en la web: ${statusLabel}.`,
    `Entrega: ${deliveryLabel}.`,
    order.deliveryAddressText ? `Dirección/agencia: ${order.deliveryAddressText}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
}

function toWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `58${digits.slice(1)}`;
  if (digits.startsWith('58')) return digits;
  return digits;
}

function getDeliveryMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    PICKUP: 'Retiro en tienda',
    DELIVERY: 'Delivery',
    MRW: 'MRW',
    ZOOM: 'ZOOM',
    TEALCA: 'TEALCA',
  };

  return labels[method] ?? method;
}

function getOrderDeliveryContext(order: OrderSummaryRow): { label: string; description: string } {
  const note = order.customerNotes ?? '';
  if (order.deliveryMethod === 'PICKUP') {
    return {
      label: 'Retiro en tienda',
      description: `Retiro en ${STORE_INFO.address}. Coordina por WhatsApp antes de pasar para confirmar disponibilidad de entrega.`,
    };
  }

  if (note.toLowerCase().startsWith('delivery maracaibo')) {
    return {
      label: 'Delivery Maracaibo',
      description: order.deliveryAddressText
        ? `Delivery local a ${order.deliveryAddressText}. Coordina horario y referencia por WhatsApp.`
        : 'Delivery local en Maracaibo. Coordina dirección, horario y referencia por WhatsApp.',
    };
  }

  if (note.toLowerCase().startsWith('envío nacional') || note.toLowerCase().startsWith('envio nacional')) {
    return {
      label: 'Envío nacional',
      description: order.deliveryAddressText
        ? `Envío nacional a ${order.deliveryAddressText}. Coordina agencia, cédula y guía por WhatsApp.`
        : 'Envío nacional por encomienda. Coordina agencia, cédula y guía por WhatsApp.',
    };
  }

  return {
    label: getDeliveryMethodLabel(order.deliveryMethod),
    description: order.deliveryAddressText
      ? `Entrega registrada: ${order.deliveryAddressText}.`
      : 'Coordina detalles de entrega o retiro por WhatsApp.',
  };
}

function getProfileOrderStatus(status: string): { label: string; description: string; className: string } {
  const statuses: Record<string, { label: string; description: string; className: string }> = {
    PENDING: {
      label: 'Pendiente de pago',
      description: 'Recibimos tu pedido. Falta reportar o validar el pago para continuar con la preparacion.',
      className: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    },
    PAYMENT_UPLOADED: {
      label: 'Pago reportado',
      description: 'Tu comprobante fue recibido. El equipo de Clazico Store esta verificando la transaccion.',
      className: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    },
    PAYMENT_VERIFIED: {
      label: 'Pago verificado',
      description: 'El pago fue verificado. Tu pedido queda listo para pasar a preparacion o despacho.',
      className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    },
    PROCESSING: {
      label: 'Preparando',
      description: 'Estamos preparando tu pedido y confirmando los detalles de entrega o retiro.',
      className: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    },
    SHIPPED: {
      label: 'Enviado',
      description: 'Tu pedido fue enviado. Puedes consultar por WhatsApp si necesitas guia o detalles del despacho.',
      className: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    },
    DELIVERED: {
      label: 'Entregado',
      description: 'El pedido aparece como entregado. Contactanos si necesitas soporte posterior a la compra.',
      className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    },
    CANCELLED: {
      label: 'Cancelado',
      description: 'Este pedido fue cancelado. Puedes contactar a Clazico Store para revisar el motivo.',
      className: 'border-red-400/30 bg-red-400/10 text-red-300',
    },
    REFUNDED: {
      label: 'Reembolsado',
      description: 'Este pedido figura como reembolsado. Contactanos si necesitas soporte sobre el reintegro.',
      className: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-300',
    },
  };

  return (
    statuses[status] ?? {
      label: status,
      description: 'Estado recibido desde Clazico Store. Contactanos por WhatsApp para mas detalles de esta orden.',
      className: 'border-white/10 bg-white/5 text-zinc-300',
    }
  );
}
