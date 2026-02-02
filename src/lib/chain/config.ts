import { http, fallback } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadMainnet, MONAD_CHAIN_ID, MONAD_RPC_PRIMARY, MONAD_RPC_FALLBACKS } from './monad';

// WalletConnect Project ID - required for RainbowKit
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!walletConnectProjectId && typeof window !== 'undefined') {
  console.warn(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. ' +
    'Get one at https://cloud.walletconnect.com'
  );
}

/**
 * Wagmi config with RainbowKit defaults
 * Only Monad mainnet is supported
 */
export const wagmiConfig = getDefaultConfig({
  appName: 'MonOps - NFT Operations Dashboard',
  projectId: walletConnectProjectId,
  chains: [monadMainnet],
  transports: {
    [MONAD_CHAIN_ID]: (() => {
      const urls = [MONAD_RPC_PRIMARY, ...MONAD_RPC_FALLBACKS.filter(u => u !== MONAD_RPC_PRIMARY)];
      const transports = urls.map(url => http(url, { timeout: 10_000 }));
      return transports.length === 1 ? transports[0] : fallback(transports);
    })(),
  },
  ssr: true,
});

export { monadMainnet, MONAD_CHAIN_ID };
