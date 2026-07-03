import 'server-only';
import { StorefrontClient } from '@yoeldevsoft25/storefront-sdk';
import type { CreateWebOrderDto } from '@yoeldevsoft25/store-contracts';

// ─── Custom Error ────────────────────────────────────────────────────────────

export class VeloxAPIError extends Error {
  public readonly statusCode: number;
  public readonly endpoint: string;
  public readonly responseBody: unknown;

  constructor(message: string, statusCode: number, endpoint: string, responseBody?: unknown) {
    super(message);
    this.name = 'VeloxAPIError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface VeloxAuthResponse {
  access_token: string;
  refresh_token?: string;
  user_id?: string;
  store_id?: string;
  role?: string;
  full_name?: string | null;
  expires_in?: number;
}

export interface VeloxProductVariant {
  id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  image_url: string | null;
  additional_images: string[];
  sort_order: number;
  price_usd_override: number | null;
  price_bs_override: number | null;
  current_stock: number;
  is_active: boolean;
}

export interface VeloxProduct {
  id: string;
  name: string;
  public_name?: string | null;
  sku: string | null;
  barcode: string | null;
  description?: string | null;
  public_description?: string | null;
  price_usd: number;
  price_bs: number;
  is_active: boolean;
  image_url: string | null;
  public_image_url?: string | null;
  category: string | null;
  public_category?: string | null;
  is_visible_public?: boolean;
  updated_at?: string | null;
  variants?: VeloxProductVariant[];
}

export interface VeloxStockResponse {
  product_id: string;
  variant_id: string | null;
  current_stock: number;
}

export interface VeloxSaleItem {
  product_id: string;
  qty: number;
  unit_price_usd: number;
  unit_price_bs: number;
}

export interface VeloxSalePayload {
  exchange_rate: number;
  currency: 'USD' | 'BS' | 'MIXED';
  payment_method: string;
  reference: string;
  items: VeloxSaleItem[];
  customer_name: string;
  customer_document_id: string;
  customer_phone: string;
  note?: string;
}

export type VeloxWebOrderPayload = CreateWebOrderDto;

export interface VeloxProductsParams {
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
}

type VeloxProductsResponse =
  | VeloxProduct[]
  | {
      products?: VeloxProduct[];
      items?: VeloxProduct[];
      data?: VeloxProduct[];
      total?: number;
    };

// ─── Service ─────────────────────────────────────────────────────────────────

interface RequestOptions {
  idempotencyKey?: string;
}

class VeloxPosService {
  private baseUrl: string | null = null;
  private storeId: string | null = null;
  private pin: string | null = null;
  private storefrontSecret: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private sdkClient: StorefrontClient | null = null;

  private static instance: VeloxPosService | null = null;

  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 500;

  private constructor() {
    this.reloadConfig();
  }

  private reloadConfig(): void {
    const baseUrl = process.env.VELOX_POS_API_URL;
    const storeId = process.env.VELOX_STORE_ID;
    const pin = process.env.VELOX_LOGIN_PIN;
    const storefrontSecret = process.env.STOREFRONT_API_SECRET || process.env.VELOX_WEBHOOK_SECRET;

    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : null;
    this.storeId = storeId ?? null;
    this.pin = pin ?? null;
    this.storefrontSecret = storefrontSecret ?? null;
    this.sdkClient = null; // force recreation on config reload
  }

  private getConfig(): { baseUrl: string; storeId: string; pin: string } {
    this.reloadConfig();
    if (!this.baseUrl) throw new Error('VELOX_POS_API_URL environment variable is not set');
    if (!this.storeId) throw new Error('VELOX_STORE_ID environment variable is not set');
    if (!this.pin) throw new Error('VELOX_LOGIN_PIN environment variable is not set');
    return {
      baseUrl: this.baseUrl,
      storeId: this.storeId,
      pin: this.pin,
    };
  }

  private getSdkClient(): StorefrontClient {
    if (!this.sdkClient) {
      const config = this.getConfig();
      const secret = this.storefrontSecret || '';
      if (!secret) {
        throw new Error('STOREFRONT_API_SECRET or VELOX_WEBHOOK_SECRET must be configured');
      }
      this.sdkClient = new StorefrontClient({
        baseUrl: config.baseUrl,
        storeId: config.storeId,
        secret,
      });
    }
    return this.sdkClient;
  }

  static getInstance(): VeloxPosService {
    if (!VeloxPosService.instance) {
      VeloxPosService.instance = new VeloxPosService();
    }
    return VeloxPosService.instance;
  }

  // ── Authentication ──────────────────────────────────────────────────────

