import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPublicStats } from "@/lib/db/queries";
import { relativeTime } from "@/lib/format";
import { FALCO_ADDRESS, EXPLORER_ADDR } from "@/lib/chain";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats — Falco" };

function StatBlock({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function StatsPage() {
  let stats = null;
  let err = null;
  try { stats = await fetchPublicStats(); }
  catch (e: any) { err = e.message; }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Network stats</h1>
        <p className="text-sm text-muted-foreground">Aggregates from the indexer (Supabase).</p>
        <a href={EXPLORER_ADDR(FALCO_ADDRESS)} target="_blank" className="font-mono text-xs text-muted-foreground underline-offset-4 hover:underline">
          {FALCO_ADDRESS}
        </a>
      </div>

      {err ? (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-base text-destructive">Could not load stats</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Check <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and anon key.</p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-xs">{err}</pre>
          </CardContent>
        </Card>
      ) : stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock label="Markets (total)" value={stats.totalMarkets} />
            <StatBlock label="Events indexed"  value={stats.totalEvents} />
            <StatBlock label="Events (24h)"    value={stats.eventsLast24h} hint="Last rolling 24 hours." />
            <StatBlock label="Agents tracked"  value={stats.totalAgents} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Markets by status</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {Object.entries(stats.marketsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
                    <span className="capitalize text-muted-foreground">{status}</span>
                    <span className="font-mono font-medium tabular-nums">{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Live window</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {stats.activeMarketId != null ? (
                <p>Active market <span className="font-mono text-foreground">#{stats.activeMarketId}</span>
                  {stats.activeMarketStatus && <> — <span className="capitalize">{stats.activeMarketStatus}</span></>}
                </p>
              ) : (
                <p>No market in the open window right now.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Indexer activity</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {stats.lastEventAt ? (
                <p>Last indexed event <span className="text-foreground">{relativeTime(stats.lastEventAt)}</span></p>
              ) : (
                <p>No events yet — start the indexer with <code className="rounded bg-muted px-1">FALCO_INDEXER_ENABLED=true</code>.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/docs"    className="font-medium text-primary underline-offset-4 hover:underline">API reference</Link>
        <Link href="/markets" className="font-medium text-primary underline-offset-4 hover:underline">Markets</Link>
        <Link href="/agents"  className="font-medium text-primary underline-offset-4 hover:underline">Agents</Link>
      </div>
    </div>
  );
}
