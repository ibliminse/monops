import {
  createWalletClient,
  type Address,
  type WalletClient,
  type PublicClient,
  custom,
  encodeFunctionData,
} from 'viem';
import { getPublicClient, monadMainnet } from '@/lib/chain';
import { ERC721_ABI, ERC1155_ABI } from '@/lib/chain/abis';
import {
  type NFTTransferItem,
  type PreflightResult,
  type PreflightItemResult,
  type BatchExecutionCallbacks,
} from './types';
import { createBatch, updateBatchStatus, updateBatchItem, getBatch } from './batch-store';
import { isValidAddress } from '@/lib/utils';

const publicClient = getPublicClient();

/**
 * Validate and run preflight checks for NFT transfers
 */
export async function preflightNFTTransfers(
  items: NFTTransferItem[],
  signerAddress: string
): Promise<PreflightResult> {
  const errors: { index: number; message: string }[] = [];
  const itemResults: PreflightItemResult[] = [];
  let totalEstimatedGas = 0n;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result: PreflightItemResult = { index: i, valid: true };

    // Validate recipient address
    if (!isValidAddress(item.to)) {
      result.valid = false;
      result.error = 'Invalid recipient address';
      errors.push({ index: i, message: result.error });
      itemResults.push(result);
      continue;
    }

    // Validate collection address
    if (!isValidAddress(item.collectionAddress)) {
      result.valid = false;
      result.error = 'Invalid collection address';
      errors.push({ index: i, message: result.error });
      itemResults.push(result);
      continue;
    }

    try {
      // Check ownership
      if (item.collectionType === 'ERC721') {
        const owner = await publicClient.readContract({
          address: item.collectionAddress as Address,
          abi: ERC721_ABI,
          functionName: 'ownerOf',
          args: [BigInt(item.tokenId)],
        });

        if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
          result.valid = false;
          result.error = `Not owner of token #${item.tokenId}`;
          errors.push({ index: i, message: result.error });
        }
      } else {
        const balance = await publicClient.readContract({
          address: item.collectionAddress as Address,
          abi: ERC1155_ABI,
          functionName: 'balanceOf',
          args: [signerAddress as Address, BigInt(item.tokenId)],
        });

        const amount = BigInt(item.amount || 1);
        if (balance < amount) {
          result.valid = false;
          result.error = `Insufficient balance for token #${item.tokenId}`;
          errors.push({ index: i, message: result.error });
        }
      }

      // Estimate gas if valid
      if (result.valid) {
        try {
          const gasEstimate = item.collectionType === 'ERC721'
            ? await publicClient.estimateGas({
                account: signerAddress as Address,
                to: item.collectionAddress as Address,
                data: encodeFunctionData({
                  abi: ERC721_ABI,
                  functionName: 'safeTransferFrom',
                  args: [signerAddress as Address, item.to as Address, BigInt(item.tokenId)],
                }),
              })
            : await publicClient.estimateGas({
                account: signerAddress as Address,
                to: item.collectionAddress as Address,
                data: encodeFunctionData({
                  abi: ERC1155_ABI,
                  functionName: 'safeTransferFrom',
                  args: [
                    signerAddress as Address,
                    item.to as Address,
                    BigInt(item.tokenId),
                    BigInt(item.amount || 1),
                    '0x' as `0x${string}`,
                  ],
                }),
              });

          result.estimatedGas = gasEstimate;
          totalEstimatedGas += gasEstimate;
        } catch (e) {
          // Gas estimation failed, use default
          result.estimatedGas = 100000n;
          totalEstimatedGas += 100000n;
        }
      }
    } catch (e) {
      result.valid = false;
      result.error = e instanceof Error ? e.message : 'Unknown error';
      errors.push({ index: i, message: result.error });
    }

    itemResults.push(result);
  }

  // Get current gas price for total estimate
  const gasPrice = await publicClient.getGasPrice();
  const estimatedTotal = totalEstimatedGas * gasPrice;

  return {
    valid: errors.length === 0,
    errors,
    estimatedGas: totalEstimatedGas,
    estimatedTotal,
    itemResults,
  };
}

/**
 * Execute NFT transfers batch
 */
