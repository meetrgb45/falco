"use client";
import { useEffect, useState } from "react";

export function MarketCountdown({ closeTs }: { closeTs: number | null }) {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    if (!closeTs) return;
    const tick = () => setSecs(Math.max(0, closeTs - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closeTs]);

  if (!closeTs || secs === null) return null;

  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");

  return (
    <span className="font-mono text-sm tabular-nums text-muted-foreground">
      {m}:{s}
    </span>
  );
}
