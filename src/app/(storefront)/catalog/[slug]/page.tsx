'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useTRPC } from '@/lib/trpc-client';
import { useCartStore, type CartItem } from '@/stores/cart.store';
import { STORE_INFO } from '@/lib/constants';
import { formatBsS, formatUSD } from '@/lib/utils';
import { cn } from '@/lib/utils';

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

type AccordionProps = {
  title: string;
  children: React.ReactNode;
};

interface PDPVariant {
  id: string;
  veloxVariantId: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  imageUrl: string | null;
  additionalImages: string[];
  currentStock: number;
  isActive: boolean;
  priceUsdOverride: string | null;
  priceBsOverride: string | null;
}

interface PDPImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

interface PDPProduct {
  id: string;
  veloxId: string;
  name: string;
  slug: string;
  sku: string;
  priceUsd: string;
  priceBs: string | null;
  currentStock: number;
  isActive: boolean;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
  variants?: PDPVariant[];
  images?: PDPImage[];
}

const PRODUCT_REFRESH_MS = 30_000;

function Accordion({ title, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none"
      >
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-zinc-500 transition-transform duration-300',
            isOpen && 'rotate-180 text-white'
          )}
        />
      </button>
      <div
        className={cn(
          'mt-3 overflow-hidden text-xs leading-6 text-zinc-400 transition-all duration-300 max-h-0',
          isOpen && 'max-h-96'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = use(params);
  const trpc = useTRPC();
  const addItem = useCartStore((state) => state.addItem);
  const syncLegacyItem = useCartStore((state) => state.syncLegacyItem);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: product, isLoading, error } = useQuery({
    ...trpc.product.getBySlug.queryOptions({ slug }),
    refetchInterval: PRODUCT_REFRESH_MS,
    refetchIntervalInBackground: false,
  }) as { data: PDPProduct | null | undefined; isLoading: boolean; error: unknown };

  // Real variants come from productCache.productVariants. When the
  // product has no variants, fall back to a single "default" pseudo-
  // variant so the selector keeps working for one-size products.
  const variants = useMemo(() => product?.variants ?? [], [product?.variants]);

  // Build the size/color option space from the variants table.
  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      if (v.size) set.add(v.size);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [variants]);

  const colorOptions = useMemo(() => {
    const map = new Map<string, { name: string; hex: string | null }>();
    for (const v of variants) {
      if (v.color && !map.has(v.color)) {
        map.set(v.color, { name: v.color, hex: v.colorHex });
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      hex: value.hex,
    }));
  }, [variants]);

  // Auto-pick a variant when size+color are both selected.
  const selectedVariant = useMemo<PDPVariant | null>(() => {
    if (variants.length === 0) return null;
    return (
      variants.find((v) => {
        // Match both fields when both are part of the option space; if
        // the product has no colors (e.g. one color), match by size only.
        if (sizeOptions.length === 0) return true;
        if (colorOptions.length === 0) return v.size === selectedSize;
        return v.size === selectedSize && v.color === selectedColor;
      }) ?? null
    );
  }, [variants, selectedSize, selectedColor, sizeOptions, colorOptions]);

  // Image source: variant image (when selected) > product image.
  const activeImageUrl = useMemo(() => {
    if (selectedVariant?.imageUrl) return selectedVariant.imageUrl;
    const colorVariantImage = variants.find(
      (v) => v.color === selectedColor && v.imageUrl,
    )?.imageUrl;
    if (colorVariantImage) return colorVariantImage;
    return product?.imageUrl ?? null;
  }, [selectedVariant, variants, selectedColor, product]);

  // All images available for the gallery (variant + parent images).
  const allImages = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    if (activeImageUrl) {
      result.push(activeImageUrl);
      seen.add(activeImageUrl);
    }
    if (selectedVariant) {
      for (const url of selectedVariant.additionalImages) {
        if (url && !seen.has(url)) {
          result.push(url);
          seen.add(url);
        }
      }
    }
    for (const img of product?.images ?? []) {
      if (img.url && !seen.has(img.url)) {
        result.push(img.url);
        seen.add(img.url);
      }
    }
    return result;
  }, [activeImageUrl, selectedVariant, product]);

  if (isLoading) {
    return (
      <div className="grid min-h-[70dvh] place-items-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-brand-primary" />
          <p className="athletic-tag text-zinc-500">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="store-shell grid min-h-[70dvh] place-items-center bg-zinc-950 text-center text-white">
        <div>
          <h1 className="font-outfit text-3xl font-black uppercase italic tracking-tight">Producto no encontrado</h1>
          <p className="athletic-tag text-zinc-500 mt-3">Este producto no existe o fue desactivado.</p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex h-12 items-center border border-white bg-white px-7 text-xs font-black uppercase tracking-widest text-zinc-950 hover:bg-transparent hover:text-white transition-colors"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.currentStock <= 0;
  const variantPriceUsd = selectedVariant?.priceUsdOverride
    ? Number(selectedVariant.priceUsdOverride)
    : Number(product.priceUsd);
  const variantPriceBs = selectedVariant?.priceBsOverride
    ? Number(selectedVariant.priceBsOverride)
    : product.priceBs
      ? Number(product.priceBs)
      : 0;

  const selectedVariantStock = selectedVariant?.currentStock ?? 0;
  const hasNoVariants = variants.length === 0;
  const ctaDisabled =
    isOutOfStock ||
    (!hasNoVariants && (sizeOptions.length > 0 && !selectedSize) ||
      (colorOptions.length > 0 && !selectedColor)) ||
    (!!selectedVariant && selectedVariantStock <= 0);

  const handleAddToCart = () => {
    if (!hasNoVariants) {
      if (sizeOptions.length > 0 && !selectedSize) {
        setErrorMsg('SELECCIONA UNA TALLA');
        return;
      }
      if (colorOptions.length > 0 && !selectedColor) {
        setErrorMsg('SELECCIONA UN COLOR');
        return;
      }
    }
    if (!selectedVariant && !hasNoVariants) {
      setErrorMsg('COMBINACIÓN NO DISPONIBLE');
      return;
    }

    setErrorMsg('');

    // Build the cart item. When the product has no variants table entries
    // we still want to allow add-to-cart (backward compatibility) and use
    // a deterministic synthetic variant id derived from product+slug.
    const cartItem: Omit<CartItem, 'quantity'> = selectedVariant
      ? {
          variantId: selectedVariant.veloxVariantId,
          productId: product.veloxId,
          name: product.name,
          sku: selectedVariant.sku ?? product.sku,
          size: selectedVariant.size,
          color: selectedVariant.color,
          colorHex: selectedVariant.colorHex,
          imageUrl: selectedVariant.imageUrl ?? product.imageUrl ?? '',
          priceUsd: variantPriceUsd,
          priceBs: variantPriceBs,
          availableStock: selectedVariantStock,
          slug: product.slug,
        }
      : {
          variantId: `product::${product.veloxId}`,
          productId: product.veloxId,
          name: product.name,
          sku: product.sku,
          size: null,
          color: null,
          colorHex: null,
          imageUrl: product.imageUrl ?? '',
          priceUsd: Number(product.priceUsd),
          priceBs: product.priceBs ? Number(product.priceBs) : 0,
          availableStock: product.currentStock,
          slug: product.slug,
        };

    addItem({ ...cartItem, quantity: 1 });
  };

  return (
    <div className="bg-zinc-950 text-white">
      <LegacyCartMigration product={product} syncLegacyItem={syncLegacyItem} />
      <div className="store-shell pt-8 md:pt-16">
        <Link
          href="/catalog"
          className="inline-flex h-10 items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Catálogo
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12 pb-32 md:pb-48">

          {/* Product Image Section */}
          <div className="relative aspect-square w-full max-h-[380px] sm:max-h-[450px] md:max-h-[500px] overflow-hidden border border-white/5 bg-zinc-900/20 md:sticky md:top-24 flex items-center justify-center">
            {activeImageUrl ? (
              <div className="relative h-full w-full flex items-center justify-center">
                <Image
                  src={activeImageUrl}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain p-6 transition-transform duration-500 hover:scale-102"
                />
                {allImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 flex gap-1.5">
                    {allImages.slice(0, 4).map((url) => (
                      <span
                        key={url}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          url === activeImageUrl ? 'bg-white' : 'bg-white/30'
                        )}
                      />
                    ))}
                  </div>
                )}
                <div className="absolute left-4 top-4 z-10">
                  <span className="nike-badge nike-badge-primary">
                    {isOutOfStock ? 'Agotado' : `${product.currentStock} Disponibles`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 relative">
                <span className="font-outfit absolute right-6 top-8 select-none text-[12rem] font-black leading-none italic uppercase" style={{ color: 'rgba(255, 255, 255, 0.02)' }}>
                  {(product.category ?? product.name)?.[0]?.toUpperCase() ?? 'C'}
                </span>
                <div className="z-10">
                  <span className="nike-badge nike-badge-primary">
                    {isOutOfStock ? 'Agotado' : `${product.currentStock} Disponibles`}
                  </span>
                </div>
                <div className="z-10">
                  <p className="athletic-tag text-brand-primary mb-2">
                    {product.category || 'Clazico'}
                  </p>
                  <p className="font-outfit text-2xl font-black uppercase italic leading-tight text-white sm:text-3xl">
                    {product.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col gap-y-6 md:gap-y-8">
            <div className="flex flex-col gap-y-2">
              <p className="athletic-tag text-brand-primary">
                {product.category || 'Clazico'}
              </p>
              <h1 className="font-outfit text-2xl font-black uppercase italic leading-tight tracking-tight text-white sm:text-4xl">
                {product.name}
              </h1>
              <p className="font-mono text-[9px] font-bold text-zinc-600">SKU: {product.sku}</p>
            </div>

            <div className="border border-white/5 bg-zinc-900/30 p-5 sm:p-6">
              <p className="font-mono text-2xl font-black text-white">{formatUSD(variantPriceUsd)}</p>
              {variantPriceBs > 0 && (
                <p className="mt-1 font-mono text-xs font-bold text-zinc-500">{formatBsS(variantPriceBs)}</p>
              )}
            </div>

            {/* Size Selector — backed by productVariants */}
            {sizeOptions.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="athletic-tag text-zinc-500">Seleccionar Talla</p>
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                    {selectedSize || 'Sin seleccionar'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {sizeOptions.map((size) => {
                    // A size is sold-out if no variant for it has stock.
                    const hasStock = variants.some(
                      (v) => v.size === size && v.currentStock > 0 && v.isActive,
                    );
                    const isActive = selectedSize === size;
                    return (
                      <button
                        key={size}
                        disabled={!hasStock || isOutOfStock}
                        onClick={() => {
                          setSelectedSize(size);
                          setErrorMsg('');
                        }}
                        className={cn(
                          'size-grid-btn cursor-pointer',
                          isActive && 'active',
                          !hasStock && 'opacity-30 line-through cursor-not-allowed',
                        )}
                        title={hasStock ? size : `${size} agotado`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Selector — backed by productVariants */}
            {colorOptions.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="athletic-tag text-zinc-500">Seleccionar Color</p>
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                    {selectedColor || 'Sin seleccionar'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 pt-1 pl-1">
                  {colorOptions.map((color) => {
                    const isActive = selectedColor === color.name;
                    return (
                      <button
                        key={color.name}
                        disabled={isOutOfStock}
                        type="button"
                        onClick={() => {
                          setSelectedColor(color.name);
                          setErrorMsg('');
                        }}
                        className="relative flex h-8 w-8 items-center justify-center cursor-pointer transition-all active:scale-90"
                        title={color.name}
                      >
                        <span
                          className={cn(
                            "absolute inset-0 rounded-full border-2 border-transparent transition-all",
                            isActive ? "border-white scale-125" : "hover:border-white/40"
                          )}
                          style={{ margin: '-4px' }}
                        />
                        <span
                          className="h-8 w-8 rounded-full border border-white/10 shadow-lg"
                          style={{ backgroundColor: color.hex ?? '#000' }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedVariant && selectedVariantStock > 0 && !isOutOfStock && (
              <p className="font-mono text-[10px] font-bold text-zinc-500">
                {selectedVariantStock} disponibles en esta combinación
              </p>
            )}

            {errorMsg && <p className="text-xs font-black uppercase tracking-wider text-brand-primary">{errorMsg}</p>}

            {/* Desktop Add to Cart */}
            <button
              disabled={ctaDisabled}
              onClick={handleAddToCart}
              className="hidden h-14 w-full items-center justify-center gap-3 border border-white bg-white text-xs font-black uppercase tracking-widest text-zinc-950 transition-all disabled:opacity-50 md:flex hover:bg-transparent hover:text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              {isOutOfStock ? 'Agotado' : 'Añadir al carrito'}
            </button>

            {/* Product Badges */}
            <div className="grid gap-4 border-t border-white/5 pt-6 text-xs font-black uppercase tracking-wider text-zinc-500 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
                Compra 100% Verificada
              </div>
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-brand-primary" />
                Garantía de cambio físico
              </div>
            </div>

            {/* Editorial Accordions */}
            <div className="border-t border-white/5 pt-4">
              {product.description && (
                <Accordion title="Descripción de la Silueta">
                  <p className="whitespace-pre-line leading-relaxed">
                    {product.description}
                  </p>
                </Accordion>
              )}
              <Accordion title="Métodos de Entrega en Venezuela">
                <ul className="space-y-2">
                  <li>• <strong className="text-white">Retiro en Tienda:</strong> Gratis en {STORE_INFO.address}, de lunes a sábado.</li>
                  <li>• <strong className="text-white">Envíos Nacionales:</strong> MRW, ZOOM y TEALCA con cobro en destino.</li>
                </ul>
              </Accordion>
              <Accordion title="Soporte y Garantías">
                <p className="leading-relaxed">
                  Ofrecemos hasta 3 días para cambios de talla. El artículo debe devolverse en perfectas condiciones y queda sujeto a revisión y disponibilidad.
                </p>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA Bar */}
      <div className="bottom-above-nav fixed inset-x-0 z-[110] border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-xl md:hidden">
        <button
          disabled={ctaDisabled}
          onClick={handleAddToCart}
          className="flex h-12 w-full items-center justify-center gap-3 border border-white bg-white text-xs font-black uppercase tracking-widest text-zinc-950 transition-all disabled:opacity-50"
        >
          <ShoppingBag className="h-4 w-4" />
          {isOutOfStock ? 'Agotado' : 'Añadir al carrito'}
        </button>
      </div>
    </div>
  );
}

/**
 * Hook helper: when the cart has a legacy entry for the current product,
 * sync it once to the canonical v2 shape using the freshly loaded
 * product. We pick the first in-stock variant for the auto-sync target.
 */
function LegacyCartMigration({
  product,
  syncLegacyItem,
}: {
  product: PDPProduct | null | undefined;
  syncLegacyItem: (legacyKey: string, next: CartItem) => void;
}) {
  if (!product || !product.veloxId) return;
  // The actual migration runs from a useEffect in a child component to
  // satisfy the rules of hooks; this no-op wrapper keeps the JSX above
  // clean. Real logic lives in <LegacyCartSyncEffect/>.
  return <LegacyCartSyncEffect product={product} syncLegacyItem={syncLegacyItem} />;
}

function LegacyCartSyncEffect({
  product,
  syncLegacyItem,
}: {
  product: PDPProduct;
  syncLegacyItem: (legacyKey: string, next: CartItem) => void;
}) {
  const items = useCartStore((state) => state.items);
  // Run once after mount when the variants are available. The effect
  // re-checks items on every render but only mutates when a legacy key
  // for the current product is found.
  useEffect(() => {
    if (!product.veloxId) return;
    const legacyKey = `legacy::${product.veloxId}__`;
    const legacy = items.find((it) => it.variantId.startsWith(legacyKey) || it.variantId === `legacy::${product.veloxId}__`);
    if (!legacy) return;
    const firstInStock = (product.variants ?? []).find((v) => v.currentStock > 0 && v.isActive);
    if (!firstInStock) return;
    syncLegacyItem(legacy.variantId, {
      variantId: firstInStock.veloxVariantId,
      productId: product.veloxId,
      name: product.name,
      sku: firstInStock.sku ?? product.sku,
      size: firstInStock.size,
      color: firstInStock.color,
      colorHex: firstInStock.colorHex,
      imageUrl: firstInStock.imageUrl ?? product.imageUrl ?? '',
      priceUsd: firstInStock.priceUsdOverride
        ? Number(firstInStock.priceUsdOverride)
        : Number(product.priceUsd),
      priceBs: firstInStock.priceBsOverride
        ? Number(firstInStock.priceBsOverride)
        : product.priceBs
          ? Number(product.priceBs)
          : 0,
      quantity: legacy.quantity,
      availableStock: firstInStock.currentStock,
      slug: product.slug,
    });
  }, [product, items, syncLegacyItem]);
  return null;
}
