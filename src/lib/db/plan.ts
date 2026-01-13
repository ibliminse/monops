/**
 * Donation-based Feature Access
 * Users who donate get whitelisted for premium features
 */

// Donation wallet - update this to your wallet address
export const DONATION_WALLET = '0x1234567890123456789012345678901234567890';

// Whitelisted addresses (donors) - add addresses here after they donate
// Format: lowercase addresses
export const WHITELIST: string[] = [
  // Add donor addresses here:
  // '0xabc123...',
];

export type PlanType = 'free' | 'supporter';

export interface PlanLimits {
  maxBatchSize: number;
  maxExportRows: number;
  maxWatchedCollections: number;
  maxStoredWallets: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxBatchSize: 10,
    maxExportRows: 100,
    maxWatchedCollections: 3,
    maxStoredWallets: 5,
  },
  supporter: {
    maxBatchSize: 1000,
    maxExportRows: 10000,
    maxWatchedCollections: 50,
    maxStoredWallets: 100,
  },
};

/**
 * Check if a wallet address is whitelisted (donated)
 */
export function isWhitelisted(address: string | undefined): boolean {
  if (!address) return false;
  return WHITELIST.includes(address.toLowerCase());
}

/**
 * Get current plan based on connected wallet
 */
export function getCurrentPlan(address: string | undefined): PlanType {
  if (isWhitelisted(address)) return 'supporter';
  return 'free';
}

/**
 * Get plan limits for the connected wallet
 */
export function getPlanLimits(address?: string): PlanLimits {
  return PLAN_LIMITS[getCurrentPlan(address)];
}

/**
 * Check if wallet has supporter status
 */
export function isSupporter(address: string | undefined): boolean {
  return getCurrentPlan(address) === 'supporter';
}
