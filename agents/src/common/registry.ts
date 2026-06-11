import { Connections, FALCO_CORE_ADDRESS } from "./connections.js";
import { send } from "./tx.js";

export async function ensureRegistered(conns: Connections): Promise<void> {
  const result = await conns.publicClient.readContract({
    address: FALCO_CORE_ADDRESS,
    abi: conns.abi,
    functionName: "getAgent",
    args: [conns.account.address],
  }) as [bigint, any, boolean];

  if (!result[2]) {
    console.log("Registering agent on FalcoCore...");
    await send(conns, "registerAgent", []);
    console.log("Registered:", conns.account.address);
  }
}

export async function getBalance(conns: Connections): Promise<bigint> {
  const result = await conns.publicClient.readContract({
    address: FALCO_CORE_ADDRESS,
    abi: conns.abi,
    functionName: "getAgent",
    args: [conns.account.address],
  }) as [bigint, any, boolean];
  return BigInt(result[0]);
}
