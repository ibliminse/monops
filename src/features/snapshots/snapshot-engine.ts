import { toCSV, downloadFile } from '@/lib/utils';
import { getPlanLimits } from '@/lib/db/plan';

export interface HolderSnapshot {
  address: string;
  count: number;
  tokenIds: string[];
}

export interface SnapshotProgress {
  stage: 'fetching' | 'processing' | 'complete' | 'error';
  currentBlock: bigint;
  targetBlock: bigint;
  holdersFound: number;
  failedRanges?: { from: bigint; to: bigint }[];
  error?: string;
}

/**
 * Export snapshot to CSV
 */
export function exportSnapshotCSV(
  snapshot: HolderSnapshot[],
  collectionName: string,
  includeTokenIds: boolean = false
): void {
  const limits = getPlanLimits();
  const limitedSnapshot = snapshot.slice(0, limits.maxExportRows);

  const headers = includeTokenIds
    ? ['Address', 'Count', 'Token IDs']
    : ['Address', 'Count'];

  const rows = limitedSnapshot.map((holder) =>
    includeTokenIds
      ? [holder.address, holder.count.toString(), holder.tokenIds.join(';')]
      : [holder.address, holder.count.toString()]
  );

  const csv = toCSV(headers, rows);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `${collectionName}-holders-${timestamp}.csv`);
}
