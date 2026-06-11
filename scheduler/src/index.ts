import { buildConnections } from "./common/connections.js";
import { send } from "./common/tx.js";
import { listMarkets, MarketStatus } from "./common/markets.js";
import { FALCO_CORE_ADDRESS, PYTH_BTC_USD_FEED } from "./common/connections.js";

const TICK_MS        = Number(process.env.SCHEDULER_TICK_MS      ?? 5_000);
const WINDOW_SECS    = Number(process.env.SCHEDULER_WINDOW_SECS  ?? 300);
const HORIZON_SECS   = Number(process.env.SCHEDULER_HORIZON_SECS ?? 600);
const SEED_LIQUIDITY = BigInt(process.env.SCHEDULER_SEED_USDC    ?? "5000000");

const PYTH_ADDRESS = "0x2880aB155794e7179c9eE2e38200202908C17B43" as `0x${string}`;
const USDC         = "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as `0x${string}`;

const USDC_ABI = [{
  name: "approve", type: "function",
  inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ type: "bool" }], stateMutability: "nonpayable"
}];

const PYTH_ABI = [
  {
    name: "updatePriceFeeds", type: "function", stateMutability: "payable",
    inputs: [{ name: "updateData", type: "bytes[]" }], outputs: []
  },
  {
    name: "getUpdateFee", type: "function", stateMutability: "view",
    inputs: [{ name: "updateData", type: "bytes[]" }], outputs: [{ type: "uint256" }]
  }
];

const conns = buildConnections("market_ops");

async function approveUsdc() {
  const h = await conns.walletClient.writeContract({
    address: USDC, abi: USDC_ABI, functionName: "approve",
    args: [FALCO_CORE_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await conns.publicClient.waitForTransactionReceipt({ hash: h });
  console.log("[scheduler] USDC approved");
}

/** Fetch VAA from Hermes and push to Pyth on-chain before calling openMarket */
async function pushPythPrice(): Promise<boolean> {
  try {
    const res  = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_BTC_USD_FEED}&encoding=hex`);
    const data = await res.json() as any;
    const vaa  = data.binary?.data?.[0];
    if (!vaa) { console.warn("[scheduler] No VAA from Hermes"); return false; }

    const updateData = [`0x${vaa}`] as `0x${string}`[];
    const fee = await conns.publicClient.readContract({
      address: PYTH_ADDRESS, abi: PYTH_ABI, functionName: "getUpdateFee", args: [updateData]
    }) as bigint;

    const h = await conns.walletClient.writeContract({
      address: PYTH_ADDRESS, abi: PYTH_ABI, functionName: "updatePriceFeeds",
      args: [updateData], value: fee,
    });
    await conns.publicClient.waitForTransactionReceipt({ hash: h });
    console.log("[scheduler] Pyth price pushed tx=" + h);
    return true;
  } catch (e: any) {
    console.warn("[scheduler] pushPythPrice failed:", e.message?.slice(0, 120));
    return false;
  }
}

async function tick() {
  const nowSec  = Math.floor(Date.now() / 1000);
  const markets = await listMarkets(conns);

  // Phase 1 — create markets to fill horizon
  const latestClose = markets.reduce((max, m) => Math.max(max, m.closeTs), nowSec);
  if (latestClose - nowSec < HORIZON_SECS) {
    const openTs  = latestClose > nowSec ? latestClose : nowSec + 10;
    const closeTs = openTs + WINDOW_SECS;
    try {
      const hash = await send(conns, "createMarket", [openTs, closeTs, PYTH_BTC_USD_FEED]);
      console.log(`[scheduler] createMarket openTs=${openTs} closeTs=${closeTs} tx=${hash}`);
    } catch (e: any) {
      console.warn("[scheduler] createMarket failed:", e.message?.slice(0, 120));
    }
  }

  // Phase 2 — open pending markets (push Pyth price first)
  const pendingToOpen = markets.filter(m => m.status === MarketStatus.Pending && nowSec >= m.openTs);
  if (pendingToOpen.length > 0) {
    await pushPythPrice();
    for (const m of pendingToOpen) {
      try {
        const hash = await send(conns, "openMarket", [m.id, SEED_LIQUIDITY]);
        console.log(`[scheduler] openMarket id=${m.id} tx=${hash}`);
      } catch (e: any) {
        console.warn(`[scheduler] openMarket id=${m.id} failed:`, e.message?.slice(0, 120));
      }
    }
  }

  // Phase 3 — close open/halted markets past closeTs (push Pyth price first)
  const toClose = markets.filter(m =>
    (m.status === MarketStatus.Open || m.status === MarketStatus.Halted) && nowSec >= m.closeTs
  );
  if (toClose.length > 0) {
    await pushPythPrice();
    for (const m of toClose) {
      try {
        const hash = await send(conns, "closeMarket", [m.id]);
        console.log(`[scheduler] closeMarket id=${m.id} tx=${hash}`);
      } catch (e: any) {
        console.warn(`[scheduler] closeMarket id=${m.id} failed:`, e.message?.slice(0, 120));
      }
    }
  }

  // Phase 4 — settle closed markets
  for (const m of markets) {
    if (m.status === MarketStatus.Closed) {
      try {
        await send(conns, "settlePositions", [[m.id]]);
      } catch { /* no positions is fine */ }
    }
  }
}

async function main() {
  console.log("[scheduler] admin:", conns.account.address);
  console.log("[scheduler] FalcoCore:", FALCO_CORE_ADDRESS);
  await approveUsdc();
  while (true) {
    try { await tick(); } catch (e: any) { console.error("[scheduler] tick error:", e.message); }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main();
