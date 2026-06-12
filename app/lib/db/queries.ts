import "server-only";
import { getReadSupabase } from "../supabase/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketRow {
  market_id:    number;
  open_ts:      number | null;
  close_ts:     number | null;
  status:       string | null;
  strike_price: number | null;
  close_price:  number | null;
  winner:       string | null;
  yes_reserve:  number | null;
  no_reserve:   number | null;
  oracle_feed:  string | null;
  opened_tx:    string | null;
  closed_tx:    string | null;
  created_tx:   string | null;
  updated_at:   string;
}

export interface EventRow {
  id:           string;
  tx_hash:      string;
  log_index:    number;
  block_number: number | null;
  block_time:   string | null;
  market_id:    number | null;
  kind:         string;
  actor:        string | null;
  args:         Record<string, unknown>;
  success:      boolean;
  inserted_at:  string;
}

export interface AgentRow {
  owner_address:   string;
  role:            string | null;
  label:           string | null;
  current_policy:  Record<string, unknown> | null;
  current_balance: number | null;
  registered_at:   string | null;
  last_event_at:   string | null;
  updated_at:      string;
}

export interface PublicStats {
  totalMarkets:       number;
  marketsByStatus:    Record<string, number>;
  totalEvents:        number;
  eventsLast24h:      number;
  totalAgents:        number;
  activeMarketId:     number | null;
  activeMarketStatus: string | null;
  lastEventAt:        string | null;
}

// ─── Markets ─────────────────────────────────────────────────────────────────

export async function fetchAllMarkets(opts?: { status?: string; limit?: number }): Promise<MarketRow[]> {
  const sb = getReadSupabase();
  let q = sb.from("markets").select("*").order("market_id", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.limit)  q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketRow[];
}

export async function fetchMarketById(marketId: number): Promise<MarketRow | null> {
  const sb = getReadSupabase();
  const { data, error } = await sb.from("markets").select("*").eq("market_id", marketId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as MarketRow | null;
}

export async function fetchMarketEvents(marketId: number, limit = 500): Promise<EventRow[]> {
  const sb = getReadSupabase();
  const { data, error } = await sb.from("events").select("*").eq("market_id", marketId).order("inserted_at", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function fetchAllAgents(): Promise<AgentRow[]> {
  const sb = getReadSupabase();
  const { data, error } = await sb.from("agents").select("*").order("last_event_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as AgentRow[];
}

export async function fetchAgentRow(address: string): Promise<AgentRow | null> {
  const sb = getReadSupabase();
  const { data, error } = await sb.from("agents").select("*").eq("owner_address", address).maybeSingle();
  if (error) throw error;
  return (data ?? null) as AgentRow | null;
}

export async function fetchAgentEvents(address: string, limit = 200): Promise<EventRow[]> {
  const sb = getReadSupabase();
  const { data, error } = await sb.from("events").select("*").eq("actor", address).order("inserted_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as EventRow[]).reverse();
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSnapshot {
  nowMarket:          MarketRow | null;
  recentCloseOutcomes: { market_id: number; winner: string }[];
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const sb = getReadSupabase();
  const nowSec = Math.floor(Date.now() / 1000);

  const [nowRes, closedRes] = await Promise.all([
    sb.from("markets").select("*").lte("open_ts", nowSec).gte("close_ts", nowSec).order("market_id", { ascending: false }).limit(1).maybeSingle(),
    sb.from("markets").select("market_id,winner").eq("status", "closed").not("winner", "is", null).order("market_id", { ascending: false }).limit(12),
  ]);

  return {
    nowMarket: (nowRes.data ?? null) as MarketRow | null,
    recentCloseOutcomes: ((closedRes.data ?? []) as { market_id: number; winner: string | null }[])
      .filter((r) => r.winner)
      .map((r) => ({ market_id: r.market_id, winner: r.winner! }))
      .reverse(),
  };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function fetchPublicStats(): Promise<PublicStats> {
  const sb = getReadSupabase();
  const nowSec   = Math.floor(Date.now() / 1000);
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const statuses = ["pending", "open", "halted", "closed"];

  const [statusCounts, totalEvents, eventsLast24h, totalAgents, nowMarket, lastEvent] = await Promise.all([
    Promise.all(statuses.map(async (s) => {
      const { count } = await sb.from("markets").select("market_id", { count: "exact", head: true }).eq("status", s);
      return [s, count ?? 0] as const;
    })),
    sb.from("events").select("id", { count: "exact", head: true }),
    sb.from("events").select("id", { count: "exact", head: true }).gte("inserted_at", since24h),
    sb.from("agents").select("owner_address", { count: "exact", head: true }),
    sb.from("markets").select("market_id,status").lte("open_ts", nowSec).gte("close_ts", nowSec).order("market_id", { ascending: false }).limit(1).maybeSingle(),
    sb.from("events").select("inserted_at").order("inserted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const totalMarkets = statusCounts.reduce((s, [, c]) => s + (c as number), 0);

  return {
    totalMarkets,
    marketsByStatus: Object.fromEntries(statusCounts),
    totalEvents:    totalEvents.count ?? 0,
    eventsLast24h:  eventsLast24h.count ?? 0,
    totalAgents:    totalAgents.count ?? 0,
    activeMarketId:     (nowMarket.data as any)?.market_id ?? null,
    activeMarketStatus: (nowMarket.data as any)?.status ?? null,
    lastEventAt:    (lastEvent.data as any)?.inserted_at ?? null,
  };
}
