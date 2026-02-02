import {
  type Address,
  type WalletClient,
  parseEther,
  formatEther,
} from 'viem';
import { getPublicClient, monadMainnet } from '@/lib/chain';
import { ERC20_ABI } from '@/lib/chain/abis';
import {
  type DisperseItem,
  type DisperseERC20Metadata,
  type PreflightResult,
  type PreflightItemResult,
  type BatchExecutionCallbacks,
} from './types';
import { createBatch, updateBatchStatus, updateBatchItem, getBatch } from './batch-store';
import { isValidAddress } from '@/lib/utils';

const publicClient = getPublicClient();

/**
 * Validate and run preflight checks for MON disperse
 */
export async function preflightDisperseMon(
  items: DisperseItem[],
  signerAddress: string
): Promise<PreflightResult> {
  const errors: { index: number; message: string }[] = [];
  const itemResults: PreflightItemResult[] = [];
  let totalAmount = 0n;

  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result: PreflightItemResult = { index: i, valid: true };

    if (!isValidAddress(item.to)) {
      result.valid = false;
      result.error = 'Invalid recipient address';
      errors.push({ index: i, message: result.error });
    } else {
      try {
        const amount = BigInt(item.amount);
        if (amount <= 0n) {
          result.valid = false;
          result.error = 'Amount must be greater than 0';
          errors.push({ index: i, message: result.error });
        } else {
          totalAmount += amount;
          result.estimatedGas = 21000n; // Basic transfer gas
        }
      } catch {
        result.valid = false;
        result.error = 'Invalid amount';
        errors.push({ index: i, message: result.error });
      }
    }

    itemResults.push(result);
  }

  // Check signer balance
  const balance = await publicClient.getBalance({ address: signerAddress as Address });
  const gasPrice = await publicClient.getGasPrice();
  const estimatedGas = BigInt(items.length) * 21000n;
  const estimatedGasCost = estimatedGas * gasPrice;
  const estimatedTotal = totalAmount + estimatedGasCost;

  if (balance < estimatedTotal) {
    errors.push({
      index: -1,
      message: `Insufficient balance. Need ${formatEther(estimatedTotal)} MON, have ${formatEther(balance)} MON`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    estimatedGas,
    estimatedTotal,
    itemResults,
  };
}

/**
 * Execute MON disperse batch
 */
export async function executeDisperseMon(
  items: DisperseItem[],
  signerAddress: string,
  walletClient: WalletClient,
  callbacks?: BatchExecutionCallbacks
): Promise<number> {
  const batch = await createBatch(
    'DISPERSE_MON',
    signerAddress,
    items.map((item) => ({ data: item as unknown as Record<string, unknown> }))
  );

  await updateBatchStatus(batch.id!, 'executing');

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const currentBatch = await getBatch(batch.id!);
      if (currentBatch?.status === 'paused') {
        callbacks?.onBatchFailed?.('Batch paused');
        return batch.id!;
      }

      callbacks?.onItemStart?.(i);
      await updateBatchItem(batch.id!, i, { status: 'executing' });

      try {
        const txHash = await walletClient.sendTransaction({
          to: item.to as Address,
          value: BigInt(item.amount),
          chain: monadMainnet,
          account: signerAddress as Address,
        });

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
 * Validate and run preflight checks for ERC-20 disperse
 */
export async function preflightDisperseERC20(
  items: DisperseItem[],
  signerAddress: string,
  tokenAddress: string
): Promise<PreflightResult & { tokenMetadata: DisperseERC20Metadata }> {
  const errors: { index: number; message: string }[] = [];
  const itemResults: PreflightItemResult[] = [];
  let totalAmount = 0n;

  // Fetch token metadata
  let tokenMetadata: DisperseERC20Metadata;
  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);
    tokenMetadata = { tokenAddress, tokenSymbol: symbol, tokenDecimals: decimals };
  } catch {
    return {
      valid: false,
      errors: [{ index: -1, message: 'Failed to fetch token metadata. Is this a valid ERC-20?' }],
      estimatedGas: 0n,
      estimatedTotal: 0n,
      itemResults: [],
      tokenMetadata: { tokenAddress, tokenSymbol: 'UNKNOWN', tokenDecimals: 18 },
    };
  }

  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result: PreflightItemResult = { index: i, valid: true };

    if (!isValidAddress(item.to)) {
      result.valid = false;
      result.error = 'Invalid recipient address';
      errors.push({ index: i, message: result.error });
    } else {
      try {
        const amount = BigInt(item.amount);
        if (amount <= 0n) {
          result.valid = false;
          result.error = 'Amount must be greater than 0';
          errors.push({ index: i, message: result.error });
        } else {
          totalAmount += amount;
          result.estimatedGas = 65000n; // ERC-20 transfer gas estimate
        }
      } catch {
        result.valid = false;
        result.error = 'Invalid amount';
        errors.push({ index: i, message: result.error });
      }
    }

    itemResults.push(result);
  }

  // Check token balance
  const tokenBalance = await publicClient.readContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [signerAddress as Address],
  });

  if (tokenBalance < totalAmount) {
    errors.push({
      index: -1,
      message: `Insufficient ${tokenMetadata.tokenSymbol} balance`,
    });
  }

  // Estimate gas cost
  const gasPrice = await publicClient.getGasPrice();
  const estimatedGas = BigInt(items.length) * 65000n;
  const estimatedGasCost = estimatedGas * gasPrice;

  return {
    valid: errors.length === 0,
    errors,
    estimatedGas,
    estimatedTotal: estimatedGasCost,
    itemResults,
    tokenMetadata,
  };
}

/**
 * Execute ERC-20 disperse batch
 */
export async function executeDisperseERC20(
  items: DisperseItem[],
  signerAddress: string,
  tokenAddress: string,
  walletClient: WalletClient,
  callbacks?: BatchExecutionCallbacks
): Promise<number> {
  // Fetch token metadata for batch record
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
  ]);

  const batch = await createBatch(
    'DISPERSE_ERC20',
    signerAddress,
    items.map((item) => ({ data: item as unknown as Record<string, unknown> })),
    { tokenAddress, tokenSymbol: symbol, tokenDecimals: decimals }
  );

  await updateBatchStatus(batch.id!, 'executing');

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const currentBatch = await getBatch(batch.id!);
      if (currentBatch?.status === 'paused') {
        callbacks?.onBatchFailed?.('Batch paused');
        return batch.id!;
      }

      callbacks?.onItemStart?.(i);
      await updateBatchItem(batch.id!, i, { status: 'executing' });

      try {
        const txHash = await walletClient.writeContract({
          address: tokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [item.to as Address, BigInt(item.amount)],
          chain: monadMainnet,
          account: signerAddress as Address,
        });

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
