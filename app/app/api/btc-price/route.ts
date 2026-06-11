const FEED = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

export async function GET() {
  try {
    const res  = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${FEED}`, { next: { revalidate: 0 } });
    const data = await res.json() as any;
    const item = data.parsed?.[0]?.price;
    if (!item) return Response.json({ price: null });
    const price = Number(item.price) * Math.pow(10, Number(item.expo));
    return Response.json({ price });
  } catch {
    return Response.json({ price: null });
  }
}
