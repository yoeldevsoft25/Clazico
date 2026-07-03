import 'server-only';

export const SHIPPING_CONFIG = {
  // Store location (Maracaibo center fallback)
  STORE_LAT: Number(process.env.STORE_LAT || 10.6427),
  STORE_LNG: Number(process.env.STORE_LNG || -71.6247),
  
  // Pricing rules
  NATIONAL_FLAT_RATE: Number(process.env.NATIONAL_SHIPPING_FEE_USD || 5.00),
  LOCAL_MIN_FEE_USD: Number(process.env.LOCAL_MIN_FEE_USD || 1.00),
  LOCAL_RATE_UNIT_KM: Number(process.env.LOCAL_RATE_UNIT_KM || 2),
  LOCAL_RATE_PER_UNIT_USD: Number(process.env.LOCAL_RATE_PER_UNIT_USD || 1.00),
  MAX_LOCAL_RADIUS_KM: Number(process.env.MAX_LOCAL_RADIUS_KM || 25),
  
  // Promotions
  FREE_SHIPPING_THRESHOLD_USD: 100.00,
  
  // Volume Surcharge
  VOLUME_THRESHOLD_ITEMS: 10,
  SURCHARGE_PER_EXTRA_ITEM: 0.50,
  
  // Integration with Velox POS
  VELOX_DELIVERY_PRODUCT_ID: process.env.VELOX_DELIVERY_PRODUCT_ID || '00000000-0000-0000-0000-000000000000',
};

// Haversine formula
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
}

export function calculateShippingCost(params: {
  state?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  itemsTotalUsd: number;
  totalQuantity: number;
}): { baseFee: number; volumeSurcharge: number; totalFee: number; isLocal: boolean; distanceKm: number | null } {
  let isLocal = false;
  let baseFee = SHIPPING_CONFIG.NATIONAL_FLAT_RATE;
  let distanceKm: number | null = null;
  
  // Step 1: Zone & Distance
  const isZulia = params.state?.toLowerCase().includes('zulia');
  const isMaracaibo = params.city?.toLowerCase().includes('maracaibo');
  
  if (isZulia && isMaracaibo) {
    isLocal = true;
    if (params.lat !== undefined && params.lat !== null && params.lng !== undefined && params.lng !== null) {
      distanceKm = calculateDistanceKm(
        SHIPPING_CONFIG.STORE_LAT, 
        SHIPPING_CONFIG.STORE_LNG, 
        params.lat, 
        params.lng
      );
      
      const distanceUnits = Math.max(1, Math.ceil(distanceKm / SHIPPING_CONFIG.LOCAL_RATE_UNIT_KM));
      baseFee = Math.max(
        SHIPPING_CONFIG.LOCAL_MIN_FEE_USD,
        distanceUnits * SHIPPING_CONFIG.LOCAL_RATE_PER_UNIT_USD,
      );
    } else {
      baseFee = 10;
    }
  }

  // Step 2: Promotions (Free shipping covers base fee)
  if (params.itemsTotalUsd >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD_USD) {
    baseFee = 0;
  }

  // Step 3: Volume Protection
  let volumeSurcharge = 0;
  if (params.totalQuantity > SHIPPING_CONFIG.VOLUME_THRESHOLD_ITEMS) {
    const extraItems = params.totalQuantity - SHIPPING_CONFIG.VOLUME_THRESHOLD_ITEMS;
    volumeSurcharge = extraItems * SHIPPING_CONFIG.SURCHARGE_PER_EXTRA_ITEM;
  }

  const totalFee = Number((baseFee + volumeSurcharge).toFixed(2));
  
  return {
    baseFee: Number(baseFee.toFixed(2)),
    volumeSurcharge: Number(volumeSurcharge.toFixed(2)),
    totalFee,
    isLocal,
    distanceKm: distanceKm ? Number(distanceKm.toFixed(2)) : null
  };
}
