"use client";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { EventRow } from "@/lib/db/queries";
import { explorerAddressUrl } from "@/lib/format";

const KIND_TONE: Record<string, string> = {
  BetPlaced:       "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  BetCancelled:    "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  PositionSettled: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  MarketOpened:    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  MarketClosed:    "bg-zinc-500/10 text-zinc-500",
  MarketHalted:    "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  MarketResumed:   "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  PolicyUpdated:   "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  AgentRegistered: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
}

function EventRow({ ev }: { ev: EventRow }) {
  const tone = KIND_TONE[ev.kind] ?? "bg-muted text-muted-foreground";
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{ev.kind}</span>
        {ev.market_id != null && <span className="text-muted-foreground">Market #{ev.market_id}</span>}
        <span className="ml-auto text-muted-foreground">{fmt(ev.block_time ?? ev.inserted_at)}</span>
      </div>
      {Object.keys(ev.args).length > 0 && (
        <pre className="overflow-x-auto rounded bg-muted/40 px-2 py-1 font-mono text-xs text-foreground/80">
          {JSON.stringify(ev.args, null, 2)}
        </pre>
      )}
      <a href={`https://celo-sepolia.blockscout.com/tx/${ev.tx_hash}`} target="_blank"
        className="font-mono text-[10px] text-primary underline-offset-4 hover:underline">
        {ev.tx_hash.slice(0, 20)}… ↗
      </a>
    </div>
  );
}

interface Props {
  initialEvents: EventRow[];
  marketId?:     number;
  actor?:        string;
  emptyHint?:    string;
}

export function RealtimeTimeline({ initialEvents, marketId, actor, emptyHint }: Props) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);

  useEffect(() => {
    let sb: ReturnType<typeof getBrowserSupabase>;
    try { sb = getBrowserSupabase(); } catch { return; }

    let filter = "kind=neq.NULL";
    if (marketId != null) filter = `market_id=eq.${marketId}`;
    if (actor)            filter = `actor=eq.${actor}`;

    const channel = sb.channel("events-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter },
        (payload) => setEvents((prev) => [...prev, payload.new as EventRow])
      )
      .subscribe();

    return () => { void sb.removeChannel(channel); };
  }, [marketId, actor]);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyHint ?? "No events yet."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {[...events].reverse().map((ev) => <EventRow key={ev.id} ev={ev} />)}
    </div>
  );
}
