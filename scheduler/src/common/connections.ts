import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const FalcoCoreAbi: any[] = require("../abi/FalcoCore.json");

// viem's celoAlfajores has wrong chain ID 44787; actual Celo Sepolia is 11142220
const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org"] } },
});

export const FALCO_CORE_ADDRESS =
  (process.env.FALCO_CORE_ADDRESS as `0x${string}`) ??
  "0x2c0B06D5126405F79D222CaBa7303B43C4ECD5D0";

export const PYTH_BTC_USD_FEED =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as `0x${string}`;

const RPC_URL = process.env.CELO_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org";

export type Role = "market_ops" | "trader" | "risk_lp";

const ROLE_KEY_ENV: Record<Role, string> = {
  market_ops: "MARKET_OPS_PRIVATE_KEY",
  trader:     "TRADER_PRIVATE_KEY",
  risk_lp:    "RISK_LP_PRIVATE_KEY",
};

function loadAccount(role: Role) {
  const pk = process.env[ROLE_KEY_ENV[role]] ?? process.env.PRIVATE_KEY;
  if (!pk) throw new Error(`No private key for role ${role} (set ${ROLE_KEY_ENV[role]} or PRIVATE_KEY)`);
  return privateKeyToAccount(pk as `0x${string}`);
}

export function buildConnections(role: Role) {
  const account = loadAccount(role);

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport: http(RPC_URL),
  });

  return { account, publicClient, walletClient, abi: FalcoCoreAbi };
}

export type Connections = ReturnType<typeof buildConnections>;
