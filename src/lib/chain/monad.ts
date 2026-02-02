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
export const MONAD_CHAIN_ID_HEX = '0x8f';
export const MONAD_SYMBOL = 'MON';

// RPC endpoints in priority order
export const MONAD_RPC_PRIMARY = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://rpc.monad.xyz';
export const MONAD_RPC_FALLBACKS: string[] = [
  // Add backup RPCs here as Monad ecosystem grows
];

// Etherscan V2 API (supports Monad via chainid parameter)
export const ETHERSCAN_API_BASE = 'https://api.etherscan.io/v2/api';

// Moralis API
export const MORALIS_API_BASE = 'https://deep-index.moralis.io/api/v2.2';

// Default scan parameters (configurable via env)
export const DEFAULT_SCAN_BLOCK_RANGE = Number(
  process.env.NEXT_PUBLIC_SCAN_BLOCK_RANGE || '500000'
);
export const MAX_LOGS_PER_REQUEST = 10_000;

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
