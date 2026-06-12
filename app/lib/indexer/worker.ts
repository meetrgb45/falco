// lib/indexer/worker.ts
// Polls FalcoCore contract logs on Celo Sepolia, decodes events, writes to Supabase.

import { createPublicClient, http, decodeEventLog, defineChain, type Log } from "viem";
import { celoAlfajores } from "viem/chains";
import { getWriteSupabase } from "../supabase/server";
import FalcoCoreAbi from "../abi/FalcoCore.json";

const ABI = FalcoCoreAbi as any[];

const FALCO_ADDRESS = (process.env.NEXT_PUBLIC_FALCO_ADDRESS ?? "0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0") as `0x${string}`;
const RPC_URL       = process.env.CELO_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org";
const POLL_MS       = Number(process.env.FALCO_INDEXER_POLL_MS ?? 6_000);
const CHAIN         = "celo-sepolia";

const AGENT_ROLES: Record<string, string> = {
  "0x3Ba01A7992ecB412709F945D633577f116E85250": "market_ops",
  "0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF": "trader",
  "0xbeb9DF3E69e54376dCBADed74764168faB498Fdd": "risk_lp",
};

// Celo Sepolia real chain ID is 11142220
const celoSepolia = defineChain({
  ...celoAlfajores,
  id: 11142220,
  rpcUrls: { default: { http: [RPC_URL] } },
});

const client = createPublicClient({ chain: celoSepolia, transport: http(RPC_URL) });

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_MAP = ["pending", "open", "halted", "closed"];
const WINNER_MAP = ["none", "yes", "no"];

// ─── Ingest one batch of logs ─────────────────────────────────────────────────

async function ingestLogs(fromBlock: bigint, toBlock: bigint) {
  const sb  = getWriteSupabase();
  const logs = await client.getLogs({ address: FALCO_ADDRESS, fromBlock, toBlock });

  for (const log of logs) {
    try {
      await processLog(sb, log);
    } catch (e: any) {
      console.warn("[indexer] processLog failed:", e.message?.slice(0, 120));
    }
  }
}

