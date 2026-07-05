import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const veloxBaseUrl = required('VELOX_POS_API_URL').replace(/\/+$/, '');
const storeId = required('VELOX_STORE_ID');
const pin = required('VELOX_LOGIN_PIN');
const storefrontSecret = process.env.STOREFRONT_API_SECRET || required('VELOX_WEBHOOK_SECRET');
const appUrl = required('NEXT_PUBLIC_APP_URL').replace(/\/+$/, '');
const importSecret = process.env.PRODUCT_IMPORT_AUTH_SECRET || process.env.CRON_SECRET || storefrontSecret;
const batchSize = Math.max(1, Number(process.env.PRODUCT_IMPORT_BATCH_SIZE || 50));

const auth = await loginToVelox();
const [products, stockByProductId] = await Promise.all([
  fetchPublicProducts(),
  fetchStockStatus(auth.access_token),
]);

const productsWithStock = products.map((product) => ({
  ...product,
  current_stock: stockByProductId.get(product.id) ?? Number(product.current_stock ?? 0),
}));
const activeVeloxIds = productsWithStock
  .filter((product) => product.is_active !== false && product.is_visible_public !== false)
  .map((product) => product.id);

let created = 0;
let updated = 0;
let deactivated = 0;

for (let offset = 0; offset < productsWithStock.length; offset += batchSize) {
  const batch = productsWithStock.slice(offset, offset + batchSize);
  const isLastBatch = offset + batchSize >= productsWithStock.length;
  const result = await importBatch(batch, {
    deactivateMissing: isLastBatch,
    activeVeloxIds: isLastBatch ? activeVeloxIds : undefined,
  });

  created += Number(result.created ?? 0);
  updated += Number(result.updated ?? 0);
  deactivated += Number(result.deactivated ?? 0);
  console.log(JSON.stringify({
    batch: `${offset + 1}-${offset + batch.length}`,
    total: productsWithStock.length,
    ...result,
  }));
}

console.log(JSON.stringify({
  success: true,
  sourceProducts: products.length,
  activeSourceProducts: activeVeloxIds.length,
  created,
  updated,
  deactivated,
}, null, 2));

async function loginToVelox() {
  const response = await fetch(`${veloxBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, pin }),
  });

  if (!response.ok) {
    throw new Error(`Velox auth failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchPublicProducts() {
  const response = await fetch(`${veloxBaseUrl}/public/menu/store/${storeId}`, {
    headers: storefrontHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Velox public menu failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const categories = body?.menu?.categories;
  if (!Array.isArray(categories)) {
    throw new Error('Velox public menu did not return menu.categories');
  }

  const byId = new Map();
  for (const category of categories) {
    for (const product of category.products ?? []) {
      byId.set(product.id, {
        ...product,
        category: product.category ?? category.name ?? null,
      });
    }
  }

  return [...byId.values()];
}

async function fetchStockStatus(token) {
  const response = await fetch(`${veloxBaseUrl}/inventory/stock/status?limit=5000`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Velox stock status failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const items = Array.isArray(body) ? body : body.items ?? [];
  return new Map(
    items
      .filter((item) => item?.product_id)
      .map((item) => [item.product_id, Number(item.current_stock ?? 0)]),
  );
}

async function importBatch(products, options) {
  const response = await fetch(`${appUrl}/api/cron/import-products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${importSecret}`,
      'x-storefront-secret': storefrontSecret,
    },
    body: JSON.stringify({
      products,
      deactivateMissing: options.deactivateMissing,
      activeVeloxIds: options.activeVeloxIds,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Netlify import failed: ${response.status} ${bodyText}`);
  }

  return JSON.parse(bodyText);
}

function storefrontHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-storefront-store-id': storeId,
    'x-storefront-secret': storefrontSecret,
    'x-velox-api-version': '2.0.0',
  };
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
