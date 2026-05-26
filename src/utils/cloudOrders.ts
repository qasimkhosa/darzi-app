import type { PostgrestError } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Database, Json, OrderStatus } from '@/types/database';

export type CloudOrder = Database['public']['Tables']['orders']['Row'];
export type CloudOrderInsert = Database['public']['Tables']['orders']['Insert'];
export type CloudOrderUpdate = Database['public']['Tables']['orders']['Update'];
export type UiOrderStatus = 'In Cutting' | 'Stitching' | 'Ready' | 'Delivered';
export type CustomerParchiStatus =
  | 'Order Placed'
  | 'In Cutting'
  | 'Stitching'
  | 'Ready for Pickup'
  | 'Delivered';

export const activeTailorDarziId = 433;
export const activeTailorShopName = 'Khan Tailors';

const dbToUiStatus: Record<OrderStatus, UiOrderStatus> = {
  pending: 'In Cutting',
  cutting: 'In Cutting',
  stitching: 'Stitching',
  ready: 'Ready',
  delivered: 'Delivered',
};

const uiToDbStatus: Record<UiOrderStatus, OrderStatus> = {
  'In Cutting': 'cutting',
  Stitching: 'stitching',
  Ready: 'ready',
  Delivered: 'delivered',
};

const dbToCustomerStatus: Record<OrderStatus, CustomerParchiStatus> = {
  pending: 'Order Placed',
  cutting: 'In Cutting',
  stitching: 'Stitching',
  ready: 'Ready for Pickup',
  delivered: 'Delivered',
};

export function toUiOrderStatus(status: OrderStatus): UiOrderStatus {
  return dbToUiStatus[status];
}

export function toCustomerParchiStatus(status: OrderStatus): CustomerParchiStatus {
  return dbToCustomerStatus[status];
}

export function toDbOrderStatus(status: UiOrderStatus): OrderStatus {
  return uiToDbStatus[status];
}

export function formatCloudOrderId(orderId: string) {
  return orderId.startsWith('#') ? orderId : `#DZ-${orderId.slice(0, 4).toUpperCase()}`;
}

export function formatDeliveryLabel(isoDate: string) {
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate));
}

export function formatMeasurementLabel(key: string) {
  return key
    .replace(/^custom[_\s-]*/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/\b\w/g, (firstLetter) => firstLetter.toUpperCase());
}

export function jsonToMeasurementRecord(value: Json): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<Record<string, number>>((next, [key, item]) => {
    return typeof item === 'number' && Number.isFinite(item)
      ? { ...next, [key]: item }
      : next;
  }, {});
}

export function measurementRecordToJson(value: Record<string, number>): Json {
  return value;
}

function logCloudOrderError(label: string, error: unknown) {
  if (__DEV__) {
    console.info(`[DarziCloudOrders] ${label}`, error);
  }
}

function throwIfSupabaseUnavailable() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return supabase;
}

function getUntypedSupabaseClient() {
  return throwIfSupabaseUnavailable() as any;
}

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = token === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function ensureCustomerProfile(customerName: string, customerMobile: string) {
  const client = getUntypedSupabaseClient();
  const normalizedMobile = customerMobile.trim();

  const { data: existingProfile, error: lookupError } = await client
    .from('profiles')
    .select('id')
    .eq('phone', normalizedMobile)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingProfile?.id) {
    return existingProfile.id;
  }

  const placeholderProfile = {
    id: generateUuid(),
    user_type: 'customer' as const,
    full_name: customerName.trim(),
    phone: normalizedMobile,
    created_at: new Date().toISOString(),
  };

  const { data: insertedProfile, error: insertError } = await client
    .from('profiles')
    .insert(placeholderProfile)
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedProfile.id;
}

export async function resolveActiveTailorProfileId() {
  const client = getUntypedSupabaseClient();
  const { data: authData } = await client.auth.getUser();
  const authUserId = authData?.user?.id;

  if (!authUserId) {
    throw new Error('You must be signed in as a tailor to manage shop orders.');
  }

  const { data: ownTailorProfile, error: ownTailorLookupError } = await client
    .from('tailor_profiles')
    .select('id')
    .eq('id', authUserId)
    .maybeSingle();

  if (ownTailorLookupError) {
    throw ownTailorLookupError;
  }

  if (!ownTailorProfile?.id) {
    throw new Error('No tailor profile exists for the signed-in account.');
  }

  return ownTailorProfile.id;
}

export async function fetchAuthenticatedProfilePhone() {
  const client = getUntypedSupabaseClient();
  const { data: authData } = await client.auth.getUser();
  const authUserId = authData?.user?.id;

  if (!authUserId) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('phone')
    .eq('id', authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.phone === 'string' && data.phone.trim().length > 0
    ? data.phone
    : null;
}

export async function insertCloudOrder(order: CloudOrderInsert) {
  const client = getUntypedSupabaseClient();
  const { data, error } = await client
    .from('orders')
    .insert(order)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchCloudOrdersByTailor(tailorId: string) {
  const client = getUntypedSupabaseClient();
  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('tailor_id', tailorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchCloudOrdersByCustomerMobile(customerMobile: string) {
  const client = getUntypedSupabaseClient();
  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('customer_mobile', customerMobile)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCloudOrderStatus(orderId: string, status: OrderStatus) {
  const client = getUntypedSupabaseClient();
  const { error } = await client
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  if (error) {
    throw error;
  }
}

export function shouldUseLocalCloudFallback(error: unknown): error is PostgrestError | Error {
  logCloudOrderError('Cloud order operation failed', error);
  return true;
}
