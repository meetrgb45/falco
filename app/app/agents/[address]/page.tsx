import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAgentRow, fetchAgentEvents } from "@/lib/db/queries";
import { fetchAgent } from "@/lib/chain";
import { explorerAddressUrl, formatUsdc, shortPubkey, relativeTime } from "@/lib/format";
import { RealtimeTimeline } from "@/components/timeline/RealtimeTimeline";

export const dynamic = "force-dynamic";

const AGENT_META: Record<string, { role: string; tone: string; scan8004: string; desc: string }> = {
  "0x3Ba01A7992ecB412709F945D633577f116E85250": {
    role: "market_ops", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    scan8004: "https://testnet.8004scan.io/agents/celo-sepolia/331",
    desc: "Oracle watchdog. Halts/resumes market on Pyth staleness.",
  },
  "0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF": {
    role: "trader", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    scan8004: "https://testnet.8004scan.io/agents/celo-sepolia/332",
    desc: "Momentum trader. Bets YES/NO based on price vs strike. Demos on-chain policy violations.",
  },
  "0xbeb9DF3E69e54376dCBADed74764168faB498Fdd": {
    role: "risk_lp", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    scan8004: "https://testnet.8004scan.io/agents/celo-sepolia/333",
    desc: "AMM hedger. Balances YES/NO reserves. Cancels near close.",
  },
};

const ROLE_LABEL: Record<string, string> = { market_ops: "MarketOps", trader: "Trader", risk_lp: "Risk-LP" };

export default async function AgentDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const meta = AGENT_META[address];
  if (!meta) notFound();

  const [chainData, dbAgent, events] = await Promise.all([
    fetchAgent(address as `0x${string}`),
    fetchAgentRow(address).catch(() => null),
    fetchAgentEvents(address, 200).catch(() => []),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground">← All agents</Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${meta.tone}`}>
              {ROLE_LABEL[meta.role]}
            </span>
            <span className="font-mono text-base">{shortPubkey(address, 6, 6)}</span>
            {chainData?.policy.paused && (
              <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">paused</span>
            )}
            <div className="ml-auto flex gap-2">
              <a href={explorerAddressUrl(address)} target="_blank"
                className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                Blockscout ↗
              </a>
              <a href={meta.scan8004} target="_blank"
                className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                8004scan ↗
              </a>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="font-mono text-xs text-muted-foreground break-all">{address}</div>
          <p className="text-sm text-muted-foreground">{meta.desc}</p>

          {chainData?.registered ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-4 sm:grid-cols-4">
              <Stat label="Balance"       value={formatUsdc(chainData.balance)} />
              <Stat label="Max stake"     value={formatUsdc(chainData.policy.maxStakePerWindow)} />
              <Stat label="Max positions" value={String(chainData.policy.maxOpenPositions)} />
              <Stat label="Paused"        value={chainData.policy.paused ? "yes" : "no"} />
              {dbAgent?.registered_at && <Stat label="Registered" value={relativeTime(dbAgent.registered_at)} />}
              {dbAgent?.last_event_at  && <Stat label="Last action" value={relativeTime(dbAgent.last_event_at)} />}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">Not registered on-chain yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Event timeline</CardTitle></CardHeader>
        <CardContent>
          <RealtimeTimeline
            initialEvents={events}
            actor={address}
            emptyHint="No events indexed yet. The indexer will stream events here as agents trade."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}
