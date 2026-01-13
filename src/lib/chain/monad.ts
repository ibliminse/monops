import { defineChain } from 'viem';

/**
 * Monad Mainnet Chain Configuration
 * Chain ID: 143
 * Native Token: MON
 */
export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://rpc.monad.xyz'],
      webSocket: [process.env.NEXT_PUBLIC_MONAD_WS_URL || 'wss://rpc.monad.xyz'],
    },
    public: {
      http: ['https://rpc.monad.xyz'],
      webSocket: ['wss://rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadVision',
      url: 'https://monadvision.com',
    },
  },
});

// Network guardrail constants
export const MONAD_CHAIN_ID = 143;
export const MONAD_SYMBOL = 'MON';

// Default scan parameters
export const DEFAULT_SCAN_BLOCK_RANGE = 500_000;
export const MAX_LOGS_PER_REQUEST = 10_000;

// Rate limiting helpers (25 rps for public RPC)
export const RPC_RATE_LIMIT_RPS = 25;
export const RPC_BATCH_LIMIT = 100;

/**
 * Check if the provided chain ID matches Monad mainnet
 */
export function isMonadMainnet(chainId: number | undefined): boolean {
  return chainId === MONAD_CHAIN_ID;
}

/**
 * Throws if not on Monad mainnet
 */
export function assertMonadMainnet(chainId: number | undefined): asserts chainId is 143 {
  if (!isMonadMainnet(chainId)) {
    throw new Error(
      `This app only supports Monad Mainnet (Chain ID: ${MONAD_CHAIN_ID}). ` +
      `Current chain ID: ${chainId ?? 'none'}`
    );
  }
}
