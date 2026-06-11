/**
 * trader — momentum bet + scripted policy violation demos
 * T+0s  honest bet (should succeed)
 * T+10s over-cap bet (expect OverPolicyCap revert)
 * T+20s wrong-allowlist bet (expect MarketNotAllowed revert), then restore
 */
import { buildConnections } from "./common/connections.js";
import { send } from "./common/tx.js";
import { findActiveOpenMarket, MarketStatus } from "./common/markets.js";
import { readOracleSnapshot } from "./common/oracle.js";
import { ensureRegistered, getBalance } from "./common/registry.js";
import { defaultPolicy, WRONG_ROOT, ZERO_ROOT } from "./common/policy.js";
import { FALCO_CORE_ADDRESS } from "./common/connections.js";

const TICK_MS       = 1000;
const BASE_SIZE     = BigInt(process.env.AGENTS_TRADER_BASE_SIZE     ?? "200000");
const TARGET_BAL    = BigInt(process.env.AGENTS_TRADER_TARGET_BALANCE ?? "2000000");
const OVER_CAP_AT   = Number(process.env.AGENTS_TRADER_OVER_CAP_AT   ?? 10);
const WRONG_LIST_AT = Number(process.env.AGENTS_TRADER_WRONG_LIST_AT ?? 20);

const conns = buildConnections("trader");

interface MarketMemo {
  honestPlaced:          boolean;
  overCapAttempted:      boolean;
  wrongAllowlistAttempted: boolean;
}
const memos = new Map<number, MarketMemo>();

async function ensureDeposited() {
  const bal = await getBalance(conns);
  if (bal < TARGET_BAL) {
    // approve + deposit
    const needed = TARGET_BAL - bal;
    console.log(`[trader] depositing ${needed} USDC...`);
    // approve USDC first
    const usdcAbi = [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" }];
    const approvHash = await conns.walletClient.writeContract({
      address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
      abi: usdcAbi,
      functionName: "approve",
      args: [FALCO_CORE_ADDRESS, needed],
    });
    await conns.publicClient.waitForTransactionReceipt({ hash: approvHash });
    await send(conns, "deposit", [needed]);
    console.log(`[trader] deposited ${needed}`);
  }
}

async function placeBet(marketId: number, side: number, amount: bigint, expectFail?: string) {
  try {
    const h = await send(conns, "placeBet", [marketId, side, amount]);
    console.log(`[trader] placeBet market=${marketId} side=${side} amount=${amount} tx=${h}`);
  } catch (e: any) {
    if (expectFail) {
      console.log(`[trader] placeBet blocked (expected ${expectFail}):`, e.message?.slice(0, 80));
    } else {
      console.warn(`[trader] placeBet failed:`, e.message?.slice(0, 100));
    }
  }
}

async function tick() {
  const market = await findActiveOpenMarket(conns);
  if (!market) return;
  if (market.status !== 1) return; // only bet on Open markets

  const nowSec = Math.floor(Date.now() / 1000);
  let memo = memos.get(market.id);
  if (!memo) {
    memo = { honestPlaced: false, overCapAttempted: false, wrongAllowlistAttempted: false };
    memos.set(market.id, memo);
  }

  const elapsed = nowSec - market.openTs;

  // T+0: honest momentum bet
  if (!memo.honestPlaced) {
    const snap = await readOracleSnapshot();
    // YES if price >= strike, NO otherwise
    const side = snap && Number(snap.rawPrice) >= Number(market.strike) ? 0 : 1; // 0=Yes 1=No
    await placeBet(market.id, side, BASE_SIZE);
    memo.honestPlaced = true;
  }

  // T+10: over-cap violation
  if (!memo.overCapAttempted && elapsed >= OVER_CAP_AT) {
    memo.overCapAttempted = true;
    const pol = defaultPolicy();
    await placeBet(market.id, 0, pol.maxStakePerWindow + 1n, "OverPolicyCap");
  }

  // T+20: wrong-allowlist violation then restore
  if (!memo.wrongAllowlistAttempted && elapsed >= WRONG_LIST_AT) {
    memo.wrongAllowlistAttempted = true;
    const pol = defaultPolicy();
    // tighten policy
    await send(conns, "updatePolicy", [{ ...pol, allowedMarketsRoot: WRONG_ROOT }]);
    await placeBet(market.id, 1, BASE_SIZE, "MarketNotAllowed");
    // restore
    await send(conns, "updatePolicy", [pol]);
    console.log("[trader] policy restored");
  }
}

async function main() {
  await ensureRegistered(conns);
  await ensureDeposited();
  console.log("[trader] running as", conns.account.address);
  while (true) {
    try { await tick(); } catch (e: any) { console.error("[trader] tick error:", e.message); }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main();
