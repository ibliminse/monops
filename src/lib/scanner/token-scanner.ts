import { getPublicClient } from '@/lib/chain/client';
import { type Address, erc20Abi, formatUnits, parseAbiItem } from 'viem';

export interface TokenBalance {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
}

// ERC-20 Transfer event signature
const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// Scan depth for finding tokens (last N blocks) - reduced for faster initial load
const SCAN_DEPTH = 50_000n;

/**
 * Find all ERC-20 tokens a wallet has received transfers for
 */
export async function findWalletTokens(
  walletAddress: Address,
  onProgress?: (message: string) => void
): Promise<Address[]> {
  const client = getPublicClient();
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock > SCAN_DEPTH ? currentBlock - SCAN_DEPTH : 0n;

  onProgress?.('Scanning for token transfers...');

  // Get all Transfer events TO this wallet
  const logs = await client.getLogs({
    event: TRANSFER_EVENT,
    args: { to: walletAddress },
    fromBlock,
    toBlock: currentBlock,
  });

  // Extract unique token contract addresses
  const tokenAddresses = [...new Set(logs.map((log) => log.address as Address))];

  onProgress?.(`Found ${tokenAddresses.length} potential tokens`);

  return tokenAddresses;
}

/**
 * Get token metadata and balance for a specific token
 */
export async function getTokenBalance(
  tokenAddress: Address,
  walletAddress: Address
): Promise<TokenBalance | null> {
  const client = getPublicClient();

  try {
    const [name, symbol, decimals, balance] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'name',
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
    ]);

    // Skip if zero balance
    if (balance === 0n) return null;

    return {
      address: tokenAddress,
      name: name as string,
      symbol: symbol as string,
      decimals: decimals as number,
      balance,
      formattedBalance: formatUnits(balance, decimals as number),
    };
  } catch {
    // Token contract may not be ERC-20 compliant
    return null;
  }
}

/**
 * Get all token balances for a wallet
 */
export async function getAllTokenBalances(
  walletAddress: Address,
  onProgress?: (message: string) => void
): Promise<TokenBalance[]> {
  const tokenAddresses = await findWalletTokens(walletAddress, onProgress);

  onProgress?.('Fetching token balances...');

  const balancePromises = tokenAddresses.map((addr) =>
    getTokenBalance(addr, walletAddress)
  );

  const results = await Promise.all(balancePromises);
  const validBalances = results.filter((b): b is TokenBalance => b !== null);

  // Sort by balance value (descending)
  validBalances.sort((a, b) => {
    const aVal = parseFloat(a.formattedBalance);
    const bVal = parseFloat(b.formattedBalance);
    return bVal - aVal;
  });

  onProgress?.(`Found ${validBalances.length} tokens with balance`);

  return validBalances;
}
