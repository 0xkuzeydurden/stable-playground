import { formatEther } from 'viem';

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatGUSDT(value: bigint) {
  const formatted = Number(formatEther(value || 0n));
  return formatted.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
