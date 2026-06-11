"use client";

import { useEffect, useRef, useState } from "react";

const PREBUFFER_SECONDS = 40;
const HISTORY_WINDOW_SEC = 40;
const MAX_POINTS = 3000;
const SMOOTH_ALPHA = 0.15;
const POLL_MS = 3000;
const SMOOTH_MS = 100; // smooth interval (replaces RAF — works when tab hidden)

export interface PricePoint { time: number; value: number; }

export interface LiveBtcPrice {
  price:   number | null;
  history: PricePoint[];
}

function seedPrebuffer(price: number): PricePoint[] {
  const t0 = Date.now() / 1000;
  return Array.from({ length: PREBUFFER_SECONDS + 1 }, (_, i) => ({
    time:  t0 - (PREBUFFER_SECONDS - i),
    value: price,
  }));
}

function trim(arr: PricePoint[]) {
  const newest = arr[arr.length - 1].time;
  while (arr.length > 2 && newest - arr[0].time > HISTORY_WINDOW_SEC) arr.shift();
  while (arr.length > MAX_POINTS) arr.shift();
}

export function useLiveBtcPrice(): LiveBtcPrice {
  const [state, setState] = useState<LiveBtcPrice>({ price: null, history: [] });
  const historyRef = useRef<PricePoint[]>([]);
  const model = useRef({ target: null as number | null, smoothed: null as number | null });

  useEffect(() => {
    let cancelled = false;

    const smoothId = setInterval(() => {
      if (cancelled) return;
      const m = model.current;
      const arr = historyRef.current;
      if (m.smoothed == null || m.target == null || arr.length === 0) return;

      m.smoothed += (m.target - m.smoothed) * SMOOTH_ALPHA;
      const last = arr[arr.length - 1];
      let t = Date.now() / 1000;
      if (t <= last.time) t = last.time + 1e-4;
      arr.push({ time: t, value: m.smoothed });
      trim(arr);
      setState({ price: m.smoothed, history: arr.slice() });
    }, SMOOTH_MS);

    const setTarget = (price: number) => {
      const m = model.current;
      m.target = price;
      if (m.smoothed == null) {
        m.smoothed = price;
        historyRef.current = seedPrebuffer(price);
        setState({ price, history: historyRef.current.slice() });
      }
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch("/api/btc-price");
        const d = await r.json() as { price: number | null };
        if (d.price != null && Number.isFinite(d.price)) setTarget(d.price);
      } catch {}
    };

    poll();
    const pollId = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(smoothId);
      clearInterval(pollId);
    };
  }, []);

  return state;
}
