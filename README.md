# Falco

**Policy-governed AI agent trading on short BTC/USD prediction markets — settled on Celo.**

Three autonomous agents trade YES/NO on 5-minute Bitcoin windows. Every bet is validated on-chain against the agent's policy: stake caps, oracle freshness, allowlist gating, and paused flag. Violations don't just fail — they revert with named errors traceable on Celoscan.

---

## Live Demo

- **Frontend**: https://falco-celo.vercel.app
- **Contract**: [`0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0`](https://celo-sepolia.blockscout.com/address/0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0) — Celo Sepolia
- **Agents on 8004scan**:
  - [MarketOps](https://testnet.8004scan.io/agent/0xe5c945033aF41703a88DeEaE91B6b850296332DF)
  - [Trader](https://testnet.8004scan.io/agent/0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF)
  - [Risk-LP](https://testnet.8004scan.io/agent/0xbeb9DF3E69e54376dCBADed74764168faB498Fdd)

---

## What it is

| Component | Description |
|---|---|
| `FalcoCore.sol` | Single Solidity contract: CPMM binary markets, AgentPolicy, USDC vault, Pyth oracle resolution |
| `market_ops` agent | Oracle watchdog — halts/resumes markets on Pyth staleness, closes past closeTs |
| `trader` agent | Momentum trader — bets YES/NO based on price vs strike, demos policy violations |
| `risk_lp` agent | AMM hedger — bets on the under-bought side to balance YES/NO reserves |
| `scheduler` | Rolling horizon — creates, opens, closes, and settles markets automatically |
| `app` | Next.js frontend — live BTC chart, markets table, agent profiles |

---

## Architecture

```
Celo Sepolia
└── FalcoCore.sol
    ├── USDC vault (deposit / withdraw)
    ├── Markets (CPMM AMM, Pyth oracle resolution)
    └── AgentProfiles (policy enforcement on every bet)

Off-chain
├── scheduler/   → admin key, creates + opens + closes + settles markets
└── agents/
    ├── market_ops.ts  → wallet 1, halt/resume/close watchdog
    ├── trader.ts      → wallet 2, momentum bets + policy demos
    └── risk_lp.ts     → wallet 3, AMM hedger
```

---

## Stack

| Layer | Tech |
|---|---|
| Smart contract | Solidity 0.8.20, Foundry |
| Chain | Celo Sepolia (Chain ID: 11142220) |
| Oracle | Pyth BTC/USD (`0xe62df...`) |
| Stablecoin | USDC on Celo Sepolia |
| Agent identity | ERC-8004 Identity Registry |
| Off-chain clients | TypeScript, viem |
| Frontend | Next.js 16, shadcn/ui, lightweight-charts |

---

## Quick Start

### Prerequisites
- Node.js 20+, pnpm, Foundry

### 1. Contracts (already deployed — skip to step 2)
```bash
cd contracts
forge build
forge test          # 21/21 tests
```

### 2. Scheduler
```bash
cd scheduler
cp .env.example .env   # fill PRIVATE_KEY (admin/deployer wallet)
pnpm install
pnpm dev
```

### 3. Agents
```bash
cd agents
cp .env.example .env   # fill MARKET_OPS_PRIVATE_KEY, TRADER_PRIVATE_KEY, RISK_LP_PRIVATE_KEY
pnpm install
pnpm dev:all
```

### 4. Frontend
```bash
cd app
cp .env.local.example .env.local   # or set NEXT_PUBLIC_FALCO_ADDRESS
npm install
npm run dev    # → http://localhost:3000
```

---

## Environment Variables

### `scheduler/.env`
```
PRIVATE_KEY=0x...                  # admin/deployer wallet
CELO_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
FALCO_CORE_ADDRESS=0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0
SCHEDULER_WINDOW_SECS=300
SCHEDULER_SEED_USDC=5000000
```

### `agents/.env`
```
MARKET_OPS_PRIVATE_KEY=0x...
TRADER_PRIVATE_KEY=0x...
RISK_LP_PRIVATE_KEY=0x...
CELO_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
FALCO_CORE_ADDRESS=0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0
```

---

## Policy Enforcement Demo

The `trader` agent deliberately triggers two on-chain policy violations per market window:

1. **OverPolicyCap** — places a bet exceeding `maxStakePerWindow` → `KestrelError::OverPolicyCap`
2. **MarketNotAllowed** — sets `allowedMarketsRoot` to a wrong value, places a bet → `KestrelError::MarketNotAllowed`, then restores policy

These are verifiable on Celoscan as reverted transactions from the trader address.

---

## Contract Addresses

| Resource | Address |
|---|---|
| FalcoCore (Sepolia) | `0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0` |
| USDC (Sepolia) | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` |
| Pyth Oracle (Celo) | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` |
| ERC-8004 Identity (Sepolia) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

---

## License

MIT
