import { Connections, FALCO_CORE_ADDRESS } from "./connections.js";
import { send } from "./tx.js";

export async function ensureRegistered(conns: Connections): Promise<void> {
  const { registered } = await conns.publicClient.readContract({
    address: FALCO_CORE_ADDRESS,
    abi: conns.abi,
    functionName: "getAgent",
    args: [conns.account.address],
  }) as any;

  if (!registered) {
    console.log("Registering agent on FalcoCore...");
    await send(conns, "registerAgent", []);
    console.log("Registered:", conns.account.address);
  }
}

export async function getBalance(conns: Connections): Promise<bigint> {
  const { balance } = await conns.publicClient.readContract({
    address: FALCO_CORE_ADDRESS,
    abi: conns.abi,
    functionName: "getAgent",
    args: [conns.account.address],
  }) as any;
  return BigInt(balance);
}
