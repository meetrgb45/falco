import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAllMarkets } from "@/lib/db/queries";
import { formatStrike, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all",     label: "All" },
  { key: "pending", label: "Pending" },
  { key: "open",    label: "Open" },
  { key: "halted",  label: "Halted" },
  { key: "closed",  label: "Closed" },
];

const STATUS_COLOR: Record<string, string> = {
  open:    "text-emerald-500",
  halted:  "text-yellow-500",
  closed:  "text-zinc-400",
  pending: "text-zinc-500",
};

interface Props { searchParams: Promise<{ status?: string }> }

export default async function MarketsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const filter  = status && status !== "all" ? status : undefined;
  const markets = await fetchAllMarkets({ status: filter, limit: 200 }).catch(() => []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="text-sm text-muted-foreground">Every 5-minute window the scheduler has produced.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = (f.key === "all" && !status) || f.key === status;
          return (
            <Link key={f.key} href={f.key === "all" ? "/markets" : `/markets?status=${f.key}`}
              className={active
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"}>
              {f.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>{markets.length} market{markets.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
        <CardContent>
          {markets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No markets yet for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    {["ID","Status","Open","Close","Strike","Final","Winner"].map((h) => (
                      <th key={h} className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {markets.map((m) => (
                    <tr key={m.market_id} className="transition-colors hover:bg-muted/40">
                      <td className="px-2 py-2 font-mono font-medium">#{m.market_id}</td>
                      <td className={`px-2 py-2 font-medium capitalize ${STATUS_COLOR[m.status ?? ""] ?? ""}`}>{m.status}</td>
                      <td className="px-2 py-2 font-mono text-xs">{formatDateTime(m.open_ts ?? undefined)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{formatDateTime(m.close_ts ?? undefined)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{formatStrike(m.strike_price ?? undefined)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{formatStrike(m.close_price ?? undefined)}</td>
                      <td className={`px-2 py-2 font-medium ${m.winner === "yes" ? "text-up" : m.winner === "no" ? "text-down" : "text-muted-foreground"}`}>
                        {m.winner === "yes" ? "YES ↑" : m.winner === "no" ? "NO ↓" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
