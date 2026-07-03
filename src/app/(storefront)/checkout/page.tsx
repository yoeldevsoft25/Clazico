'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Send } from 'lucide-react';
import { useTRPC } from '@/lib/trpc-client';
import { useSession } from '@/lib/auth-client';
import { useCartStore } from '@/stores/cart.store';
import { PAYMENT_DETAILS, STORE_INFO, VENEZUELAN_BANKS } from '@/lib/constants';
import { formatBsS, formatUSD } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DeliveryLocationPicker } from '@/components/checkout/delivery-location-picker';

type CreatedOrder = {
  id: string;
  orderNumber: string;
  totalUsd: number;
  totalBss: number;
};

type PaymentMethod = 'pago_movil' | 'binance' | 'zinli' | 'wally' | 'zelle' | 'efectivo_usd';
type ApiDeliveryMethod = 'PICKUP' | 'DELIVERY';
type DeliveryOption = 'PICKUP' | 'LOCAL_DELIVERY' | 'NATIONAL_SHIPPING';
type CartItem = ReturnType<typeof useCartStore.getState>['items'][number];
type SessionCheckoutUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cedula?: string | null;
};

const paymentLabels: Record<PaymentMethod, string> = {
  pago_movil: 'Pago Móvil',
  binance: 'Binance',
  zinli: 'Zinli',
  wally: 'Wally',
  zelle: 'Zelle',
  efectivo_usd: 'Efectivo USD',
};

const MARACAIBO_STATE = 'Zulia';
const MARACAIBO_CITY = 'Maracaibo';

function toApiDeliveryMethod(deliveryOption: DeliveryOption): ApiDeliveryMethod {
  return deliveryOption === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
}

function isShippingOption(deliveryOption: DeliveryOption): boolean {
  return deliveryOption !== 'PICKUP';
}

function getDeliveryLabel(deliveryOption: DeliveryOption): string {
  if (deliveryOption === 'LOCAL_DELIVERY') return 'Delivery Maracaibo';
  if (deliveryOption === 'NATIONAL_SHIPPING') return 'Envío nacional';
  return 'Retiro en tienda';
}

