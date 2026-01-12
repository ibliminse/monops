import { db, type Batch, type BatchItem } from '@/lib/db';

/**
 * Create a new batch
 */
export async function createBatch(
  type: Batch['type'],
  signerAddress: string,
  items: Omit<BatchItem, 'index' | 'status'>[],
  metadata?: Record<string, unknown>
): Promise<Batch> {
  const batch: Omit<Batch, 'id'> = {
    type,
    status: 'pending',
    signerAddress: signerAddress.toLowerCase(),
    items: items.map((item, index) => ({
      ...item,
      index,
      status: 'pending' as const,
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata,
  };

  const id = await db.batches.add(batch);
  return { ...batch, id };
}

/**
 * Update batch status
 */
export async function updateBatchStatus(
  id: number,
  status: Batch['status']
): Promise<void> {
  await db.batches.update(id, {
    status,
    updatedAt: Date.now(),
    ...(status === 'completed' || status === 'failed' ? { completedAt: Date.now() } : {}),
  });
}

/**
 * Update a specific batch item
 */
export async function updateBatchItem(
  batchId: number,
  itemIndex: number,
  updates: Partial<BatchItem>
): Promise<void> {
  const batch = await db.batches.get(batchId);
  if (!batch) return;

  const items = [...batch.items];
  items[itemIndex] = { ...items[itemIndex], ...updates };

  await db.batches.update(batchId, {
    items,
    updatedAt: Date.now(),
  });
}

/**
 * Get batch by ID
 */
export async function getBatch(id: number): Promise<Batch | undefined> {
  return db.batches.get(id);
}

/**
 * Get recent batches for a signer
 */
export async function getRecentBatches(
  signerAddress: string,
  limit: number = 10
): Promise<Batch[]> {
  return db.batches
    .where('signerAddress')
    .equals(signerAddress.toLowerCase())
    .reverse()
    .limit(limit)
    .toArray();
}

/**
 * Get pending/paused batches (resumable)
 */
export async function getResumableBatches(signerAddress: string): Promise<Batch[]> {
  const batches = await db.batches
    .where('signerAddress')
    .equals(signerAddress.toLowerCase())
    .toArray();

  return batches.filter(
    (b) => b.status === 'pending' || b.status === 'paused' || b.status === 'executing'
  );
}

/**
 * Delete a batch
 */
export async function deleteBatch(id: number): Promise<void> {
  await db.batches.delete(id);
}

/**
 * Get batch statistics
 */
export function getBatchStats(batch: Batch): {
  total: number;
  pending: number;
  success: number;
  failed: number;
  skipped: number;
} {
  const stats = {
    total: batch.items.length,
    pending: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of batch.items) {
    switch (item.status) {
      case 'pending':
      case 'simulating':
      case 'executing':
        stats.pending++;
        break;
      case 'success':
        stats.success++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'skipped':
        stats.skipped++;
        break;
    }
  }

  return stats;
}
