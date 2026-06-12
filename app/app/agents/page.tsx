import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAgent } from "@/lib/chain";
import { explorerAddressUrl, formatUsdc } from "@/lib/format";

export const dynamic = "force-dynamic";

const AGENTS = [
  { role: "market_ops", address: "0x3Ba01A7992ecB412709F945D633577f116E85250" as `0x${string}`, scan8004: "https://testnet.8004scan.io/agents/celo-sepolia/331", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400", desc: "Oracle watchdog. Halts/resumes market on Pyth staleness. Runs force-halt demo every 4th market." },
  { role: "trader",     address: "0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF" as `0x${string}`, scan8004: "https://testnet.8004scan.io/agents/celo-sepolia/332", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",  desc: "Momentum trader. Demos OverPolicyCap and MarketNotAllowed on-chain reverts each window." },
  { role: "risk_lp",   address: "0xbeb9DF3E69e54376dCBADed74764168faB498Fdd" as `0x${string}`, scan8004: "https://testnet.8004scan.io/agents/celo-sepolia/333", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", desc: "AMM hedger. Balances YES/NO reserves by betting on the under-bought side." },
];

const ROLE_LABEL: Record<string, string> = { market_ops: "MarketOps", trader: "Trader", risk_lp: "Risk-LP" };

export default async function AgentsPage() {
  const agents = await Promise.all(AGENTS.map(async (a) => ({ ...a, data: await fetchAgent(a.address) })));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Three autonomous agents trading on FalcoCore, registered on{" "}
          <a href="https://testnet.8004scan.io" target="_blank" className="text-primary underline-offset-4 hover:underline">ERC-8004</a>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {agents.map(({ role, address, scan8004, tone, desc, data }) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{ROLE_LABEL[role]}</span>
                {data?.policy.paused && (
                  <span className="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">paused</span>
                )}
                <Link href={`/agents/${address}`} className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline">
                  View timeline
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:gap-8">
              {/* Left: address + links + desc */}
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <p className="font-mono text-xs text-muted-foreground break-all">{address}</p>
                <div className="flex gap-2">
                  <a href={explorerAddressUrl(address)} target="_blank"
                    className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    Blockscout
                  </a>
                  <a href={scan8004} target="_blank"
                    className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    8004scan
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>

              {/* Right: on-chain stats */}
              {data?.registered ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 border-t border-border pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-8 text-xs shrink-0">
                  <Stat label="Balance"       value={formatUsdc(data.balance)} />
                  <Stat label="Max stake"     value={formatUsdc(data.policy.maxStakePerWindow)} />
                  <Stat label="Max positions" value={String(data.policy.maxOpenPositions)} />
                  <Stat label="Paused"        value={data.policy.paused ? "yes" : "no"} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Add <code className="rounded bg-muted px-1">CELO_RPC_URL</code> to Vercel env vars to see live data.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
