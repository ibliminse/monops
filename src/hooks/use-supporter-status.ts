'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { isWhitelisted } from '@/lib/db/plan';

const STORAGE_KEY = 'monops_verified_supporters';

interface VerifiedDonation {
  address: string;
  txHash: string;
  verifiedAt: number;
}

function getStoredSupporters(): VerifiedDonation[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeSupporter(donation: VerifiedDonation) {
  const supporters = getStoredSupporters();
  const existing = supporters.find(s => s.address.toLowerCase() === donation.address.toLowerCase());
  if (!existing) {
    supporters.push(donation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(supporters));
  }
}

function isStoredSupporter(address: string): boolean {
  const supporters = getStoredSupporters();
  return supporters.some(s => s.address.toLowerCase() === address.toLowerCase());
}

export function useSupporterStatus() {
  const { address } = useAccount();
  const [isSupporter, setIsSupporter] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check status on mount and address change
  useEffect(() => {
    if (!address) {
      setIsSupporter(false);
      return;
    }

    // Check hardcoded whitelist first
    if (isWhitelisted(address)) {
      setIsSupporter(true);
      return;
    }

    // Check localStorage for verified donations
    if (isStoredSupporter(address)) {
      setIsSupporter(true);
      return;
    }

    setIsSupporter(false);
  }, [address]);

  // Verify a donation tx
  const verifyDonation = useCallback(async (txHash: string) => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch('/api/verify-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, walletAddress: address }),
      });

      const data = await response.json();

      if (data.verified) {
        // Store in localStorage
        storeSupporter({
          address: address.toLowerCase(),
          txHash,
          verifiedAt: Date.now(),
        });
        setIsSupporter(true);
        setIsVerifying(false);
        return true;
      } else {
        setError(data.error || 'Verification failed');
        setIsVerifying(false);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setIsVerifying(false);
      return false;
    }
  }, [address]);

  return {
    isSupporter,
    isVerifying,
    error,
    verifyDonation,
  };
}
