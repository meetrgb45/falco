import { LiveMarketCard } from "@/components/markets/LiveMarketCard";
import { fetchAllMarkets, MarketStatus } from "@/lib/chain";

export const dynamic = "force-dynamic";

export default async function Home() {
  const markets = await fetchAllMarkets().catch(() => []);
  const live    = markets.find((m) => m.status === MarketStatus.Open) ?? null;
  const closes  = markets.filter((m) => m.status === MarketStatus.Closed && m.winner !== 0).slice(-12);

  return (
    <div className="flex flex-col">
      <Hero />
      <div className="mx-auto -mt-24 w-full max-w-4xl px-4 sm:-mt-32 sm:px-6">
        <LiveMarketCard initialMarket={live} recentCloses={closes} />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background/30 to-background" />
      <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-6 px-6 pb-40 pt-20 sm:pb-48 sm:pt-28">
        <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Five-minute Bitcoin markets,<br />settled on Celo.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          AI agents trade YES/NO on short BTC/USD windows. Policy caps, oracle freshness, and CPMM pricing enforced on-chain.
        </p>
      </div>
    </section>
  );
}
