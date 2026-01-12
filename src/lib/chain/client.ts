import { createPublicClient, http, type PublicClient } from 'viem';
import { monadMainnet } from './monad';

const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://rpc.monad.xyz';

/**
 * Public client for reading from Monad mainnet
 */
let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: monadMainnet,
      transport: http(RPC_URL),
      batch: {
        multicall: true,
      },
    });
  }
  return publicClient;
}
