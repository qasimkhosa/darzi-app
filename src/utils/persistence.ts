import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type PersistedUserRole = 'customer' | 'tailor';
export type PersistedLanguage = 'en' | 'ur';

export type PersistedOrderStatus = 'In Cutting' | 'Stitching' | 'Ready' | 'Delivered';

export type PersistedLocalOrder = {
  id: string;
  customerName: string;
  mobileNumber: string;
  suitType: string;
  orderId: string;
  deliveryDateIso: string;
  deliveryDateLabel: string;
  measurements: Record<string, number>;
  totalBill: number;
  advancePaid: number;
  remainingBalance: number;
  status: PersistedOrderStatus;
  createdAt: string;
};

export type PersistedLookbookPost = {
  id: string;
  title: string;
  tailorName: string;
  darziId: number;
  expertise: string;
  imageUri: string;
  thumbnailUri: string;
  likesCount: number;
  liked: boolean;
  description: string;
  area: string;
  createdAt: string;
};

export type PersistedReview = {
  id: string;
  orderId: string;
  tailorId: number;
  rating: number;
  feedback: string;
  createdAt: string;
};

export type PersistedWhatsAppAuthChallenge = {
  id: string;
  lookupToken: string;
  challengeCode: string;
  phone: string;
  accountType: PersistedUserRole;
  createdAt: string;
  expiresAt: string;
};

const storageKeys = {
  localOrders: 'darzi.localOrders.v1',
  savedBookmarks: 'darzi.savedBookmarks.v1',
  lookbookPosts: 'darzi.lookbookPosts.v1',
  reviews: 'darzi.reviews.v1',
  userRole: 'darzi.userRole.v1',
  localLanguage: 'darzi.localLanguage.v1',
  whatsappAuthChallenge: 'darzi.whatsappAuthChallenge.v1',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function isPersistedOrderStatus(value: unknown): value is PersistedOrderStatus {
  return value === 'In Cutting' || value === 'Stitching' || value === 'Ready' || value === 'Delivered';
}

function isPersistedLocalOrder(value: unknown): value is PersistedLocalOrder {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.customerName === 'string' &&
    typeof value.mobileNumber === 'string' &&
    typeof value.suitType === 'string' &&
    typeof value.orderId === 'string' &&
    typeof value.deliveryDateIso === 'string' &&
    typeof value.deliveryDateLabel === 'string' &&
    isNumberRecord(value.measurements) &&
    typeof value.totalBill === 'number' &&
    typeof value.advancePaid === 'number' &&
    typeof value.remainingBalance === 'number' &&
    isPersistedOrderStatus(value.status) &&
    typeof value.createdAt === 'string'
  );
}

function isPersistedLookbookPost(value: unknown): value is PersistedLookbookPost {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.tailorName === 'string' &&
    typeof value.darziId === 'number' &&
    typeof value.expertise === 'string' &&
    typeof value.imageUri === 'string' &&
    typeof value.thumbnailUri === 'string' &&
    typeof value.likesCount === 'number' &&
    typeof value.liked === 'boolean' &&
    typeof value.description === 'string' &&
    typeof value.area === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isPersistedReview(value: unknown): value is PersistedReview {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.orderId === 'string' &&
    typeof value.tailorId === 'number' &&
    typeof value.rating === 'number' &&
    typeof value.feedback === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isPersistedWhatsAppAuthChallenge(value: unknown): value is PersistedWhatsAppAuthChallenge {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.lookupToken === 'string' &&
    typeof value.challengeCode === 'string' &&
    typeof value.phone === 'string' &&
    (value.accountType === 'customer' || value.accountType === 'tailor') &&
    typeof value.createdAt === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

async function readJsonArray<T>(
  key: string,
  validator: (value: unknown) => value is T,
): Promise<T[]> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter(validator);
  } catch (error) {
    console.error(`[DarziPersistence] Failed to load ${key}`, error);
    return [];
  }
}

async function readJsonObject<T>(
  key: string,
  validator: (value: unknown) => value is T,
): Promise<T | null> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) return null;

    const parsedValue: unknown = JSON.parse(rawValue);
    return validator(parsedValue) ? parsedValue : null;
  } catch (error) {
    console.error(`[DarziPersistence] Failed to load ${key}`, error);
    return null;
  }
}

