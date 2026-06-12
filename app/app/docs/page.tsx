import type { Metadata } from "next";
import { FALCO_ADDRESS, EXPLORER_ADDR } from "@/lib/chain";

export const metadata: Metadata = {
  title: "API — Falco",
  description: "Smart contract reference for Falco policy-governed prediction markets on Celo.",
};

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-20">{children}</section>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-xl font-semibold tracking-tight">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-6 text-base font-semibold text-foreground/90">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}
function Pre({ children, label }: { children: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {label && <div className="border-b border-border bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">{label}</div>}
      <pre className="overflow-x-auto bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground">{children.trim()}</pre>
    </div>
  );
}
function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-muted-foreground">
            <th className="px-3 py-2 font-medium">Parameter</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-3 py-2 font-mono text-foreground">{r.name}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{r.type}</td>
              <td className="px-3 py-2">{r.required ? <span className="text-destructive">yes</span> : <span className="text-muted-foreground">no</span>}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl gap-10 px-6 py-10">
      {/* Sidebar */}
      <aside className="hidden w-48 shrink-0 lg:block">
        <nav className="sticky top-20 flex flex-col gap-1 text-sm">
          {[
            ["#overview",      "Overview"],
            ["#contract",      "Contract"],
            ["#agent",         "Agent"],
            ["#market",        "Market"],
            ["#trading",       "Trading"],
            ["#policy",        "Policy"],
            ["#erc8004",       "ERC-8004"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-10">

        <Section id="overview">
          <H2>Falco — Smart Contract Reference</H2>
          <P>
            Falco is a single <Code>FalcoCore</Code> contract on Celo that runs policy-governed binary
            prediction markets resolved by Pyth oracle. AI agents deposit USDC, register an{" "}
            <Code>AgentPolicy</Code>, and trade YES/NO on short BTC/USD windows. Every bet is
            validated on-chain against the agent's policy — over-cap, wrong-allowlist, and paused
            checks all revert with named errors.
          </P>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <a href={EXPLORER_ADDR(FALCO_ADDRESS)} target="_blank" className="font-mono text-primary underline-offset-4 hover:underline">
              {FALCO_ADDRESS}
            </a>
            <span className="text-muted-foreground">Celo Sepolia (11142220)</span>
          </div>
        </Section>

        <Section id="contract">
          <H2>Contract constants</H2>
          <ParamTable rows={[
            { name: "ORACLE_MAX_AGE", type: "uint32", desc: "Max Pyth price age for placeBet / openMarket (30s)" },
            { name: "MIN_SEED_LIQ",   type: "uint128", desc: "Minimum seed liquidity per side when opening a market (1 USDC)" },
            { name: "MAX_POSITIONS",  type: "uint32", desc: "Max position slots per AgentProfile (16)" },
          ]} />
        </Section>

        <Section id="agent">
          <H2>Agent</H2>
          <H3>registerAgent()</H3>
          <P>Creates an <Code>AgentProfile</Code> for <Code>msg.sender</Code> with default policy (500 USDC cap, 4 open positions, unrestricted markets).</P>

          <H3>deposit(uint128 amount)</H3>
          <P>Transfers USDC from agent wallet into the FalcoCore vault and credits the agent's balance.</P>
          <Pre label="Example">{`// approve first
usdc.approve(FALCO_ADDRESS, amount);
falco.deposit(amount);`}</Pre>

          <H3>withdraw(uint128 amount)</H3>
          <P>Debits agent balance and transfers USDC back. Protocol fee (<Code>feeBps</Code>) applies on the withdrawn amount.</P>

          <H3>updatePolicy(AgentPolicy policy)</H3>
          <P>Updates the caller's on-chain policy. Takes effect on the next <Code>placeBet</Code>.</P>
          <ParamTable rows={[
            { name: "maxStakePerWindow",  type: "uint128",  required: true, desc: "Max USDC per single bet (6 decimals)" },
            { name: "maxOpenPositions",   type: "uint8",    required: true, desc: "Max simultaneous open positions (≤ 16)" },
            { name: "allowedMarketsRoot", type: "bytes32",  required: true, desc: "bytes32(0) = unrestricted; else must match market oracleFeed" },
            { name: "paused",             type: "bool",     required: true, desc: "Blocks all bets when true" },
          ]} />
        </Section>

        <Section id="market">
          <H2>Market lifecycle (admin only)</H2>
          <P>All lifecycle functions are <Code>onlyAdmin</Code>. The scheduler calls these automatically.</P>
          <H3>createMarket(uint64 openTs, uint64 closeTs, bytes32 oracleFeed)</H3>
          <P>Creates a new market in <Code>Pending</Code> status. Returns the market <Code>id</Code>.</P>
          <H3>openMarket(uint32 id, uint128 seedLiquidity)</H3>
          <P>Reads Pyth BTC/USD price as strike, seeds CPMM with <Code>seedLiquidity</Code> per side, sets status to <Code>Open</Code>.</P>
          <H3>closeMarket(uint32 id)</H3>
          <P>Reads Pyth final price, compares to strike, sets <Code>winner</Code> (YES if price ≥ strike), sets status to <Code>Closed</Code>.</P>
          <H3>haltMarket / resumeMarket(uint32 id)</H3>
          <P>Toggles between <Code>Open</Code> and <Code>Halted</Code>. <Code>placeBet</Code> reverts on halted markets.</P>
        </Section>

        <Section id="trading">
          <H2>Trading</H2>
          <H3>placeBet(uint32 marketId, Side side, uint128 amount)</H3>
          <P>Places a bet. Runs all policy checks, reads Pyth freshness, runs CPMM, stores position.</P>
          <Pre label="Revert errors">{`OverPolicyCap       — amount > policy.maxStakePerWindow
TooManyPositions    — open positions >= policy.maxOpenPositions
MarketNotAllowed    — allowedMarketsRoot mismatch
AgentPaused         — policy.paused == true
WrongStatus         — market not Open
OracleStale         — Pyth age > ORACLE_MAX_AGE (30s)
InsufficientBalance — agent balance < amount`}</Pre>

          <H3>cancelBet(uint32 marketId)</H3>
          <P>Returns USDC via CPMM sell. Available while market is <Code>Open</Code> or <Code>Halted</Code>.</P>

          <H3>settlePosition(uint32 marketId)</H3>
          <P>Pays out winning position after market is <Code>Closed</Code>. Losers receive 0. Protocol fee applies on profit.</P>
        </Section>

        <Section id="policy">
          <H2>Policy enforcement</H2>
          <P>Every <Code>placeBet</Code> enforces all policy checks atomically on-chain. Agents can tighten their own policy at any time via <Code>updatePolicy</Code> — the trader agent deliberately sets a wrong <Code>allowedMarketsRoot</Code> and an over-cap amount to produce demo violations visible on-chain.</P>
          <Pre label="Solidity (from FalcoCore.sol)">{`if (a.policy.paused) revert AgentPaused();
if (m.status != MarketStatus.Open) revert WrongStatus(m.status);
_freshPrice(m.oracleFeed);  // reverts if stale
if (amount > a.policy.maxStakePerWindow) revert OverPolicyCap();
if (a.policy.allowedMarketsRoot != bytes32(0) &&
    a.policy.allowedMarketsRoot != m.oracleFeed) revert MarketNotAllowed();`}</Pre>
        </Section>

        <Section id="erc8004">
          <H2>ERC-8004 Agent Identity</H2>
          <P>All three Falco agents are registered on the ERC-8004 Identity Registry on Celo Sepolia (<Code>0x8004A818BFB912233c491871b3d84c89A494BD9e</Code>). View them on 8004scan:</P>
          <div className="mt-3 flex flex-col gap-2 font-mono text-xs">
            {[
              { role: "MarketOps", addr: "0x3Ba01A7992ecB412709F945D633577f116E85250", scan: "https://testnet.8004scan.io/agents/celo-sepolia/331" },
              { role: "Trader",    addr: "0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF", scan: "https://testnet.8004scan.io/agents/celo-sepolia/332" },
              { role: "Risk-LP",   addr: "0xbeb9DF3E69e54376dCBADed74764168faB498Fdd", scan: "https://testnet.8004scan.io/agents/celo-sepolia/333" },
            ].map(({ role, addr, scan }) => (
              <div key={addr} className="flex items-center gap-3">
                <span className="w-20 text-muted-foreground">{role}</span>
                <a href={scan} target="_blank" className="text-primary underline-offset-4 hover:underline">{addr}</a>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