export async function executeNFTTransfers(
  items: NFTTransferItem[],
  signerAddress: string,
  walletClient: WalletClient,
  callbacks?: BatchExecutionCallbacks
): Promise<number> {
  // Create batch record
  const batch = await createBatch(
    'TRANSFER_NFT',
    signerAddress,
    items.map((item) => ({ data: item as unknown as Record<string, unknown> })),
    { collectionTypes: [...new Set(items.map((i) => i.collectionType))] }
  );

  await updateBatchStatus(batch.id!, 'executing');

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if batch was paused
      const currentBatch = await getBatch(batch.id!);
      if (currentBatch?.status === 'paused') {
        callbacks?.onBatchFailed?.('Batch paused');
        return batch.id!;
      }

      callbacks?.onItemStart?.(i);
      await updateBatchItem(batch.id!, i, { status: 'executing' });

      try {
        let txHash: `0x${string}`;

        if (item.collectionType === 'ERC721') {
          txHash = await walletClient.writeContract({
            address: item.collectionAddress as Address,
            abi: ERC721_ABI,
            functionName: 'safeTransferFrom',
            args: [signerAddress as Address, item.to as Address, BigInt(item.tokenId)],
            chain: monadMainnet,
            account: signerAddress as Address,
          });
        } else {
          txHash = await walletClient.writeContract({
            address: item.collectionAddress as Address,
            abi: ERC1155_ABI,
            functionName: 'safeTransferFrom',
            args: [
              signerAddress as Address,
              item.to as Address,
              BigInt(item.tokenId),
              BigInt(item.amount || 1),
              '0x' as `0x${string}`,
            ],
            chain: monadMainnet,
            account: signerAddress as Address,
          });
        }

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        await updateBatchItem(batch.id!, i, {
          status: 'success',
          txHash,
          gasUsed: receipt.gasUsed.toString(),
          completedAt: Date.now(),
        });

        callbacks?.onItemComplete?.(i, txHash, receipt.gasUsed.toString());
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        await updateBatchItem(batch.id!, i, {
          status: 'failed',
          error,
          completedAt: Date.now(),
        });
        callbacks?.onItemFailed?.(i, error);
      }
    }

    await updateBatchStatus(batch.id!, 'completed');
    callbacks?.onBatchComplete?.();
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    await updateBatchStatus(batch.id!, 'failed');
    callbacks?.onBatchFailed?.(error);
  }

  return batch.id!;
}

/**
 * Resume a paused/failed batch
 */
export async function resumeNFTTransfers(
  batchId: number,
  walletClient: WalletClient,
  callbacks?: BatchExecutionCallbacks
): Promise<void> {
  const batch = await getBatch(batchId);
  if (!batch) throw new Error('Batch not found');

  await updateBatchStatus(batchId, 'executing');

  try {
    for (let i = 0; i < batch.items.length; i++) {
      const batchItem = batch.items[i];

      // Skip already completed items
      if (batchItem.status === 'success' || batchItem.status === 'skipped') {
        continue;
      }

      const item = batchItem.data as unknown as NFTTransferItem;

      callbacks?.onItemStart?.(i);
      await updateBatchItem(batchId, i, { status: 'executing' });

      try {
        let txHash: `0x${string}`;

        if (item.collectionType === 'ERC721') {
          txHash = await walletClient.writeContract({
            address: item.collectionAddress as Address,
            abi: ERC721_ABI,
            functionName: 'safeTransferFrom',
            args: [batch.signerAddress as Address, item.to as Address, BigInt(item.tokenId)],
            chain: monadMainnet,
            account: batch.signerAddress as Address,
          });
        } else {
          txHash = await walletClient.writeContract({
            address: item.collectionAddress as Address,
            abi: ERC1155_ABI,
            functionName: 'safeTransferFrom',
            args: [
              batch.signerAddress as Address,
              item.to as Address,
              BigInt(item.tokenId),
              BigInt(item.amount || 1),
              '0x' as `0x${string}`,
            ],
            chain: monadMainnet,
            account: batch.signerAddress as Address,
          });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        await updateBatchItem(batchId, i, {
          status: 'success',
          txHash,
          gasUsed: receipt.gasUsed.toString(),
          completedAt: Date.now(),
        });

        callbacks?.onItemComplete?.(i, txHash, receipt.gasUsed.toString());
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        await updateBatchItem(batchId, i, {
          status: 'failed',
          error,
          completedAt: Date.now(),
        });
        callbacks?.onItemFailed?.(i, error);
      }
    }

    await updateBatchStatus(batchId, 'completed');
    callbacks?.onBatchComplete?.();
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    await updateBatchStatus(batchId, 'failed');
    callbacks?.onBatchFailed?.(error);
  }
}
