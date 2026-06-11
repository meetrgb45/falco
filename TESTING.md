# Falco — Judge Testing Guide

This guide walks through everything a judge needs to verify Falco end-to-end.

---

## 1. Contract verification

**FalcoCore on Celo Sepolia**
- Address: `0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0`
- Explorer: https://celo-sepolia.blockscout.com/address/0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0

Verify it's deployed and read-only state is accessible:
```bash
# Read admin address
cast call 0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0 \
  "admin()(address)" \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org

# Read market count
cast call 0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0 \
  "marketCount()(uint32)" \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org
```

---

## 2. Run the test suite (21/21)

```bash
cd contracts
forge test -v
```

Expected output: `21 passed; 0 failed`

Tests cover:
- Market lifecycle (create → open → halt → resume → close)
- Agent registration, deposit, withdraw
- Happy path: placeBet, cancelBet, settlePosition (winner + loser)
- **Policy reverts**: `OverPolicyCap`, `AgentPaused`, `MarketNotAllowed`, `TooManyPositions`, `OracleStale`, `WrongStatus`, `InsufficientBalance`, `Unauthorized`

---

## 3. Verify ERC-8004 agent identities

All 3 agents are registered on the ERC-8004 Identity Registry on Celo Sepolia.

View on 8004scan:
- **MarketOps**: https://testnet.8004scan.io/agent/0xe5c945033aF41703a88DeEaE91B6b850296332DF
- **Trader**: https://testnet.8004scan.io/agent/0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF
- **Risk-LP**: https://testnet.8004scan.io/agent/0xbeb9DF3E69e54376dCBADed74764168faB498Fdd

Verify on-chain:
```bash
# Check MarketOps is registered (balance > 0 means registered)
cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
  "balanceOf(address)(uint256)" \
  0xe5c945033aF41703a88DeEaE91B6b850296332DF \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org
```

---

## 4. Observe live agent activity

### Frontend
Visit the live demo: **https://falco-celo.vercel.app**

- **Home** — Live BTC/USD chart (TradingView lightweight-charts), price vs strike delta, recent market outcomes
- **Markets** — All markets with status, strike, winner, YES/NO reserves
- **Agents** — Agent profiles with balance, policy, registration status
- **API** — Smart contract reference

### Watch on Celoscan
With agents running, watch transactions arrive from the 3 agent wallets:
- `0xe5c945033aF41703a88DeEaE91B6b850296332DF` (MarketOps)
- `0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF` (Trader)
- `0xbeb9DF3E69e54376dCBADed74764168faB498Fdd` (Risk-LP)

---

## 5. Verify policy enforcement (key differentiator)

The trader agent deliberately produces two on-chain policy violations per market window. Look for **reverted transactions** from the Trader address on Celoscan:

**OverPolicyCap** — bet exceeds `maxStakePerWindow`:
- Function: `placeBet`
- Revert reason: `0x` + error selector for `OverPolicyCap()`

**MarketNotAllowed** — `allowedMarketsRoot` set to wrong value:
- Look for a `updatePolicy` tx immediately before a reverted `placeBet`
- Then another `updatePolicy` restoring the correct policy

To decode a revert reason:
```bash
cast call 0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0 \
  "placeBet(uint32,uint8,uint128)" \
  0 0 999999999 \
  --from 0x00C817A0858451390cC99881Cd87Df1EDd2e3cdF \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org
# Expected: revert OverPolicyCap
```

---

## 6. Verify CPMM pricing

After a market is open, check that YES/NO reserves change with each bet:
```bash
# Read market state (id=0)
cast call 0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0 \
  "getMarket(uint32)((uint64,uint64,int64,uint8,bytes32,uint128,uint128,uint8))" \
  0 \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org
```

Fields returned: `openTs, closeTs, strike, status, oracleFeed, yesReserve, noReserve, winner`

- `yesReserve` and `noReserve` will differ after bets are placed
- `strike` is the Pyth BTC/USD price at market open (scaled ×10⁻⁸)
- `winner` = 1 (YES) if final price ≥ strike, 2 (NO) otherwise

---

## 7. Run locally from scratch

```bash
git clone <repo>
cd falco

# Install all deps
pnpm install
cd app && npm install && cd ..

# Verify contracts compile + tests pass
cd contracts && forge test && cd ..

# Copy env files (fill in your own keys to run agents)
cp scheduler/.env.example scheduler/.env
cp agents/.env.example    agents/.env
cp app/.env.local.example app/.env.local   # or just use defaults

# Start everything
cd scheduler && pnpm dev &
cd agents    && pnpm dev:all &
cd app       && npm run dev
# → http://localhost:3000
```

---

## Summary checklist

| Item | Where to verify |
|---|---|
| Contract deployed | Blockscout link above |
| 21/21 tests pass | `forge test -v` |
| ERC-8004 registered | 8004scan links above |
| Live markets running | Frontend /markets |
| Agent txns on-chain | Celoscan agent addresses |
| Policy violations visible | Reverted txns on Celoscan |
| Live BTC chart | Frontend home page |
| CPMM reserves changing | `cast call getMarket` |
