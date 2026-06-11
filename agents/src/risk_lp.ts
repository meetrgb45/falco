/**
 * risk_lp — AMM imbalance hedger
 * Bets on the under-bought side (higher reserve) to push price back toward 50/50.
 * Cancels position near close or when oracle is stale.
 */
import { buildConnections } from "./common/connections.js";
import { send } from "./common/tx.js";
import { findActiveOpenMarket, MarketStatus } from "./common/markets.js";
import { readOracleSnapshot } from "./common/oracle.js";
import { ensureRegistered, getBalance } from "./common/registry.js";
import { FALCO_CORE_ADDRESS } from "./common/connections.js";

const TICK_MS          = 2500;
const HEDGE_SIZE       = BigInt(process.env.AGENTS_RISK_LP_HEDGE_SIZE           ?? "75000");
const HEDGES_PER_MKT   = Number(process.env.AGENTS_RISK_LP_HEDGES_PER_MARKET    ?? "2");
const CANCEL_NEAR_SECS = Number(process.env.AGENTS_RISK_LP_CANCEL_NEAR_CLOSE_SECS ?? "30");
const STALE_SECS       = 30;
const TARGET_BAL       = 1_000_000n;

const conns = buildConnections("risk_lp");

interface Memo { hedgesPlaced: number; cancelled: boolean; }
const memos = new Map<number, Memo>();

async function ensureDeposited() {
  const bal = await getBalance(conns);
  if (bal < TARGET_BAL) {
    const needed = TARGET_BAL - bal;
    const usdcAbi = [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" }];
    const h = await conns.walletClient.writeContract({
      address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
      abi: usdcAbi,
      functionName: "approve",
      args: [FALCO_CORE_ADDRESS, needed],
    });
    await conns.publicClient.waitForTransactionReceipt({ hash: h });
    await send(conns, "deposit", [needed]);
    console.log(`[risk_lp] deposited ${needed}`);
  }
}

async function tick() {
  const market = await findActiveOpenMarket(conns);
  if (!market) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const memo = memos.get(market.id) ?? { hedgesPlaced: 0, cancelled: false };
  memos.set(market.id, memo);

  const secsToClose = market.closeTs - nowSec;
  const snap = await readOracleSnapshot();
  const stale = snap ? snap.ageSecs > STALE_SECS : false;

  // Cancel near close or on stale oracle
  if (!memo.cancelled && (stale || secsToClose <= CANCEL_NEAR_SECS)) {
    try {
      const h = await send(conns, "cancelBet", [market.id]);
      console.log(`[risk_lp] cancelBet market=${market.id} reason=${stale ? "stale" : "near-close"} tx=${h}`);
    } catch { /* no position is fine */ }
    memo.cancelled = true;
    return;
  }

  if (memo.hedgesPlaced >= HEDGES_PER_MKT || memo.cancelled) return;

  // Pick under-bought side (higher reserve = less demand)
  const yes = market.yesReserve;
  const no  = market.noReserve;
  if (yes === no) return;
  const side = yes > no ? 0 : 1; // 0=Yes 1=No

  try {
    const h = await send(conns, "placeBet", [market.id, side, HEDGE_SIZE]);
    console.log(`[risk_lp] hedge market=${market.id} side=${side} amount=${HEDGE_SIZE} tx=${h}`);
    memo.hedgesPlaced++;
  } catch (e: any) {
    // TooManyPositions or any revert — stop hedging this window
    memo.hedgesPlaced = HEDGES_PER_MKT;
    console.warn("[risk_lp] hedge failed (stopping for this window):", e.shortMessage?.slice(0, 60) ?? e.message?.slice(0, 60));
  }
}

async function main() {
  await ensureRegistered(conns);
  await ensureDeposited();
  console.log("[risk_lp] running as", conns.account.address);
  while (true) {
    try { await tick(); } catch (e: any) { console.error("[risk_lp] tick error:", e.message); }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main();
