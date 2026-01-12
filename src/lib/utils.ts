import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncate an Ethereum address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number | bigint): string {
  return num.toLocaleString();
}

/**
 * Format MON amount from wei
 */
export function formatMon(wei: bigint, decimals = 4): string {
  const mon = Number(wei) / 1e18;
  return mon.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse MON amount to wei
 */
export function parseMon(mon: string | number): bigint {
  const num = typeof mon === 'string' ? parseFloat(mon) : mon;
  return BigInt(Math.floor(num * 1e18));
}

/**
 * Check if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Create a CSV string from data
 */
export function toCSV(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCell).join(','));

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Download a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
