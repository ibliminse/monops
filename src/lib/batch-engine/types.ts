export type BatchStatus = 'pending' | 'simulating' | 'executing' | 'paused' | 'completed' | 'failed';
export type BatchType = 'TRANSFER_NFT' | 'DISPERSE_MON' | 'DISPERSE_ERC20';
export type BatchItemStatus = 'pending' | 'simulating' | 'executing' | 'success' | 'failed' | 'skipped';

export interface BatchItem {
  index: number;
  status: BatchItemStatus;
  data: Record<string, unknown>;
  txHash?: string;
  error?: string;
  gasUsed?: string;
  completedAt?: number;
}

export interface Batch {
  id?: number;
  type: BatchType;
  status: BatchStatus;
  signerAddress: string;
  items: BatchItem[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

// NFT Transfer specific
export interface NFTTransferItem {
  to: string;
  tokenId: string;
  amount?: number; // For ERC-1155
  collectionAddress: string;
  collectionType: 'ERC721' | 'ERC1155';
}

// Disperse specific
export interface DisperseItem {
  to: string;
  amount: string; // In wei for MON, smallest unit for ERC20
}

export interface DisperseERC20Metadata {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

// Preflight check results
export interface PreflightResult {
  valid: boolean;
  errors: PreflightError[];
  estimatedGas: bigint;
  estimatedTotal: bigint;
  itemResults: PreflightItemResult[];
}

export interface PreflightError {
  index: number;
  message: string;
}

export interface PreflightItemResult {
  index: number;
  valid: boolean;
  error?: string;
  estimatedGas?: bigint;
}

// Batch execution callbacks
export interface BatchExecutionCallbacks {
  onItemStart?: (index: number) => void;
  onItemComplete?: (index: number, txHash: string, gasUsed: string) => void;
  onItemFailed?: (index: number, error: string) => void;
  onBatchComplete?: () => void;
  onBatchFailed?: (error: string) => void;
}
