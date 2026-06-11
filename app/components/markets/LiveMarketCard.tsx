"use client";

import Image from "next/image";
import { BtcLiveChart } from "./BtcLiveChart";
import { MarketCountdown } from "./MarketCountdown";
import { useLiveBtcPrice } from "./useLiveBtcPrice";
import { formatPrice, STRIKE_SCALE } from "@/lib/format";
import type { Market } from "@/lib/chain";

function dateRangeLabel(openTs: number, closeTs: number) {
  const o = new Date(openTs * 1000);
  const c = new Date(closeTs * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "");
  return `${o.toLocaleString(undefined, { month: "long", day: "numeric" })}, ${fmt(o)}–${fmt(c)}`;
}

interface Props { initialMarket: Market | null; recentCloses: Market[] }

export function LiveMarketCard({ initialMarket, recentCloses }: Props) {
  const market = initialMarket;
  const { price, history } = useLiveBtcPrice();

  const strikeUsd = market && market.strike > 0n
    ? Number(market.strike) / STRIKE_SCALE
    : null;
  const delta = price != null && strikeUsd != null ? price - strikeUsd : null;

  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_30px_60px_-30px_rgba(0,0,0,0.4)]">
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div className="flex items-start gap-3">
          <span className="relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10">
            <Image src="/BTC.png" alt="" width={40} height={40} className="h-10 w-10 object-cover" priority />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-xl font-semibold tracking-tight">Bitcoin Up or Down</h2>
            <p className="text-sm text-muted-foreground" suppressHydrationWarning>
              {market
                ? <>Market #{market.id} · {dateRangeLabel(market.openTs, market.closeTs)}</>
                : "Waiting for the next window…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <MarketCountdown closeTs={market?.closeTs ?? null} />
          <div className="flex gap-1">
            {recentCloses.slice(-8).map((m) => (
              <span key={m.id} className={`inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-semibold ${m.winner === 1 ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                {m.winner === 1 ? "↑" : "↓"}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 px-6 py-6 sm:grid-cols-2">
        <Stat label="Price to beat" value={strikeUsd != null ? `$${formatPrice(strikeUsd)}` : "—"} />
        <Stat
          label="Current price"
          value={price != null ? `$${formatPrice(price)}` : "—"}
          accent
          trailing={delta != null ? (
            <span className={`text-sm font-medium ${delta >= 0 ? "text-up" : "text-down"}`}>
              {delta >= 0 ? "+" : ""}{formatPrice(delta)}
            </span>
          ) : undefined}
        />
      </div>

      <div className="px-2 pb-2">
        <BtcLiveChart history={history} priceToBeat={strikeUsd} />
      </div>
    </section>
  );
}

function Stat({ label, value, accent, trailing }: { label: string; value: string; accent?: boolean; trailing?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className={`font-display text-3xl font-semibold tracking-tight tabular ${accent ? "text-brand" : ""}`}>{value}</span>
        {trailing}
      </div>
    </div>
  );
}
