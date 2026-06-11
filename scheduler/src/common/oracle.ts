import { PYTH_BTC_USD_FEED } from "./connections.js";

const PYTH_API = "https://hermes.pyth.network/v2/updates/price/latest";

export interface OracleSnapshot {
  price:   number;   // USD, human readable
  rawPrice: bigint;  // Pyth int64 (×10^expo)
  expo:    number;
  ageSecs: number;
  feedId:  string;
}

export async function readOracleSnapshot(): Promise<OracleSnapshot | null> {
  try {
    const url = `${PYTH_API}?ids[]=${PYTH_BTC_USD_FEED}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as any;
    const item = data.parsed?.[0];
    if (!item) return null;

    const rawPrice = BigInt(item.price.price);
    const expo     = Number(item.price.expo);
    const publishTime = Number(item.price.publish_time);
    const ageSecs  = Math.floor(Date.now() / 1000) - publishTime;
    const price    = Number(rawPrice) * Math.pow(10, expo);

    return { price, rawPrice, expo, ageSecs, feedId: PYTH_BTC_USD_FEED };
  } catch {
    return null;
  }
}
