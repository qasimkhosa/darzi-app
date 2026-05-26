const SCHEME = 'darzi';

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertUuid(value: string, label: string) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new Error(`${label} must be a valid UUID`);
  }
}

export function buildTailorDeepLink(darziId: number) {
  assertPositiveInteger(darziId, 'darzi_id');
  return `${SCHEME}://tailor/${darziId}`;
}

export function buildOrderDeepLink(orderId: string) {
  assertUuid(orderId, 'order_id');
  return `${SCHEME}://order/${encodeURIComponent(orderId)}`;
}

export function buildQrDeepLink(input: { darziId: number } | { orderId: string }) {
  if ('darziId' in input) {
    return buildTailorDeepLink(input.darziId);
  }

  return buildOrderDeepLink(input.orderId);
}
