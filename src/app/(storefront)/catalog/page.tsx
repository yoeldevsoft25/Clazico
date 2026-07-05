'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { useTRPC } from '@/lib/trpc-client';
import { formatBsS, formatUSD } from '@/lib/utils';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */
type Product = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  priceUsd: string | number;
  priceBs: string | number | null;
  currentStock: number;
  sku: string;
};

type FilterPanelProps = {
  inStock: boolean;
  setInStock: (v: boolean) => void;
  sortBy: 'name' | 'price' | 'newest';
  setSortBy: (v: 'name' | 'price' | 'newest') => void;
  clearFilters: () => void;
};

const PRODUCT_REFRESH_MS = 30_000;
const PRODUCT_PAGE_SIZE = 500;

/* ─── Product card ────────────────────────────────────────── */
function ProductCard({ product }: { product: Product }) {
  const hasImage = Boolean(product.imageUrl);
  const inStock = product.currentStock > 0;
  const isLastUnits = product.currentStock > 0 && product.currentStock <= 3;

  const badgeText = !inStock
    ? 'Agotado'
    : isLastUnits
    ? 'Últimas unidades'
    : product.category === 'Calzado'
    ? 'Hot Release'
    : 'Nuevo';

  return (
    <Link href={`/catalog/${product.slug}`} className="group block h-full">
      <article className="premium-card flex h-full flex-col">
        {/* Visual */}
        <div className="product-image-wrapper border-b border-white/5 bg-zinc-950">
          {hasImage ? (
            <>
              <Image
                src={product.imageUrl!}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </>
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-zinc-900 to-zinc-950 p-6">
              <span className="font-outfit text-lg font-black tracking-tighter text-white/20 italic uppercase">
                CLAZICO
              </span>
            </div>
          )}

          {/* Stock Badges */}
          <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
            <span
              className={`nike-badge ${
                !inStock
                  ? 'bg-zinc-800 text-zinc-500'
                  : isLastUnits
                  ? 'nike-badge-primary'
                  : 'bg-white text-black'
              }`}
            >
              {badgeText}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="premium-card-info">
          <div>
            <p className="athletic-tag text-brand-primary">
              {product.category || 'Clazico'}
            </p>
            <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] font-outfit text-sm font-black uppercase tracking-tight text-white transition-colors group-hover:text-brand-primary">
              {product.name}
            </h3>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/5 pt-3">
            <div>
              <p className="font-mono text-sm font-black text-white">
                {formatUSD(Number(product.priceUsd))}
              </p>
              {product.priceBs && (
                <p className="truncate font-mono text-[10px] text-zinc-500 font-bold">
                  {formatBsS(Number(product.priceBs))}
                </p>
              )}
            </div>
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-white/10 text-zinc-500 transition-all group-hover:border-white group-hover:bg-white group-hover:text-black">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

/* ─── Filter panel ────────────────────────────────────────── */
function FilterPanel({ inStock, setInStock, sortBy, setSortBy, clearFilters }: FilterPanelProps) {
  return (
    <div className="space-y-6 border border-white/5 bg-zinc-900/30 p-5">
      <div>
        <p className="athletic-tag text-zinc-500 mb-3">Orden</p>
        <div className="grid gap-2">
          {([
            ['newest', 'Más recientes'],
            ['price', 'Menor precio'],
            ['name', 'A–Z'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSortBy(value)}
              className={cn(
                'h-10 border text-left text-xs font-black uppercase tracking-wider transition-all px-4',
                sortBy === value
                  ? 'border-white bg-white text-zinc-950'
                  : 'border-white/10 bg-transparent text-zinc-400 hover:border-white/30 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="athletic-tag text-zinc-500 mb-3">Filtros</p>
        <label className="flex items-center justify-between h-11 border border-white/10 px-4 cursor-pointer text-xs font-black uppercase tracking-wider text-white hover:border-white/30 transition-colors">
          Solo disponibles
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="h-4 w-4 accent-brand-primary cursor-pointer"
          />
        </label>
      </div>

      <button
        onClick={clearFilters}
        className="h-10 w-full border border-white/10 text-xs font-black uppercase tracking-wider text-zinc-400 hover:border-brand-primary hover:text-white transition-colors"
      >
        Limpiar filtros
      </button>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function CatalogPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'newest'>('newest');
  const [inStock, setInStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [extraPage, setExtraPage] = useState<{ key: string; items: Product[] }>({
    key: '',
    items: [],
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data: rawCategories = [] } = useQuery({
    ...trpc.product.categories.queryOptions(),
    refetchInterval: PRODUCT_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const categories = rawCategories.filter((item): item is string => Boolean(item));

  const { data: productsData, isLoading } = useQuery({
    ...trpc.product.list.queryOptions({
      category: category || undefined,
      sortBy,
      inStock: inStock || undefined,
      limit: PRODUCT_PAGE_SIZE,
      offset: 0,
    }),
    refetchInterval: PRODUCT_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const filterKey = `${category}|${sortBy}|${inStock}`;
  const extraProducts = useMemo(
    () => (extraPage.key === filterKey ? extraPage.items : []),
    [extraPage, filterKey],
  );

  const loadedProducts = useMemo(() => {
    const firstPage = productsData?.items ?? [];
    if (extraProducts.length === 0) return firstPage;

    const seen = new Set(firstPage.map((product) => product.id));
    return [
      ...firstPage,
      ...extraProducts.filter((product) => {
        if (seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
      }),
    ];
  }, [extraProducts, productsData?.items]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return loadedProducts;
    return loadedProducts.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  }, [loadedProducts, search]);
  const availableProductsCount = useMemo(
    () => filteredProducts.filter((product) => product.currentStock > 0).length,
    [filteredProducts],
  );
  const totalProducts = productsData?.total ?? loadedProducts.length;
  const hasMoreProducts = loadedProducts.length < totalProducts;

  const loadMoreProducts = async () => {
    if (isLoadingMore || !hasMoreProducts) return;

    setIsLoadingMore(true);
    try {
      const nextPage = await queryClient.fetchQuery(
        trpc.product.list.queryOptions({
          category: category || undefined,
          sortBy,
          inStock: inStock || undefined,
          limit: PRODUCT_PAGE_SIZE,
          offset: loadedProducts.length,
        }),
      );
      setExtraPage((current) => ({
        key: filterKey,
        items: current.key === filterKey ? [...current.items, ...nextPage.items] : nextPage.items,
      }));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setCategory('');
    setSearch('');
    setSortBy('newest');
    setInStock(false);
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-16 md:pb-28">

      {/* ── Header ── */}
      <div className="border-b border-white/5">
        <div className="store-shell py-12 md:py-20">

          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-outfit text-4xl font-black leading-none text-white sm:text-5xl uppercase italic tracking-tight">
                Catálogo
              </h1>
              <p className="athletic-tag text-zinc-500 mt-2">
                {search.trim() ? filteredProducts.length : totalProducts} productos en catálogo
                {!inStock && filteredProducts.length > 0 ? ` · ${availableProductsCount} con stock` : ''}
              </p>
            </div>
            {/* Mobile filter button */}
            <button
              onClick={() => setFiltersOpen(true)}
              className="mt-1 flex h-10 items-center gap-2 border border-white/10 bg-zinc-900/60 px-4 text-xs font-black uppercase tracking-wider text-zinc-400 hover:border-white/30 hover:text-white md:hidden"
              aria-label="Filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BUSCAR SILUETA, ROPA O SKU..."
              className="h-12 w-full border border-white/10 bg-zinc-900/40 pl-12 pr-4 text-xs font-black uppercase tracking-wider text-white placeholder:text-zinc-600 transition-colors focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Category chips */}
          <div className="-mx-[20px] mt-5 flex gap-3 overflow-x-auto px-[20px] pb-1.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 no-scrollbar">
            <button
              onClick={() => setCategory('')}
              className={cn(
                'h-10 shrink-0 border px-5 text-[11px] font-black uppercase tracking-wider transition-colors rounded-none cursor-pointer',
                !category
                  ? 'border-white bg-white text-zinc-950'
                  : 'border-white/10 bg-transparent text-zinc-400 hover:border-white/30 hover:text-white',
              )}
            >
              Todo
            </button>
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={cn(
                  'h-10 shrink-0 border px-5 text-[11px] font-black uppercase tracking-wider transition-colors rounded-none cursor-pointer',
                  category === item
                    ? 'border-white bg-white text-zinc-950'
                    : 'border-white/10 bg-transparent text-zinc-400 hover:border-white/30 hover:text-white',
                )}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Desktop Filter Bar */}
          <div className="mt-6 hidden items-center justify-between border border-white/5 bg-zinc-900/20 p-3 md:flex">
            <div className="flex items-center gap-2">
              {([
                ['newest', 'Más recientes'],
                ['price', 'Menor precio'],
                ['name', 'A-Z'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSortBy(value)}
                  className={cn(
                    'h-8 px-4 text-[10px] font-black uppercase tracking-widest border transition-all',
                    sortBy === value
                      ? 'border-white bg-white text-zinc-950'
                      : 'border-transparent bg-transparent text-zinc-400 hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-3 border border-white/5 bg-zinc-900/40 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:border-white/10 transition-colors">
              Solo disponibles
              <input
                type="checkbox"
                checked={inStock}
                onChange={(event) => setInStock(event.target.checked)}
                className="h-4 w-4 accent-brand-primary cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="store-shell mt-12 pb-24 md:pb-36">
        <div>
          {isLoading ? (
            <div className="grid min-h-[50dvh] place-items-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
                <p className="athletic-tag text-zinc-500">Cargando catálogo...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="grid min-h-[40dvh] place-items-center border border-white/5 bg-zinc-900/20 p-10 text-center">
              <div>
                <p className="font-outfit text-xl font-black uppercase italic text-white">Sin resultados</p>
                <p className="athletic-tag text-zinc-500 mt-2">Prueba otra búsqueda o limpia filtros</p>
                <button
                  onClick={clearFilters}
                  className="mt-6 h-10 border border-white px-6 text-xs font-black uppercase tracking-widest bg-white text-zinc-950 hover:bg-transparent hover:text-white transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          {hasMoreProducts && !isLoading && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={loadMoreProducts}
                disabled={isLoadingMore}
                className="inline-flex h-12 items-center gap-3 border border-white bg-white px-8 text-xs font-black uppercase tracking-widest text-zinc-950 transition-colors hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Cargar más
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xs md:hidden" onClick={() => setFiltersOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="font-outfit text-lg font-black uppercase italic">Filtros</p>
              <button
                onClick={() => setFiltersOpen(false)}
                className="grid h-9 w-9 place-items-center border border-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                aria-label="Cerrar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FilterPanel
              inStock={inStock}
              setInStock={setInStock}
              sortBy={sortBy}
              setSortBy={setSortBy}
              clearFilters={clearFilters}
            />
            <button
              onClick={() => setFiltersOpen(false)}
              className="mt-5 h-12 w-full bg-brand-primary text-xs font-black uppercase tracking-widest text-white hover:bg-brand-primary-hover transition-colors"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