async function processLog(sb: ReturnType<typeof getWriteSupabase>, log: Log) {
  let decoded: { eventName: string; args: Record<string, unknown> };
  try {
    decoded = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics }) as any;
  } catch {
    return; // unknown event
  }

  const { eventName, args } = decoded;
  const block = await client.getBlock({ blockNumber: log.blockNumber! });
  const blockTime = new Date(Number(block.timestamp) * 1000).toISOString();

  // ── MarketCreated ──────────────────────────────────────────────────────────
  if (eventName === "MarketCreated") {
    const id = Number(args.id);
    await sb.from("markets").upsert({
      market_id:  id,
      open_ts:    Number(args.openTs),
      close_ts:   Number(args.closeTs),
      oracle_feed: args.oracleFeed as string,
      status:     "pending",
      created_tx: log.transactionHash,
      updated_at: blockTime,
    }, { onConflict: "market_id" });
  }

  // ── MarketOpened ───────────────────────────────────────────────────────────
  if (eventName === "MarketOpened") {
    const id = Number(args.id);
    await sb.from("markets").upsert({
      market_id:    id,
      status:       "open",
      strike_price: Number(args.strike),
      opened_tx:    log.transactionHash,
      updated_at:   blockTime,
    }, { onConflict: "market_id" });
  }

  // ── MarketClosed ───────────────────────────────────────────────────────────
  if (eventName === "MarketClosed") {
    const id = Number(args.id);
    await sb.from("markets").upsert({
      market_id:   id,
      status:      "closed",
      close_price: Number(args.finalPrice),
      winner:      WINNER_MAP[Number(args.winner)] ?? null,
      closed_tx:   log.transactionHash,
      updated_at:  blockTime,
    }, { onConflict: "market_id" });
  }

  // ── MarketHalted ───────────────────────────────────────────────────────────
  if (eventName === "MarketHalted") {
    await sb.from("markets").update({ status: "halted", updated_at: blockTime }).eq("market_id", Number(args.id));
  }

  // ── MarketResumed ──────────────────────────────────────────────────────────
  if (eventName === "MarketResumed") {
    await sb.from("markets").update({ status: "open", updated_at: blockTime }).eq("market_id", Number(args.id));
  }

  // ── AgentRegistered ────────────────────────────────────────────────────────
  if (eventName === "AgentRegistered") {
    const addr = (args.agent as string).toLowerCase();
    const normalized = Object.fromEntries(
      Object.entries(AGENT_ROLES).map(([k, v]) => [k.toLowerCase(), v])
    );
    await sb.from("agents").upsert({
      owner_address: args.agent as string,
      role:          normalized[addr] ?? null,
      registered_at: blockTime,
      updated_at:    blockTime,
    }, { onConflict: "owner_address" });
  }

  // ── Deposited ──────────────────────────────────────────────────────────────
  if (eventName === "Deposited") {
    await sb.from("agents").upsert({
      owner_address:   args.agent as string,
      current_balance: Number(args.amount),
      updated_at:      blockTime,
    }, { onConflict: "owner_address" });
  }

  // ── PolicyUpdated ──────────────────────────────────────────────────────────
  if (eventName === "PolicyUpdated") {
    await sb.from("agents").update({ updated_at: blockTime }).eq("owner_address", args.agent as string);
  }

  // ── BetPlaced ─────────────────────────────────────────────────────────────
  if (eventName === "BetPlaced") {
    const marketId = Number(args.marketId);
    await sb.from("events").upsert({
      tx_hash:      log.transactionHash!,
      log_index:    Number(log.logIndex ?? 0),
      block_number: Number(log.blockNumber ?? 0),
      block_time:   blockTime,
      market_id:    marketId,
      kind:         "BetPlaced",
      actor:        args.agent as string,
      args:         { side: Number(args.side) === 0 ? "yes" : "no", amount: Number(args.amount), shares: Number(args.shares) },
      success:      true,
      inserted_at:  blockTime,
    }, { onConflict: "tx_hash,log_index" });

    // Update agent last_event_at
    await sb.from("agents").update({ last_event_at: blockTime, updated_at: blockTime }).eq("owner_address", args.agent as string);
  }

  // ── BetCancelled ──────────────────────────────────────────────────────────
  if (eventName === "BetCancelled") {
    await sb.from("events").upsert({
      tx_hash: log.transactionHash!, log_index: Number(log.logIndex ?? 0),
      block_number: Number(log.blockNumber ?? 0), block_time: blockTime,
      market_id: Number(args.marketId), kind: "BetCancelled",
      actor: args.agent as string, args: { marketId: Number(args.marketId) }, success: true, inserted_at: blockTime,
    }, { onConflict: "tx_hash,log_index" });
    await sb.from("agents").update({ last_event_at: blockTime, updated_at: blockTime }).eq("owner_address", args.agent as string);
  }

  // ── PositionSettled ────────────────────────────────────────────────────────
  if (eventName === "PositionSettled") {
    await sb.from("events").upsert({
      tx_hash: log.transactionHash!, log_index: Number(log.logIndex ?? 0),
      block_number: Number(log.blockNumber ?? 0), block_time: blockTime,
      market_id: Number(args.marketId), kind: "PositionSettled",
      actor: args.agent as string, args: { payout: Number(args.payout) }, success: true, inserted_at: blockTime,
    }, { onConflict: "tx_hash,log_index" });
    await sb.from("agents").update({ last_event_at: blockTime, updated_at: blockTime }).eq("owner_address", args.agent as string);
  }

  // All market events also written to events table
  if (["MarketOpened","MarketClosed","MarketHalted","MarketResumed","MarketCreated"].includes(eventName)) {
    await sb.from("events").upsert({
      tx_hash: log.transactionHash!, log_index: Number(log.logIndex ?? 0),
      block_number: Number(log.blockNumber ?? 0), block_time: blockTime,
      market_id: Number(args.id ?? args.marketId ?? 0), kind: eventName,
      actor: null, args: args as any, success: true, inserted_at: blockTime,
    }, { onConflict: "tx_hash,log_index" });
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

export function startIndexer() {
  console.log("[indexer] starting — FalcoCore:", FALCO_ADDRESS);

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sb = getWriteSupabase();

      // Test Supabase connection
      const { error: pingErr } = await sb.from("cursors").select("last_block").eq("chain", CHAIN).maybeSingle();
      if (pingErr) { console.error("[indexer] Supabase error:", pingErr.message); return; }

      // Get last indexed block
      const { data } = await sb.from("cursors").select("last_block").eq("chain", CHAIN).maybeSingle();
      const lastBlock = BigInt((data as any)?.last_block ?? 0);
      const latest    = await client.getBlockNumber();
      console.log(`[indexer] last=${lastBlock} latest=${latest}`);

      if (latest <= lastBlock) return;

      // Batch in 1000-block chunks
      const CHUNK = 1000n;
      let from = lastBlock + 1n;
      while (from <= latest) {
        const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
        await ingestLogs(from, to);
        from = to + 1n;
      }

      await sb.from("cursors").update({ last_block: Number(latest), updated_at: new Date().toISOString() }).eq("chain", CHAIN);
      console.log(`[indexer] indexed up to block ${latest}`);
    } catch (e: any) {
      console.error("[indexer] tick error:", e.message);
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => void tick(), POLL_MS);
}
