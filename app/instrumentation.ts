// instrumentation.ts — Falco EVM event indexer
// Runs inside Next.js server process. Polls FalcoCore contract logs and writes
// decoded events to Supabase. Enabled when FALCO_INDEXER_ENABLED=true.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.FALCO_INDEXER_ENABLED !== "true") return;

  const { startIndexer } = await import("./lib/indexer/worker");
  startIndexer();
}
