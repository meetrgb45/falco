import { Connections, FALCO_CORE_ADDRESS } from "./connections.js";

export async function send(
  conns: Connections,
  functionName: string,
  args: unknown[],
): Promise<`0x${string}`> {
  const hash = await conns.walletClient.writeContract({
    address: FALCO_CORE_ADDRESS,
    abi: conns.abi,
    functionName,
    args,
  });
  await conns.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
