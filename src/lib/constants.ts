// ============================================
// Clazico Store — Application Constants
// ============================================

/**
 * Store information displayed across the site
 */
export const STORE_INFO = {
  name: "ClaZico",
  tagline: "Realiza tu Compra",
  description: "Zapatos y ropa de marcas reconocidas",
  phone: "0412-5806711",
  phone1: "0412-0815850",
  email: "info@clazico.com",
  instagram: "@clazico.ve",
  instagramSport: "@clazicosport",
  address: "Calle 79 con Av 16 Delicias, Sector Paraíso. Maracaibo, Zulia.",
  workingHours: "Lun - Sáb: 9:00 AM - 7:00 PM",
} as const;

/**
 * Payment methods available in Venezuela
 */
export const PAYMENT_METHODS = [
  {
    id: "PAGO_MOVIL",
    label: "Pago Móvil",
    icon: "💳",
    currency: "BSS",
    description: "Pago inmediato desde tu banco",
    instructions: [
      "Abre la app de tu banco",
      "Selecciona Pago Móvil",
      "Ingresa los datos que aparecen abajo",
      "Envía el comprobante con el número de referencia",
    ],
  },
  {
    id: "ZELLE",
    label: "Zelle",
    icon: "💵",
    currency: "USD",
    description: "Datos disponibles por WhatsApp",
    instructions: [
      "Solicita los datos actualizados por WhatsApp",
      "Confirma el monto antes de pagar",
      "Envía captura de confirmación al finalizar",
    ],
  },
  {
    id: "ZINLI",
    label: "Zinli",
    icon: "📲",
    currency: "USD",
    description: "Pago en divisas vía Zinli",
    instructions: [
      "Envía el monto indicado al correo Zinli",
      "Incluye el número de pedido en la nota",
      "Envía captura de confirmación",
    ],
  },
  {
    id: "WALLY",
    label: "Wally",
    icon: "📲",
    currency: "USD",
    description: "Pago en divisas vía Wally",
    instructions: [
      "Envía el monto indicado al teléfono Wally",
      "Incluye el número de pedido en la nota",
      "Envía captura de confirmación",
    ],
  },
  {
    id: "CASH_USD",
    label: "Efectivo USD",
    icon: "💲",
    currency: "USD",
    description: "Pago al retirar en tienda (dólares)",
    instructions: [
      "Retira tu pedido en nuestra tienda",
      "Paga el monto exacto en dólares",
      "Recibirás tu factura al momento",
    ],
  },
  {
    id: "CASH_BSS",
    label: "Efectivo Bs.",
    icon: "💰",
    currency: "BSS",
    description: "Pago al retirar en tienda (bolívares)",
    instructions: [
      "Retira tu pedido en nuestra tienda",
      "Paga el monto equivalente en bolívares",
      "La tasa de cambio aplicada será la del día",
    ],
  },
  {
    id: "BINANCE",
    label: "Binance / USDT",
    icon: "₿",
    currency: "USD",
    description: "Pago con criptomonedas",
    instructions: [
      "Envía USDT al Binance ID indicado",
      "Usa la red TRC-20 o BEP-20",
      "Incluye el número de pedido en el memo",
      "Envía captura del TxID",
    ],
  },
] as const;

/**
 * Payment receiving details (configurable via admin)
 */
export const PAYMENT_DETAILS = {
  PAGO_MOVIL: [
    {
      bank: "Bancamiga",
      code: "0172",
      phone: "0412-5806711",
      cedula: "29.999.867",
    },
    {
      bank: "Banesco",
      code: "0134",
      phone: "0412-5806711",
      cedula: "29.999.867",
    },
  ],
  ZELLE: {
    whatsappMessage: "Hola Clazico Store. Quiero consultar los datos para pagar por Zelle.",
  },
  BINANCE: {
    username: "ClazicoStore",
    userId: "209307335",
    email: "clazico.ve1@gmail.com",
  },
  ZINLI: {
    email: "jesus22castillojesus22@hotmail.com",
  },
  WALLY: {
    phone: "04125806711",
  },
} as const;

/**
 * Order statuses flow
 */
