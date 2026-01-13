'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

const STORAGE_KEY = 'monops_usage_tracking';
const PROMPT_INTERVALS = [1, 5, 10, 20, 50]; // Show prompt at these action counts

interface UsageData {
  visitorId: string;
  walletAddress?: string;
  actionCount: number;
  lastPromptAt: number; // Action count when last shown
  dismissedAt?: number;
  isSupporter: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let visitorId = localStorage.getItem('monops_visitor_id');
  if (!visitorId) {
    visitorId = generateId();
    localStorage.setItem('monops_visitor_id', visitorId);
  }
  return visitorId;
}

function getUsageData(walletAddress?: string): UsageData {
  if (typeof window === 'undefined') {
    return { visitorId: '', actionCount: 0, lastPromptAt: 0, isSupporter: false };
  }

  const visitorId = getVisitorId();
  const key = walletAddress ? `${STORAGE_KEY}_${walletAddress.toLowerCase()}` : `${STORAGE_KEY}_${visitorId}`;

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}

  return {
    visitorId,
    walletAddress,
    actionCount: 0,
    lastPromptAt: 0,
    isSupporter: false,
  };
}

function saveUsageData(data: UsageData, walletAddress?: string) {
  if (typeof window === 'undefined') return;

  const visitorId = getVisitorId();
  const key = walletAddress ? `${STORAGE_KEY}_${walletAddress.toLowerCase()}` : `${STORAGE_KEY}_${visitorId}`;
  localStorage.setItem(key, JSON.stringify(data));
}

export function useDonationPrompt() {
  const { address } = useAccount();
  const [shouldShow, setShouldShow] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  // Load usage data on mount
  useEffect(() => {
    const data = getUsageData(address);
    setUsageData(data);
  }, [address]);

  // Check if we should show the prompt
  const checkShouldShow = useCallback(() => {
    if (!usageData) return false;
    if (usageData.isSupporter) return false;

    const { actionCount, lastPromptAt, dismissedAt } = usageData;

    // Don't show if dismissed in the last hour
    if (dismissedAt && Date.now() - dismissedAt < 60 * 60 * 1000) {
      return false;
    }

    // Check if we've hit a prompt interval
    for (const interval of PROMPT_INTERVALS) {
      if (actionCount >= interval && lastPromptAt < interval) {
        return true;
      }
    }

    // After all intervals, show every 25 actions
    if (actionCount > PROMPT_INTERVALS[PROMPT_INTERVALS.length - 1]) {
      const lastInterval = PROMPT_INTERVALS[PROMPT_INTERVALS.length - 1];
      const actionsSinceLastInterval = actionCount - lastInterval;
      const promptsSinceLastInterval = Math.floor(actionsSinceLastInterval / 25);
      const expectedPrompts = lastPromptAt - lastInterval;

      if (actionsSinceLastInterval > 0 && promptsSinceLastInterval * 25 > expectedPrompts) {
        return true;
      }
    }

    return false;
  }, [usageData]);

  // Track an action
  const trackAction = useCallback(() => {
    if (!usageData) return;

    const newData = {
      ...usageData,
      actionCount: usageData.actionCount + 1,
    };

    setUsageData(newData);
    saveUsageData(newData, address);

    // Check if we should show prompt after this action
    if (!newData.isSupporter) {
      for (const interval of PROMPT_INTERVALS) {
        if (newData.actionCount === interval && newData.lastPromptAt < interval) {
          setShouldShow(true);
          return;
        }
      }

      // Check for recurring prompts after last interval
      const lastInterval = PROMPT_INTERVALS[PROMPT_INTERVALS.length - 1];
      if (newData.actionCount > lastInterval && (newData.actionCount - lastInterval) % 25 === 0) {
        setShouldShow(true);
      }
    }
  }, [usageData, address]);

  // Dismiss the prompt
  const dismissPrompt = useCallback(() => {
    if (!usageData) return;

    const newData = {
      ...usageData,
      lastPromptAt: usageData.actionCount,
      dismissedAt: Date.now(),
    };

    setUsageData(newData);
    saveUsageData(newData, address);
    setShouldShow(false);
  }, [usageData, address]);

  // Mark as supporter (hide forever)
  const markAsSupporter = useCallback(() => {
    if (!usageData) return;

    const newData = {
      ...usageData,
      isSupporter: true,
    };

    setUsageData(newData);
    saveUsageData(newData, address);
    setShouldShow(false);
  }, [usageData, address]);

  return {
    shouldShow,
    actionCount: usageData?.actionCount ?? 0,
    trackAction,
    dismissPrompt,
    markAsSupporter,
  };
}
