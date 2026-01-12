/**
 * Monadscan API client for fetching NFT data
 * Uses Etherscan API V2 with Monad chain ID (143)
 * Much faster and more reliable than scanning logs
 */

const API_BASE = 'https://api.etherscan.io/v2/api';
const MONAD_CHAIN_ID = 143;

export interface MonadscanNFT {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
}

export interface NFTBalance {
  contractAddress: string;
  tokenId: string;
  name: string;
  symbol: string;
}

/**
 * Fetch all NFT transfers for an address using Monadscan API
 */
export async function fetchNFTTransfers(
  address: string,
  apiKey: string,
  onProgress?: (message: string) => void
): Promise<MonadscanNFT[]> {
  const allTransfers: MonadscanNFT[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  onProgress?.('Fetching NFT data from Monadscan...');

  while (hasMore) {
    const url = `${API_BASE}?chainid=${MONAD_CHAIN_ID}&module=account&action=tokennfttx&address=${address}&page=${page}&offset=${pageSize}&sort=desc&apikey=${apiKey}`;

    console.log(`[Monadscan] Fetching page ${page}...`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && Array.isArray(data.result)) {
        allTransfers.push(...data.result);
        onProgress?.(`Fetched ${allTransfers.length} NFT transfers...`);

        if (data.result.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        console.error('[Monadscan] API error:', data.message, data.result);
        hasMore = false;
      }
    } catch (error) {
      console.error('[Monadscan] Fetch error:', error);
      hasMore = false;
    }
  }

  console.log(`[Monadscan] Total transfers fetched: ${allTransfers.length}`);
  return allTransfers;
}

/**
 * Calculate current NFT holdings from transfer history
 */
export function calculateHoldings(
  transfers: MonadscanNFT[],
  ownerAddress: string
): NFTBalance[] {
  const holdings = new Map<string, NFTBalance>();
  const normalizedOwner = ownerAddress.toLowerCase();

  // Process transfers in chronological order (oldest first)
  const sortedTransfers = [...transfers].sort(
    (a, b) => parseInt(a.blockNumber) - parseInt(b.blockNumber)
  );

  for (const transfer of sortedTransfers) {
    const key = `${transfer.contractAddress.toLowerCase()}-${transfer.tokenID}`;
    const isReceiving = transfer.to.toLowerCase() === normalizedOwner;
    const isSending = transfer.from.toLowerCase() === normalizedOwner;

    if (isReceiving) {
      holdings.set(key, {
        contractAddress: transfer.contractAddress,
        tokenId: transfer.tokenID,
        name: transfer.tokenName,
        symbol: transfer.tokenSymbol,
      });
    } else if (isSending) {
      holdings.delete(key);
    }
  }

  console.log(`[Monadscan] Calculated ${holdings.size} current holdings`);
  return Array.from(holdings.values());
}

/**
 * Group holdings by collection
 */
export function groupByCollection(holdings: NFTBalance[]): Map<string, NFTBalance[]> {
  const grouped = new Map<string, NFTBalance[]>();

  for (const nft of holdings) {
    const key = nft.contractAddress.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(nft);
  }

  return grouped;
}