export const ORDER_STATUSES = [
  { id: "PENDING_PAYMENT", label: "Pendiente de Pago", step: 1 },
  { id: "PAYMENT_SUBMITTED", label: "Pago Enviado", step: 2 },
  { id: "PAYMENT_VERIFIED", label: "Pago Verificado", step: 3 },
  { id: "PROCESSING", label: "En Proceso", step: 4 },
  { id: "READY", label: "Listo para Entrega", step: 5 },
  { id: "DELIVERED", label: "Entregado", step: 6 },
] as const;

/**
 * Venezuelan states for address selection
 */
export const VENEZUELAN_STATES = [
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Distrito Capital",
  "Falcón",
  "Guárico",
  "Lara",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "La Guaira",
  "Yaracuy",
  "Zulia",
] as const;

/**
 * Venezuelan banks for Pago Móvil
 */
export const VENEZUELAN_BANKS = [
  { code: "0102", name: "Banco de Venezuela" },
  { code: "0104", name: "Venezolano de Crédito" },
  { code: "0105", name: "Mercantil" },
  { code: "0108", name: "BBVA Provincial" },
  { code: "0114", name: "Bancaribe" },
  { code: "0115", name: "Exterior" },
  { code: "0128", name: "Banco Caroní" },
  { code: "0134", name: "Banesco" },
  { code: "0137", name: "Sofitasa" },
  { code: "0138", name: "Banco Plaza" },
  { code: "0146", name: "Banco de la Gente Emprendedora (Bangente)" },
  { code: "0151", name: "BFC Banco Fondo Común" },
  { code: "0156", name: "100% Banco" },
  { code: "0157", name: "Del Sur" },
  { code: "0163", name: "Banco del Tesoro" },
  { code: "0166", name: "Banco Agrícola de Venezuela" },
  { code: "0168", name: "Bancamiga" },
  { code: "0169", name: "Mi Banco" },
  { code: "0171", name: "Activo" },
  { code: "0172", name: "Bancrecer" },
  { code: "0174", name: "Banplus" },
  { code: "0175", name: "Bicentenario del Pueblo" },
  { code: "0177", name: "Banfanb" },
  { code: "0191", name: "BNC Nacional de Crédito" },
] as const;

/**
 * Product categories for filtering
 */
export const PRODUCT_CATEGORIES = {
  SHOES: {
    label: "Zapatos",
    subcategories: [
      "Deportivos",
      "Casuales",
      "Formales",
      "Sandalias",
      "Botas",
      "Plataformas",
    ],
  },
  CLOTHING: {
    label: "Ropa",
    subcategories: [
      "Camisas",
      "Franelas",
      "Pantalones",
      "Shorts",
      "Vestidos",
      "Chaquetas",
      "Faldas",
    ],
  },
  ACCESSORIES: {
    label: "Accesorios",
    subcategories: [
      "Bolsos",
      "Carteras",
      "Cinturones",
      "Gorras",
      "Lentes",
    ],
  },
} as const;

/**
 * Sizes for shoes and clothing
 */
export const SIZES = {
  SHOES: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  CLOTHING: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
} as const;

/**
 * Delivery methods
 */
export const DELIVERY_METHODS = [
  {
    id: "PICKUP",
    label: "Retiro en Tienda",
    icon: "🏬",
    description: "Retira tu pedido en nuestra tienda sin costo adicional",
    price: 0,
  },
  {
    id: "DELIVERY",
    label: "Delivery Maracaibo",
    icon: "🚚",
    description: "Entrega local solo dentro de Maracaibo, con costo según ubicación",
    price: null, // Calculated per location
  },
  {
    id: "NATIONAL_SHIPPING",
    label: "Envío Nacional",
    icon: "📦",
    description: "Encomienda para el resto del país por MRW, ZOOM, TEALCA u operador acordado",
    price: null,
  },
] as const;

/**
 * Sync configuration
 */
export const SYNC_CONFIG = {
  PRODUCT_SYNC_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes
  STOCK_CACHE_TTL_MS: 60 * 1000, // 1 minute
  EXCHANGE_RATE_CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 48,
  ADMIN_PAGE_SIZE: 20,
} as const;
