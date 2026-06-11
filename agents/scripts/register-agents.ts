/**
 * register-agents.ts
 * Run: cd agents && npx tsx scripts/register-agents.ts
 */
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://forno.celo-sepolia.celo-testnet.org";

// viem's celoAlfajores has wrong ID 44787; actual Celo Sepolia is 11142220
export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`;

const ABI = [
  { name: "register",           type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { name: "balanceOf",          type: "function", stateMutability: "view",       inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "tokenOfOwnerByIndex",type: "function", stateMutability: "view",       inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

const AGENTS = [
  { role: "market_ops", pk: "0x86d2fd1d26ae2fe1aae71057ee66197c0d68be5bee1882117307d8f936dca56a" as `0x${string}`, name: "Falco MarketOps", desc: "Oracle watchdog — halts/resumes markets on Pyth staleness." },
  { role: "trader",     pk: "0xffadd0aa94c3513da65ef607deee74c8ae16865bd866ff23a05e55d0bb3a98e4" as `0x${string}`, name: "Falco Trader",    desc: "Momentum agent — bets YES/NO on BTC/USD windows with on-chain policy enforcement." },
  { role: "risk_lp",   pk: "0x6c910983346c56a218d94bbb7413b75be7e2293d2bd76b01a9ffe880cd0d0e43" as `0x${string}`, name: "Falco Risk-LP",  desc: "AMM hedger — balances YES/NO reserves, cancels near close." },
];

const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });

async function register(agent: typeof AGENTS[0]) {
  const account = privateKeyToAccount(agent.pk);
  const wallet  = createWalletClient({ account, chain: celoSepolia, transport: http(RPC) });

  const bal = await pub.readContract({ address: IDENTITY_REGISTRY, abi: ABI, functionName: "balanceOf", args: [account.address] });
  if (bal > 0n) {
    const id = await pub.readContract({ address: IDENTITY_REGISTRY, abi: ABI, functionName: "tokenOfOwnerByIndex", args: [account.address, 0n] }).catch(() => "?");
    console.log(`[${agent.role}] already registered agentId=${id} — https://testnet.8004scan.io/agent/${account.address}`);
    return;
  }

  const meta = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: agent.name,
    description: agent.desc,
    services: [{ name: "web", endpoint: "https://falco-celo.vercel.app" }],
    attributes: [{ trait_type: "role", value: agent.role }, { trait_type: "project", value: "falco-celo" }],
  };
  const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(meta)).toString("base64")}`;

  console.log(`[${agent.role}] registering ${account.address}...`);
  const hash = await wallet.writeContract({ address: IDENTITY_REGISTRY, abi: ABI, functionName: "register", args: [uri] });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`[${agent.role}] ✅ tx=${hash}`);
  console.log(`[${agent.role}]    https://testnet.8004scan.io/agent/${account.address}`);
}

async function main() {
  for (const agent of AGENTS) { await register(agent); console.log(); }
  console.log("Done.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
