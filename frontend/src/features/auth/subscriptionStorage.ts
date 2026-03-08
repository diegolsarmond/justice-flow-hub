import type { AuthUser } from "./types";

const SUBSCRIPTION_STORAGE_BASE_KEY = "subscriptionId";
const SUBSCRIPTION_STORAGE_ANONYMOUS_SUFFIX = "anonymous";
const SUBSCRIPTION_STORAGE_ANONYMOUS_KEY = `${SUBSCRIPTION_STORAGE_BASE_KEY}:${SUBSCRIPTION_STORAGE_ANONYMOUS_SUFFIX}`;

export const SUBSCRIPTION_STORAGE_LEGACY_KEYS = [SUBSCRIPTION_STORAGE_BASE_KEY] as const;

export const getSubscriptionStorageKey = (user: AuthUser | null | undefined): string => {
  const identifier = user?.empresa_id ?? user?.id;
  const normalized =
    identifier === null || identifier === undefined
      ? SUBSCRIPTION_STORAGE_ANONYMOUS_SUFFIX
      : String(identifier);

  return `${SUBSCRIPTION_STORAGE_BASE_KEY}:${normalized}`;
};

export const getSubscriptionStorageKeysToClear = (user: AuthUser | null | undefined): string[] => {
  const currentKey = getSubscriptionStorageKey(user);
  const unique = new Set<string>([
    currentKey,
    SUBSCRIPTION_STORAGE_ANONYMOUS_KEY,
    ...SUBSCRIPTION_STORAGE_LEGACY_KEYS,
  ]);
  return Array.from(unique);
};

export const getAdditionalSubscriptionStorageKeys = (
  user: AuthUser | null | undefined,
  currentKey: string,
): string[] => {
  const unique = new Set<string>([currentKey]);
  const candidates = [getSubscriptionStorageKeysToClear(null), getSubscriptionStorageKeysToClear(user)];
  for (const list of candidates) {
    for (const key of list) {
      unique.add(key);
    }
  }
  unique.delete(currentKey);
  return Array.from(unique);
};
