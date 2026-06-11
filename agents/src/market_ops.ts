/**
 * market_ops — oracle watchdog + lifecycle closer
 * - Halts open market when Pyth BTC/USD is stale (age > 30s)
 * - Resumes halted market when oracle recovers
 * - Closes any open/halted market past its closeTs
 * - Demo: force-halts every Nth market for FORCE_HALT_SECS
 */
import { buildConnections } from "./common/connections.js";
import { send } from "./common/tx.js";
import { findActiveOpenMarket, findHaltedMarket, listMarkets, MarketStatus } from "./common/markets.js";
import { readOracleSnapshot } from "./common/oracle.js";
import { ensureRegistered } from "./common/registry.js";

const TICK_MS             = 1500;
const STALE_THRESHOLD     = 30;  // seconds
const FORCE_HALT_EVERY    = Number(process.env.AGENTS_OPS_FORCE_HALT_EVERY ?? 4);
const FORCE_HALT_SECS     = Number(process.env.AGENTS_OPS_FORCE_HALT_SECS  ?? 20);

const conns = buildConnections("market_ops");
const seenMarkets = new Set<number>();
let forceHaltActive: { marketId: number; resumeAtMs: number } | null = null;

async function tick() {
  // Scheduler owns closeMarket — market_ops only handles halt/resume to avoid nonce conflicts
  const open   = await findActiveOpenMarket(conns);
  const halted = await findHaltedMarket(conns);
  const live   = open ?? halted;
  if (!live) return;

  // Demo force-halt on every Nth market
  if (FORCE_HALT_EVERY > 0 && open && !seenMarkets.has(open.id)) {
    seenMarkets.add(open.id);
    if (open.id % FORCE_HALT_EVERY === 0) {
      forceHaltActive = { marketId: open.id, resumeAtMs: Date.now() + FORCE_HALT_SECS * 1000 };
      try {
        const h = await send(conns, "haltMarket", [open.id]);
        console.log(`[market_ops] force-halt id=${open.id} tx=${h}`);
      } catch (e: any) {
        console.warn("[market_ops] force-halt failed:", e.message?.slice(0, 100));
      }
      return;
    }
  }

  // Resume forced halt after duration
  if (forceHaltActive && Date.now() >= forceHaltActive.resumeAtMs) {
    if (halted && halted.id === forceHaltActive.marketId) {
      try {
        const h = await send(conns, "resumeMarket", [halted.id]);
        console.log(`[market_ops] resume force-halt id=${halted.id} tx=${h}`);
      } catch (e: any) {
        console.warn("[market_ops] resume failed:", e.message?.slice(0, 100));
      }
    }
    forceHaltActive = null;
    return;
  }

  // Oracle staleness loop
  const snap = await readOracleSnapshot();
  const stale = snap ? snap.ageSecs > STALE_THRESHOLD : false;
  console.log(`[market_ops] market=${live.id} status=${live.status} oracleAge=${snap?.ageSecs ?? "?"}s stale=${stale}`);

  if (open && stale) {
    try {
      const h = await send(conns, "haltMarket", [open.id]);
      console.log(`[market_ops] haltMarket (stale oracle) id=${open.id} tx=${h}`);
    } catch (e: any) {
      console.warn("[market_ops] haltMarket failed:", e.message?.slice(0, 100));
    }
  } else if (halted && !stale && !forceHaltActive) {
    try {
      const h = await send(conns, "resumeMarket", [halted.id]);
      console.log(`[market_ops] resumeMarket id=${halted.id} tx=${h}`);
    } catch (e: any) {
      console.warn("[market_ops] resumeMarket failed:", e.message?.slice(0, 100));
    }
  }
}

async function main() {
  // market_ops uses admin key — skip registration to avoid nonce conflicts with scheduler
  // Just check and register if needed, with a delay to avoid nonce collision
  await new Promise((r) => setTimeout(r, 3000)); // wait for scheduler to settle
  try {
    await ensureRegistered(conns);
  } catch (e: any) {
    console.warn("[market_ops] registration skipped (nonce conflict or already registered):", e.message?.slice(0, 80));
  }
  console.log("[market_ops] running as", conns.account.address);
  while (true) {
    try { await tick(); } catch (e: any) { console.error("[market_ops] tick error:", e.message); }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main();
