/**
 * Plan/Monetization Scaffolding
 * For MVP, this is stored in localStorage
 * Later: replace with Stripe subscription check
 */

export type PlanType = 'free' | 'pro';

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
  pro: {
    maxBatchSize: 1000,
    maxExportRows: 10000,
    maxWatchedCollections: 50,
    maxStoredWallets: 100,
  },
};

const PLAN_STORAGE_KEY = 'monops_plan';

export function getCurrentPlan(): PlanType {
  if (typeof window === 'undefined') return 'free';
  const stored = localStorage.getItem(PLAN_STORAGE_KEY);
  if (stored === 'pro') return 'pro';
  return 'free';
}

export function setCurrentPlan(plan: PlanType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLAN_STORAGE_KEY, plan);
}

export function getPlanLimits(): PlanLimits {
  return PLAN_LIMITS[getCurrentPlan()];
}

export function isPro(): boolean {
  return getCurrentPlan() === 'pro';
}

// TODO: Replace with Stripe integration
// export async function checkStripeSubscription(userId: string): Promise<PlanType> {
//   const response = await fetch('/api/subscription/check', { ... });
//   return response.json();
// }
