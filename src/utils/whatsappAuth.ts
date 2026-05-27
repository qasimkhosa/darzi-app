import { Linking } from 'react-native';
import type { PersistedUserRole, PersistedWhatsAppAuthChallenge } from '@/utils/persistence';

const DEFAULT_WHATSAPP_BUSINESS_NUMBER = '923000000433';
const CHALLENGE_LIFETIME_MINUTES = 10;

export type WhatsAppAuthStatus = 'pending' | 'verified' | 'expired' | 'rejected';

export type WhatsAppAuthStatusResult = {
  status: WhatsAppAuthStatus;
  phone: string;
  user_type: PersistedUserRole;
  verified_at: string | null;
  expires_at: string;
};

function getRandomBytes(length: number) {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function randomBase36(length: number) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = getRandomBytes(length);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function normalizeWhatsAppBusinessNumber(value: string | undefined) {
  return (value || DEFAULT_WHATSAPP_BUSINESS_NUMBER).replace(/[^\d]/g, '');
}

export function getDarziWhatsAppBusinessNumber() {
  return normalizeWhatsAppBusinessNumber(process.env.EXPO_PUBLIC_DARZI_WHATSAPP_NUMBER);
}

export function createWhatsAppAuthChallenge(
  phone: string,
  accountType: PersistedUserRole,
): PersistedWhatsAppAuthChallenge {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + CHALLENGE_LIFETIME_MINUTES * 60 * 1000);
  const publicCode = `DZ-${randomBase36(6)}`;
  const lookupToken = randomBase36(32);

  return {
    id: `wa-${createdAt.getTime()}-${randomBase36(10).toLowerCase()}`,
    lookupToken,
    challengeCode: publicCode,
    phone,
    accountType,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function isWhatsAppChallengeExpired(challenge: PersistedWhatsAppAuthChallenge) {
  return new Date(challenge.expiresAt).getTime() <= Date.now();
}

export function buildWhatsAppAuthMessage(challenge: PersistedWhatsAppAuthChallenge) {
  const roleLabel = challenge.accountType === 'tailor' ? 'Tailor' : 'Customer';

  return [
    `Darzi login code: ${challenge.challengeCode}`,
    `Phone: ${challenge.phone}`,
    `Account: ${roleLabel}`,
    '',
    'Please send this message to verify my Darzi account.',
  ].join('\n');
}

export function buildWhatsAppAuthUrl(challenge: PersistedWhatsAppAuthChallenge) {
  const businessNumber = getDarziWhatsAppBusinessNumber();
  const text = encodeURIComponent(buildWhatsAppAuthMessage(challenge));

  return `https://wa.me/${businessNumber}?text=${text}`;
}

export async function openWhatsAppAuthMessage(challenge: PersistedWhatsAppAuthChallenge) {
  const url = buildWhatsAppAuthUrl(challenge);
  const canOpen = await Linking.canOpenURL(url);

  if (!canOpen) {
    throw new Error('WhatsApp is not available on this phone. Install WhatsApp or use SMS OTP.');
  }

  await Linking.openURL(url);
}

export async function createRemoteWhatsAppAuthChallenge(
  client: any,
  challenge: PersistedWhatsAppAuthChallenge,
) {
  const { error } = await client.from('whatsapp_auth_challenges').insert({
    id: challenge.id,
    lookup_token: challenge.lookupToken,
    phone: challenge.phone,
    user_type: challenge.accountType,
    challenge_code: challenge.challengeCode,
    status: 'pending',
    expires_at: challenge.expiresAt,
  });

  if (error) {
    throw error;
  }
}

export async function fetchRemoteWhatsAppAuthStatus(
  client: any,
  challenge: PersistedWhatsAppAuthChallenge,
): Promise<WhatsAppAuthStatusResult | null> {
  const { data, error } = await client.rpc('get_whatsapp_auth_challenge_status', {
    target_id: challenge.id,
    target_lookup_token: challenge.lookupToken,
  });

  if (error) {
    throw error;
  }

  const firstRow = Array.isArray(data) ? data[0] : data;
  if (!firstRow || typeof firstRow.status !== 'string') return null;

  return firstRow as WhatsAppAuthStatusResult;
}
