import { createPublicClient, http } from "viem";
import { celoAlfajores } from "viem/chains";
import FalcoCoreAbi from "./abi/FalcoCore.json";

export const FALCO_ADDRESS =
  (process.env.NEXT_PUBLIC_FALCO_ADDRESS as `0x${string}`) ??
  "0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0";

export const EXPLORER_TX   = (hash: string) => `https://celo-sepolia.blockscout.com/tx/${hash}`;
export const EXPLORER_ADDR = (addr: string) => `https://celo-sepolia.blockscout.com/address/${addr}`;

export const publicClient = createPublicClient({
  chain: celoAlfajores,
  transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org"),
});

export const abi = FalcoCoreAbi as any[];

// ─── Types ──────────────────────────────────────────────────────────────────

export const MarketStatus = { Pending: 0, Open: 1, Halted: 2, Closed: 3 } as const;
export const Winner       = { None: 0, Yes: 1, No: 2 } as const;
export const StatusLabel  = ["Pending", "Open", "Halted", "Closed"] as const;
export const WinnerLabel  = ["—", "YES", "NO"] as const;

export interface Market {
  id:         number;
  openTs:     number;
  closeTs:    number;
  strike:     bigint;
  status:     number;
  oracleFeed: string;
  yesReserve: bigint;
  noReserve:  bigint;
  winner:     number;
}

export interface AgentData {
  address:    `0x${string}`;
  role:       string;
  balance:    bigint;
  policy:     { maxStakePerWindow: bigint; maxOpenPositions: number; paused: boolean };
  registered: boolean;
}

// ─── Chain reads ─────────────────────────────────────────────────────────────

export async function fetchMarketCount(): Promise<number> {
  const n = await publicClient.readContract({ address: FALCO_ADDRESS, abi, functionName: "marketCount" }) as bigint;
  return Number(n);
}

export async function fetchMarket(id: number): Promise<Market> {
  const m = await publicClient.readContract({ address: FALCO_ADDRESS, abi, functionName: "getMarket", args: [id] }) as any;
  return {
    id,
    openTs:     Number(m.openTs),
    closeTs:    Number(m.closeTs),
    strike:     BigInt(m.strike),
    status:     Number(m.status),
    oracleFeed: m.oracleFeed,
    yesReserve: BigInt(m.yesReserve),
    noReserve:  BigInt(m.noReserve),
    winner:     Number(m.winner),
  };
}

export async function fetchAllMarkets(): Promise<Market[]> {
  const count = await fetchMarketCount();
  if (count === 0) return [];
  return Promise.all(Array.from({ length: count }, (_, i) => fetchMarket(i)));
}

export async function fetchAgent(address: `0x${string}`): Promise<AgentData | null> {
  try {
    const r = await publicClient.readContract({ address: FALCO_ADDRESS, abi, functionName: "getAgent", args: [address] }) as any;
    return {
      address,
      role: "—",
      balance:    BigInt(r.balance),
      policy:     { maxStakePerWindow: BigInt(r.policy.maxStakePerWindow), maxOpenPositions: Number(r.policy.maxOpenPositions), paused: r.policy.paused },
      registered: r.registered,
    };
  } catch {
    return null;
  }
}

// ─── Agent addresses (derived from private keys server-side) ─────────────────

export const AGENT_ROLES: Array<{ role: string; address: `0x${string}` }> = [
  { role: "market_ops", address: "0x1Ed7C3a81C6b1f89B3D7A5B2d2eBfb9EC9a88000" as `0x${string}` }, // placeholder — overridden at runtime
  { role: "trader",     address: "0x1Ed7C3a81C6b1f89B3D7A5B2d2eBfb9EC9a88001" as `0x${string}` },
  { role: "risk_lp",    address: "0x1Ed7C3a81C6b1f89B3D7A5B2d2eBfb9EC9a88002" as `0x${string}` },
];
