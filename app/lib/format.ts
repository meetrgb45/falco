export function shortPubkey(pk: string | null | undefined, head = 4, tail = 4): string {
  if (!pk) return "—";
  if (pk.length <= head + tail + 1) return pk;
  return `${pk.slice(0, head)}…${pk.slice(-tail)}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://celo-sepolia.blockscout.com/tx/${hash}`;
}

export function explorerAddressUrl(addr: string): string {
  return `https://celo-sepolia.blockscout.com/address/${addr}`;
}

const STRIKE_DECIMALS = 8;
export const STRIKE_SCALE = Math.pow(10, STRIKE_DECIMALS);

export function formatStrike(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(n) || n === 0) return "—";
  const scaled = n / STRIKE_SCALE;
  return scaled.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatUsdc(amount: bigint | number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "bigint" ? Number(amount) : typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return (n / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const delta = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (delta < 60)    return `${delta}s ago`;
  if (delta < 3600)  return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}
