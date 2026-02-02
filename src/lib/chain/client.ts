import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { monadMainnet, MONAD_RPC_PRIMARY, MONAD_RPC_FALLBACKS } from './monad';

function buildTransports() {
  const urls = [MONAD_RPC_PRIMARY, ...MONAD_RPC_FALLBACKS.filter(url => url !== MONAD_RPC_PRIMARY)];
  return urls.map(url => http(url, { timeout: 10_000 }));
}

function buildTransport() {
  const transports = buildTransports();
  return transports.length === 1
    ? transports[0]
    : fallback(transports, { rank: true });
}

/**
 * Singleton public client for client-side and feature modules.
 * Uses fallback transport for RPC resilience.
 */
let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: monadMainnet,
      transport: buildTransport(),
      batch: { multicall: true },
    });
  }
  return publicClient;
}

/**
 * Fresh public client for API routes (serverless-safe).
 * Each invocation gets its own client to avoid singleton
 * issues across cold starts.
 */
export function createServerClient(): PublicClient {
  return createPublicClient({
    chain: monadMainnet,
    transport: buildTransport(),
    batch: { multicall: true },
  });
}
