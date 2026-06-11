export const ZERO_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
export const WRONG_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

export interface AgentPolicy {
  maxStakePerWindow: bigint;
  maxOpenPositions:  number;
  allowedMarketsRoot: `0x${string}`;
  paused: boolean;
}

export function defaultPolicy(): AgentPolicy {
  return {
    maxStakePerWindow:  500_000_000n, // 500 USDC (6 dec)
    maxOpenPositions:   4,
    allowedMarketsRoot: ZERO_ROOT,
    paused:             false,
  };
}