async function writeJsonArray<T>(key: string, value: T[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[DarziPersistence] Failed to save ${key}`, error);
  }
}

async function writeJsonObject<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[DarziPersistence] Failed to save ${key}`, error);
  }
}

async function writeSecureValue(key: string, value: string) {
  try {
    const secureStoreAvailable = await SecureStore.isAvailableAsync();

    if (secureStoreAvailable) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`[DarziPersistence] Failed to save secure value ${key}`, error);
  }
}

async function readSecureValue(key: string) {
  try {
    const secureStoreAvailable = await SecureStore.isAvailableAsync();

    if (secureStoreAvailable) {
      return await SecureStore.getItemAsync(key);
    }

    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`[DarziPersistence] Failed to load secure value ${key}`, error);
    return null;
  }
}

export async function saveLocalOrders(orders: PersistedLocalOrder[]) {
  await writeJsonArray(storageKeys.localOrders, orders);
}

export async function loadLocalOrders() {
  return readJsonArray(storageKeys.localOrders, isPersistedLocalOrder);
}

export async function saveSavedBookmarks(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  await writeJsonArray(storageKeys.savedBookmarks, uniqueIds);
}

export async function loadSavedBookmarks() {
  return readJsonArray(storageKeys.savedBookmarks, (value): value is string => typeof value === 'string');
}

export async function saveLookbookPosts(posts: PersistedLookbookPost[]) {
  await writeJsonArray(storageKeys.lookbookPosts, posts);
}

export async function loadLookbookPosts() {
  return readJsonArray(storageKeys.lookbookPosts, isPersistedLookbookPost);
}

export async function saveLocalReviews(reviews: PersistedReview[]) {
  await writeJsonArray(storageKeys.reviews, reviews);
}

export async function loadLocalReviews() {
  return readJsonArray(storageKeys.reviews, isPersistedReview);
}

export async function savePendingWhatsAppAuthChallenge(challenge: PersistedWhatsAppAuthChallenge) {
  await writeJsonObject(storageKeys.whatsappAuthChallenge, challenge);
}

export async function loadPendingWhatsAppAuthChallenge() {
  return readJsonObject(storageKeys.whatsappAuthChallenge, isPersistedWhatsAppAuthChallenge);
}

export async function clearPendingWhatsAppAuthChallenge() {
  try {
    await AsyncStorage.removeItem(storageKeys.whatsappAuthChallenge);
  } catch (error) {
    console.error('[DarziPersistence] Failed to clear WhatsApp auth challenge', error);
  }
}

export async function saveUserRole(role: PersistedUserRole) {
  await writeSecureValue(storageKeys.userRole, role);
}

export async function loadUserRole(): Promise<PersistedUserRole | null> {
  const role = await readSecureValue(storageKeys.userRole);
  return role === 'customer' || role === 'tailor' ? role : null;
}

export async function saveLocalLanguage(language: PersistedLanguage) {
  try {
    await AsyncStorage.setItem(storageKeys.localLanguage, language);
  } catch (error) {
    console.error('[DarziPersistence] Failed to save local language', error);
  }
}

export async function loadLocalLanguage(): Promise<PersistedLanguage | null> {
  try {
    const language = await AsyncStorage.getItem(storageKeys.localLanguage);
    return language === 'en' || language === 'ur' ? language : null;
  } catch (error) {
    console.error('[DarziPersistence] Failed to load local language', error);
    return null;
  }
}

export async function clearDarziLocalPersistence() {
  try {
    await AsyncStorage.multiRemove([
      storageKeys.localOrders,
      storageKeys.savedBookmarks,
      storageKeys.lookbookPosts,
      storageKeys.reviews,
      storageKeys.localLanguage,
      storageKeys.whatsappAuthChallenge,
    ]);
    const secureStoreAvailable = await SecureStore.isAvailableAsync();

    if (secureStoreAvailable) {
      await SecureStore.deleteItemAsync(storageKeys.userRole);
    } else {
      await AsyncStorage.removeItem(storageKeys.userRole);
    }
  } catch (error) {
    console.error('[DarziPersistence] Failed to clear local persistence', error);
  }
}

export { storageKeys };
