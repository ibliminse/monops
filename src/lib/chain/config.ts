import { http, createConfig } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadMainnet, MONAD_CHAIN_ID } from './monad';

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
    [MONAD_CHAIN_ID]: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://rpc.monad.xyz'),
  },
  ssr: true,
});

export { monadMainnet, MONAD_CHAIN_ID };
