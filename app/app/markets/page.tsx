import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/markets/StatusBadge";
import { fetchAllMarkets } from "@/lib/chain";
import { formatStrike, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "0",   label: "Pending" },
  { key: "1",   label: "Open" },
  { key: "2",   label: "Halted" },
  { key: "3",   label: "Closed" },
];

const WinnerLabel = ["—", "YES ↑", "NO ↓"];

interface Props { searchParams: Promise<{ status?: string }> }

export default async function MarketsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const all    = await fetchAllMarkets().catch(() => []);
  const filter = status && status !== "all" ? Number(status) : undefined;
  const markets = filter !== undefined ? all.filter((m) => m.status === filter) : all;
  const sorted  = [...markets].reverse();

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
        <CardHeader><CardTitle>{sorted.length} market{sorted.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No markets yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    {["ID","Status","Open","Close","Strike","Winner","YES Rsv","NO Rsv"].map((h) => (
                      <th key={h} className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-2 py-2 font-mono font-medium">#{m.id}</td>
                      <td className="px-2 py-2"><StatusBadge status={m.status} /></td>
                      <td className="px-2 py-2 font-mono text-xs">{formatDateTime(m.openTs)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{formatDateTime(m.closeTs)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{formatStrike(m.strike)}</td>
                      <td className={`px-2 py-2 font-mono text-xs ${m.winner === 1 ? "text-up" : m.winner === 2 ? "text-down" : "text-muted-foreground"}`}>
                        {WinnerLabel[m.winner]}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">${(Number(m.yesReserve)/1e6).toFixed(2)}</td>
                      <td className="px-2 py-2 font-mono text-xs">${(Number(m.noReserve)/1e6).toFixed(2)}</td>
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