export default function CheckoutPage() {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const sessionUser = session?.user as SessionCheckoutUser | undefined;
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotalUsd = useCartStore((state) => state.getSubtotalUsd());
  const subtotalBs = useCartStore((state) => state.getSubtotalBs());

  const [step, setStep] = useState<'details' | 'success'>('details');
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const [phone, setPhone] = useState<string | undefined>();
  const [cedula, setCedula] = useState<string | undefined>();
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>('PICKUP');
  const [stateName, setStateName] = useState(MARACAIBO_STATE);
  const [cityName, setCityName] = useState(MARACAIBO_CITY);
  const [deliveryLocation, setDeliveryLocation] = useState({
    lat: 10.6427,
    lng: -71.6125,
    address: 'Maracaibo, Zulia, Venezuela',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pago_movil');
  const [reference, setReference] = useState('');
  const [originBank, setOriginBank] = useState('0134');
  const [accountLastFour, setAccountLastFour] = useState('');

  const createOrderMutation = useMutation(trpc.order.create.mutationOptions());
  const submitPaymentMutation = useMutation(trpc.payment.submit.mutationOptions());

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const lookbookSlugs = Array.from(
    new Set(items.map((item) => item.lookbookSlug).filter(Boolean)),
  ) as string[];
  const activeLookbookSlug = lookbookSlugs.length === 1 ? lookbookSlugs[0] : undefined;

  const { data: shippingData } = useQuery({
    ...trpc.order.getShippingCost.queryOptions({
      state: stateName,
      city: cityName,
      lat: deliveryLocation.lat,
      lng: deliveryLocation.lng,
      itemsTotalUsd: subtotalUsd,
      totalQuantity: totalItems,
    }),
    enabled: items.length > 0 && isShippingOption(deliveryOption),
  });

  const finalShippingFee = isShippingOption(deliveryOption) ? (shippingData?.totalFee ?? 0) : 0;
  const finalTotalUsd = subtotalUsd + finalShippingFee;

  const rate = subtotalUsd > 0 ? subtotalBs / subtotalUsd : 36.715;
  const finalTotalBs = finalTotalUsd * rate;
  const isUsdPayment = paymentMethod !== 'pago_movil';
  const customerName = name ?? sessionUser?.name ?? '';
  const customerEmail = email ?? sessionUser?.email ?? '';
  const customerPhone = phone ?? sessionUser?.phone ?? '';
  const customerCedula = cedula ?? sessionUser?.cedula ?? '';

  const handlePlaceOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (items.length === 0) return;
    if (lookbookSlugs.length > 1) {
      alert('Tu carrito mezcla varios lookbooks. Finaliza un drop a la vez para mantener la venta coherente.');
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 10) {
      alert('Indica un número de WhatsApp disponible para coordinar tu pedido.');
      return;
    }

    try {
      setIsSubmitting(true);
      const order = await createOrderMutation.mutateAsync({
        items: items.map((item) => ({
          productId: item.productId,
          variantId:
            item.legacy || item.variantId.startsWith('product::')
              ? undefined
              : item.variantId,
          lookbookItemId: item.lookbookItemId,
          lookbookRole: item.lookbookRole,
          quantity: item.quantity,
          unitPriceUsd: item.priceUsd,
          unitPriceBs: item.priceBs,
          size: item.size ?? undefined,
          color: item.color ?? undefined,
        })),
        lookbookSlug: activeLookbookSlug,
        shippingAddressId: '00000000-0000-0000-0000-000000000000',
        currency: isUsdPayment ? 'USD' : 'BS',
        exchangeRate: rate,
        paymentMethod,
        deliveryMethod: toApiDeliveryMethod(deliveryOption),
        deliveryState: isShippingOption(deliveryOption) ? stateName : undefined,
        deliveryCity: isShippingOption(deliveryOption) ? cityName : undefined,
        deliveryAddressText:
          isShippingOption(deliveryOption) ? deliveryLocation.address : undefined,
        deliveryLat: deliveryOption === 'LOCAL_DELIVERY' ? deliveryLocation.lat : undefined,
        deliveryLng: deliveryOption === 'LOCAL_DELIVERY' ? deliveryLocation.lng : undefined,
        customerName,
        customerEmail,
        note:
          isShippingOption(deliveryOption)
            ? `${getDeliveryLabel(deliveryOption)}: ${stateName}, ${cityName}. ${deliveryLocation.address}${deliveryOption === 'LOCAL_DELIVERY' ? `. GPS ${deliveryLocation.lat}, ${deliveryLocation.lng}` : ''}`
            : 'Retiro en Tienda',
        customerDocumentId: customerCedula,
        customerPhone,
      });

      setCreatedOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        totalUsd: Number(order.totalUsd ?? finalTotalUsd),
        totalBss: Number(order.totalBss ?? finalTotalBs),
      });

      if (paymentMethod !== 'efectivo_usd') {
        await submitPaymentMutation.mutateAsync({
          orderId: order.id,
          method: paymentMethod,
          reference: reference || `REF-${Date.now().toString().slice(-8)}`,
          amountUsd: finalTotalUsd,
          amountBs: finalTotalBs,
          exchangeRate: rate,
          bankName: getPaymentProcessorName(paymentMethod, originBank),
          accountLastFour: accountLastFour || '0000',
          proofImageUrl: 'https://images.veloxpos.com/mock-receipt.jpg',
        });
      }

      clearCart();
      setStep('success');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error al registrar tu pedido. Verifica los datos e inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success' && createdOrder) {
    const totalString = isUsdPayment
      ? formatUSD(createdOrder.totalUsd)
      : formatBsS(createdOrder.totalBss);
    const storePhone = toWhatsappPhone(STORE_INFO.phone);
    const waText = `Hola Clazico Store. Pedido ${createdOrder.orderNumber} por ${totalString}. Método: ${paymentLabels[paymentMethod]}. Nombre: ${customerName}. WhatsApp disponible: ${customerPhone}. Entrega: ${getDeliveryLabel(deliveryOption)}.`;
    const waUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(waText)}`;

    return (
      <div className="store-shell grid min-h-[calc(100dvh-3.5rem)] place-items-center bg-zinc-950 py-10 text-white">
        <div className="w-full max-w-md text-center border border-white/5 bg-zinc-900/30 p-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 animate-fade-in">
            <CheckCircle className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-outfit text-2xl font-black uppercase italic">Pedido Registrado</h1>
          <p className="athletic-tag text-zinc-500 mt-2">
            Orden <span className="font-mono font-black text-white">{createdOrder.orderNumber}</span>
          </p>
          <p className="mt-4 text-xs leading-6 text-zinc-400 uppercase tracking-wider font-bold">
            Tu compra ha sido almacenada en nuestro sistema. Reporta el pago por WhatsApp para validar la transacción de inmediato.
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 border border-[#25D366] bg-[#25D366] text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-transparent hover:text-[#25D366]"
          >
            <Send className="h-4 w-4" />
            Enviar Comprobante
          </a>
          <Link href="/catalog" className="mt-5 inline-block text-xs font-black uppercase tracking-widest text-brand-primary hover:text-white transition-colors">
            Volver al catálogo
          </Link>
          {session?.user && (
            <Link href="/profile" className="mt-4 block text-xs font-black uppercase tracking-widest text-white hover:text-brand-primary transition-colors">
              Ver mis pedidos
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="store-shell grid min-h-[calc(100dvh-3.5rem)] place-items-center bg-zinc-950 text-center text-white">
        <div>
          <h1 className="font-outfit text-3xl font-black uppercase italic">Carrito Vacío</h1>
          <p className="athletic-tag text-zinc-500 mt-2">Agrega productos para proceder al pago</p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 border border-white bg-white px-7 text-xs font-black uppercase tracking-widest text-zinc-950 hover:bg-transparent hover:text-white transition-colors"
          >
            Explorar catálogo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-white pb-20 md:pb-32">
      <div className="store-shell py-10 md:py-16">
        <Link
          href="/catalog"
          className="inline-flex h-10 items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </Link>

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
            <CheckoutSection title="1. Datos del Cliente">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre Completo">
                  <input
                    required
                    value={customerName}
                    onChange={(event) => setName(event.target.value)}
                    className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                    placeholder="EJ: YOEL PINTO"
                  />
                </Field>
                <Field label="Cédula de Identidad">
                  <input
                    required
                    value={customerCedula}
                    onChange={(event) => setCedula(event.target.value)}
                    className="checkout-input font-mono text-xs font-bold uppercase tracking-wider"
                    placeholder="EJ: V-12345678"
                  />
                </Field>
                <Field
                  label="WhatsApp disponible"
                  hint="Usa un número activo. Desde Mi Cuenta podrás coordinar entrega, guía o retiro con este pedido."
                >
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="checkout-input font-mono text-xs font-bold uppercase tracking-wider"
                    placeholder="EJ: 04120000000"
                  />
                </Field>
                <Field label="Correo Electrónico">
                  <input
                    required
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setEmail(event.target.value)}
                    className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                    placeholder="EJ: CLIENTE@CORREO.COM"
                  />
                </Field>
              </div>
            </CheckoutSection>

            <CheckoutSection title="2. Método de Entrega">
              <div className="grid gap-3 sm:grid-cols-3">
                <ChoiceCard
                  active={deliveryOption === 'PICKUP'}
                  title="Retiro en Tienda"
                  subtitle={`${STORE_INFO.address} Sin costo.`}
                  onClick={() => setDeliveryOption('PICKUP')}
                />
                <ChoiceCard
                  active={deliveryOption === 'LOCAL_DELIVERY'}
                  title="Delivery Maracaibo"
                  subtitle="Solo dentro de Maracaibo. Costo según ubicación."
                  onClick={() => {
                    setDeliveryOption('LOCAL_DELIVERY');
                    setStateName(MARACAIBO_STATE);
                    setCityName(MARACAIBO_CITY);
                  }}
                />
                <ChoiceCard
                  active={deliveryOption === 'NATIONAL_SHIPPING'}
                  title="Envío Nacional"
                  subtitle="Para el resto del país por encomienda o agencia."
                  onClick={() => setDeliveryOption('NATIONAL_SHIPPING')}
                />
              </div>

              {deliveryOption === 'LOCAL_DELIVERY' && (
                <div className="mt-4 grid gap-4 border border-white/5 bg-zinc-950 p-5 sm:grid-cols-2 animate-fade-in">
                  <Field label="Estado">
                    <input
                      required
                      value={stateName}
                      readOnly
                      className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                    />
                  </Field>
                  <Field label="Ciudad">
                    <input
                      required
                      value={cityName}
                      readOnly
                      className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <div className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Ubicación exacta en Maracaibo
                      </span>
                      <DeliveryLocationPicker
                        value={deliveryLocation}
                        onChange={setDeliveryLocation}
                      />
                    </div>
                  </div>
                </div>
              )}

              {deliveryOption === 'NATIONAL_SHIPPING' && (
                <div className="mt-4 grid gap-4 border border-white/5 bg-zinc-950 p-5 sm:grid-cols-2 animate-fade-in">
                  <Field label="Estado">
                    <input
                      required
                      value={stateName}
                      onChange={(event) => setStateName(event.target.value)}
                      className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                      placeholder="EJ: CARABOBO"
                    />
                  </Field>
                  <Field label="Ciudad">
                    <input
                      required
                      value={cityName}
                      onChange={(event) => setCityName(event.target.value)}
                      className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                      placeholder="EJ: VALENCIA"
                    />
                  </Field>
                  <Field label="Dirección / Agencia de Encomienda">
                    <input
                      required
                      value={deliveryLocation.address}
                      onChange={(event) =>
                        setDeliveryLocation((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
                      placeholder="MRW, ZOOM, TEALCA o dirección completa"
                    />
                  </Field>
                  <div className="rounded-none border border-white/10 bg-white/[0.03] p-4 text-[10px] font-bold uppercase leading-5 tracking-wider text-zinc-500 sm:col-span-2">
                    El envío nacional se coordina por encomienda. Costos, tiempos y cobertura dependen del transportista y los datos suministrados.
                  </div>
                </div>
              )}
            </CheckoutSection>

            <CheckoutSection title="3. Registro de Pago">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      'min-h-[44px] border text-xs font-black uppercase tracking-wider transition-all rounded-none cursor-pointer',
                      paymentMethod === method
                        ? 'border-white bg-white text-zinc-950'
                        : 'border-white/10 bg-transparent text-zinc-400 hover:border-white/30 hover:text-white',
                    )}
                  >
                    {paymentLabels[method]}
                  </button>
                ))}
              </div>

              <div className="mt-4 border border-white/5 bg-zinc-950 p-5">
                <PaymentInstructions
                  paymentMethod={paymentMethod}
                  reference={reference}
                  setReference={setReference}
                  originBank={originBank}
                  setOriginBank={setOriginBank}
                  accountLastFour={accountLastFour}
                  setAccountLastFour={setAccountLastFour}
                />
              </div>
            </CheckoutSection>
          </form>

          <aside className="lg:sticky lg:top-24">
            <OrderSummary
              items={items}
              subtotalUsd={subtotalUsd}
              shippingFee={finalShippingFee}
              totalUsd={finalTotalUsd}
              totalBs={finalTotalBs}
              deliveryOption={deliveryOption}
              rate={rate}
              isSubmitting={isSubmitting}
            />
          </aside>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="bottom-above-nav fixed inset-x-0 z-[110] border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl md:hidden">
        <button
          form="checkout-form"
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 border border-white bg-white text-xs font-black uppercase tracking-widest text-zinc-950 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-zinc-950" /> : null}
          Completar compra
        </button>
      </div>
    </div>
  );
}

function toWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `58${digits.slice(1)}`;
  if (digits.startsWith('58')) return digits;
  return digits;
}

function getPaymentProcessorName(paymentMethod: PaymentMethod, originBank: string): string {
  if (paymentMethod === 'pago_movil') {
    const selectedBank = VENEZUELAN_BANKS.find((bank) => bank.code === originBank);
    return selectedBank?.name ?? 'Pago Movil';
  }

  return paymentLabels[paymentMethod];
}

function CheckoutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/5 bg-zinc-900/30 p-5 sm:p-6">
      <h2 className="mb-5 font-outfit text-lg font-black uppercase italic tracking-wider text-white border-b border-white/5 pb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      {children}
      {hint && (
        <span className="mt-2 block text-[10px] font-bold uppercase leading-5 tracking-wider text-zinc-600">
          {hint}
        </span>
      )}
    </label>
  );
}

function ChoiceCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-[72px] border p-4 text-left transition-all cursor-pointer rounded-none',
        active
          ? 'border-white bg-white text-zinc-950'
          : 'border-white/10 bg-transparent text-zinc-400 hover:border-white/30',
      )}
    >
      <span className={cn('block text-xs font-black uppercase tracking-wider', active ? 'text-zinc-950' : 'text-white')}>{title}</span>
      <span className={cn('mt-1 block text-[10px] uppercase font-bold tracking-wide leading-relaxed', active ? 'text-zinc-600' : 'text-zinc-500')}>{subtitle}</span>
    </button>
  );
}

function PaymentInstructions({
  paymentMethod,
  reference,
  setReference,
  originBank,
  setOriginBank,
  accountLastFour,
  setAccountLastFour,
}: {
  paymentMethod: PaymentMethod;
  reference: string;
  setReference: (value: string) => void;
  originBank: string;
  setOriginBank: (value: string) => void;
  accountLastFour: string;
  setAccountLastFour: (value: string) => void;
}) {
  if (paymentMethod === 'efectivo_usd') {
    return (
      <p className="text-xs uppercase tracking-wider font-bold leading-6 text-zinc-400">
        Pagas en divisas en efectivo al retirar en tienda o al recibir tu pedido. Por favor, lleva el monto exacto para agilizar la entrega.
      </p>
    );
  }

  const requiresOriginBank = paymentMethod === 'pago_movil';
  const isZelle = paymentMethod === 'zelle';
  const zelleWhatsappUrl = `https://wa.me/${toWhatsappPhone(STORE_INFO.phone)}?text=${encodeURIComponent(PAYMENT_DETAILS.ZELLE.whatsappMessage)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-xs uppercase tracking-wider font-bold text-zinc-400 sm:grid-cols-2">
        {paymentMethod === 'zelle' ? (
          <div className="sm:col-span-2 rounded-none border border-white/10 bg-white/[0.03] p-4">
            <p className="leading-6">
              Los datos de Zelle se confirman directamente por WhatsApp antes de pagar.
            </p>
            <a
              href={zelleWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 border border-[#25D366] bg-[#25D366] px-4 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-transparent hover:text-[#25D366]"
            >
              <Send className="h-4 w-4" />
              Consultar Zelle por WhatsApp
            </a>
          </div>
        ) : paymentMethod === 'binance' ? (
          <>
            <p>
              Binance: <span className="font-mono font-black text-white">{PAYMENT_DETAILS.BINANCE.username}</span>
            </p>
            <p>
              ID de Usuario: <span className="font-mono font-black text-white">{PAYMENT_DETAILS.BINANCE.userId}</span>
            </p>
            <p>
              Correo: <span className="font-mono font-black text-white normal-case">{PAYMENT_DETAILS.BINANCE.email}</span>
            </p>
          </>
        ) : paymentMethod === 'zinli' ? (
          <p>
            Zinli: <span className="font-mono font-black text-white normal-case">{PAYMENT_DETAILS.ZINLI.email}</span>
          </p>
        ) : paymentMethod === 'wally' ? (
          <p>
            Wally: <span className="font-mono font-black text-white">{PAYMENT_DETAILS.WALLY.phone}</span>
          </p>
        ) : (
          <>
            {PAYMENT_DETAILS.PAGO_MOVIL.map((account) => (
              <div key={`${account.bank}-${account.code}`} className="rounded-none border border-white/10 bg-white/[0.03] p-4">
                <p>
                  Banco: <span className="font-black text-white">{account.bank} - {account.code}</span>
                </p>
                <p className="mt-2">
                  Teléfono: <span className="font-mono font-black text-white">{account.phone}</span>
                </p>
                <p className="mt-2">
                  Cédula: <span className="font-mono font-black text-white">{account.cedula}</span>
                </p>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 border-t border-white/5 pt-4">
        {requiresOriginBank && (
          <Field label="Banco Emisor">
            <select
              value={originBank}
              onChange={(event) => setOriginBank(event.target.value)}
              className="checkout-input font-sans text-xs font-bold uppercase tracking-wider"
            >
              {VENEZUELAN_BANKS.map((bank) => (
                <option key={bank.code} value={bank.code} className="bg-zinc-950 text-white">
                  {bank.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={paymentMethod === 'binance' ? 'TxID / Referencia' : 'Número de Referencia'}>
          <input
            required
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="checkout-input font-mono text-xs font-bold uppercase tracking-wider"
            placeholder={paymentMethod === 'binance' ? 'EJ: TXID123...' : 'EJ: 12345678'}
          />
        </Field>
        {isZelle && (
          <Field label="Últimos 4 Dígitos del Teléfono / Tarjeta">
            <input
              value={accountLastFour}
              onChange={(event) => setAccountLastFour(event.target.value)}
              className="checkout-input font-mono text-xs font-bold uppercase tracking-wider"
              placeholder="EJ: 1234"
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function OrderSummary({
  items,
  subtotalUsd,
  shippingFee,
  totalUsd,
  totalBs,
  deliveryOption,
  rate,
  isSubmitting,
}: {
  items: CartItem[];
  subtotalUsd: number;
  shippingFee: number;
  totalUsd: number;
  totalBs: number;
  deliveryOption: DeliveryOption;
  rate: number;
  isSubmitting: boolean;
}) {
  return (
    <div className="border border-white/5 bg-zinc-900/30 p-5 sm:p-6 shadow-2xl">
      <h2 className="font-outfit text-lg font-black uppercase italic tracking-wider text-white border-b border-white/5 pb-3 mb-4">
        Resumen
      </h2>
      <div className="max-h-72 space-y-4 overflow-y-auto pr-1 no-scrollbar divide-y divide-white/5">
        {items.map((item, idx) => (
          <div key={item.variantId} className={cn("flex gap-3", idx > 0 && "pt-3")}>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-black uppercase tracking-tight text-white">{item.name}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                {item.size ? `Talla ${item.size}` : 'Talla única'}
                {item.color ? ` · ${item.color}` : ''} · x{item.quantity}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-black text-white">
                {formatUSD(item.priceUsd * item.quantity)}
              </p>
              <p className="font-mono text-[10px] text-zinc-500">
                {formatBsS(item.priceBs * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-white/10 space-y-3">
        <SummaryLine label="Subtotal" value={formatUSD(subtotalUsd)} strong />
        {isShippingOption(deliveryOption) && (
           <SummaryLine 
             label={deliveryOption === 'LOCAL_DELIVERY' ? 'Delivery Maracaibo' : 'Envío nacional'} 
             value={shippingFee > 0 ? formatUSD(shippingFee) : 'GRATIS'} 
             valueClass={shippingFee === 0 ? "text-emerald-400 font-black tracking-wider text-[10px] uppercase" : ""}
           />
        )}
        <div className="flex justify-between items-end pt-4 mt-2 border-t border-dashed border-white/20">
          <div>
            <p className="font-outfit text-sm font-black uppercase italic tracking-wider text-white">Total USD</p>
            <p className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Tasa: {formatBsS(rate)}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-black text-brand-primary drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
              {formatUSD(totalUsd)}
            </p>
            <p className="font-mono text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">
              ~ {formatBsS(totalBs)}
            </p>
          </div>
        </div>
      </div>

      <button
        form="checkout-form"
        type="submit"
        disabled={isSubmitting}
        className="mt-6 hidden h-12 w-full items-center justify-center gap-2 border border-white bg-white text-xs font-black uppercase tracking-widest text-zinc-950 transition-all hover:bg-transparent hover:text-white disabled:opacity-50 md:flex cursor-pointer"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-zinc-950" /> : null}
        Completar compra
      </button>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
  accent,
  valueClass,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn('text-[10px] font-black uppercase tracking-wider', strong ? 'text-white' : 'text-zinc-500')}>
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-xs font-black',
          valueClass ? valueClass : (accent ? 'text-brand-primary' : strong ? 'text-white' : 'text-zinc-400'),
        )}
      >
        {value}
      </span>
    </div>
  );
}