  async authenticate(): Promise<void> {
    const config = this.getConfig();
    const url = `${config.baseUrl}/auth/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: config.storeId,
        pin: config.pin,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => null);
      throw new VeloxAPIError(
        `Authentication failed: ${response.statusText}`,
        response.status,
        '/auth/login',
        body,
      );
    }

    const data = (await response.json()) as VeloxAuthResponse;
    this.accessToken = data.access_token;
    // Velox access tokens are currently short-lived. Use the API value when present,
    // otherwise keep a conservative 14 minute window for the 15 minute default.
    const expiresInSeconds = data.expires_in ?? 15 * 60;
    this.tokenExpiresAt = Date.now() + Math.max(30, expiresInSeconds - 60) * 1000;
  }

  private isTokenValid(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiresAt;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
  }

  // ── Request helpers ─────────────────────────────────────────────────────

  /**
   * Build the canonical storefront v2 header set:
   * - `x-storefront-secret` + `x-storefront-store-id` for the public/ ingest
   *   endpoint (validated by StorefrontAuthGuard in Velox).
   * - `Authorization: Bearer …` for protected endpoints that still require
   *   an admin/PIN session token.
   * - `Idempotency-Key` for POSTs when supplied by the caller.
   *
   * Headers are attached when the corresponding env var / option is present.
   * If the storefront secret is not configured, we skip the storefront
   * headers — Velox is backward-compatible with v1 clients while rollout.
   */
  private buildHeaders(options: RequestOptions = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-velox-api-version': '2.0.0',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (this.storefrontSecret) {
      headers['x-storefront-secret'] = this.storefrontSecret;
    }
    if (this.storeId) {
      headers['x-storefront-store-id'] = this.storeId;
    }
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    return headers;
  }

  private async requestWithRetry<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    await this.ensureAuthenticated();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const { baseUrl } = this.getConfig();
        const url = `${baseUrl}${endpoint}`;

        const headers = this.buildHeaders(options);

        const requestOptions: RequestInit = { method, headers };
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          requestOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, requestOptions);

        // If 401, try re-authenticating once
        if (response.status === 401 && attempt === 0) {
          await this.authenticate();
          continue;
        }

        if (!response.ok) {
          const responseBody = await response.text().catch(() => null);
          throw new VeloxAPIError(
            `Velox API error: ${response.status} ${response.statusText}`,
            response.status,
            endpoint,
            responseBody,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on 4xx errors (except 401 handled above)
        if (error instanceof VeloxAPIError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Exponential backoff before next retry
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  // ── Public API Methods ──────────────────────────────────────────────────

  async getProducts(params?: VeloxProductsParams): Promise<VeloxProduct[]> {
    const client = this.getSdkClient();
    const result = await client.getProducts(params);
    return result.items as unknown as VeloxProduct[];
  }

  async getCurrentExchangeRate(): Promise<number> {
    const config = this.getConfig();
    const response = await fetch(`${config.baseUrl}/public/menu/store/${config.storeId}`, {
      headers: {
        'x-storefront-store-id': config.storeId,
        'x-storefront-secret': this.storefrontSecret ?? '',
        'x-velox-api-version': '2.0.0',
      },
    });

    if (!response.ok) {
      throw new VeloxAPIError(
        `Unable to fetch Velox exchange rate: ${response.statusText}`,
        response.status,
        `/public/menu/store/${config.storeId}`,
        await response.text().catch(() => null),
      );
    }

    const body = (await response.json()) as { exchange_rate?: unknown };
    const rate = Number(body.exchange_rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Velox returned an invalid exchange rate');
    }

    return rate;
  }

  async getStock(
    productId: string,
    variantId?: string,
  ): Promise<VeloxStockResponse> {
    const query = variantId ? `?variant_id=${encodeURIComponent(variantId)}` : '';
    return this.requestWithRetry<VeloxStockResponse>(
      'GET',
      `/inventory/stock/${productId}${query}`,
    );
  }

  async createSale(data: VeloxSalePayload): Promise<unknown> {
    return this.requestWithRetry<unknown>('POST', '/sales', data);
  }

  /**
   * Upsert a web order in Velox via the public storefront v2 endpoint.
   *
   * Uses the per-store URL `/web-orders/public/{storeId}` (validated by
   * `StorefrontAuthGuard`). The idempotency key is the order id so retries
   * from the outbox worker are safe and replays are short-circuited.
   */
  async upsertWebOrder(
    data: VeloxWebOrderPayload,
    idempotencyKey: string,
  ): Promise<unknown> {
    const client = this.getSdkClient();
    return client.createWebOrder(data, { idempotencyKey });
  }

  async verifyWebOrderPayment(
    externalOrderId: string,
    idempotencyKey?: string,
  ): Promise<unknown> {
    const client = this.getSdkClient();
    return client.verifyPayment(externalOrderId, {
      idempotencyKey: idempotencyKey || externalOrderId,
    });
  }
}

export const veloxPosService = VeloxPosService.getInstance();
export default VeloxPosService;
