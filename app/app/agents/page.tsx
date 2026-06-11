import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAgent, FALCO_ADDRESS } from "@/lib/chain";
import { explorerAddressUrl, formatUsdc, shortPubkey } from "@/lib/format";
import { privateKeyToAccount } from "viem/accounts";

export const dynamic = "force-dynamic";

const AGENTS = [
  { role: "market_ops", pk: "0x86d2fd1d26ae2fe1aae71057ee66197c0d68be5bee1882117307d8f936dca56a" as `0x${string}`, tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400", desc: "Oracle watchdog — halts/resumes market on Pyth staleness." },
  { role: "trader",     pk: "0xffadd0aa94c3513da65ef607deee74c8ae16865bd866ff23a05e55d0bb3a98e4" as `0x${string}`, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",  desc: "Momentum trader — demos OverPolicyCap & MarketNotAllowed violations." },
  { role: "risk_lp",   pk: "0x6c910983346c56a218d94bbb7413b75be7e2293d2bd76b01a9ffe880cd0d0e43" as `0x${string}`, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", desc: "AMM hedger — balances YES/NO reserves." },
];

const ROLE_LABEL: Record<string,string> = { market_ops:"MarketOps", trader:"Trader", risk_lp:"Risk-LP" };

export default async function AgentsPage() {
  const agents = await Promise.all(
    AGENTS.map(async ({ role, pk, tone, desc }) => {
      const address = privateKeyToAccount(pk).address;
      const data    = await fetchAgent(address);
      return { role, address, tone, desc, data };
    })
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">Three autonomous agents trading on FalcoCore</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {agents.map(({ role, address, tone, desc, data }) => (
          <Card key={role} className="flex flex-col gap-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>
                  {ROLE_LABEL[role]}
                </span>
                {data?.policy.paused && (
                  <span className="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">paused</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <a href={explorerAddressUrl(address)} target="_blank" className="font-mono text-xs text-primary underline-offset-4 hover:underline">
                {address}
              </a>
              <p className="text-xs text-muted-foreground">{desc}</p>
              {data?.registered ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
                  <Stat label="Balance"       value={formatUsdc(data.balance)} />
                  <Stat label="Max stake"     value={formatUsdc(data.policy.maxStakePerWindow)} />
                  <Stat label="Max positions" value={String(data.policy.maxOpenPositions)} />
                  <Stat label="Paused"        value={data.policy.paused ? "yes" : "no"} />
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">Not registered yet</p>
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
