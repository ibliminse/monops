'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { MONAD_CHAIN_ID, isMonadMainnet } from '@/lib/chain';

export interface NetworkGuardState {
  isConnected: boolean;
  isCorrectNetwork: boolean;
  chainId: number | undefined;
  address: `0x${string}` | undefined;
  switchToMonad: () => void;
  error: string | null;
}

export function useNetworkGuard(): NetworkGuardState {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectNetwork = isMonadMainnet(chainId);

  const switchToMonad = () => {
    if (switchChain) {
      switchChain({ chainId: MONAD_CHAIN_ID });
    }
  };

  const error = isConnected && !isCorrectNetwork
    ? `Please switch to Monad Mainnet (Chain ID: ${MONAD_CHAIN_ID})`
    : null;

  return {
    isConnected,
    isCorrectNetwork,
    chainId,
    address,
    switchToMonad,
    error,
  };
}
