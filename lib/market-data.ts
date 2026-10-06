import { useQuery } from "@tanstack/react-query";
import { isSupportedStockPlatform, marketChange, marketPlatform, marketSymbol, type WolvMarket, wolvApi } from "@/lib/wolv-api";

export function useMarkets() {
  const query = useQuery({ queryKey: ["wolv", "markets"], queryFn: wolvApi.markets, refetchInterval: 15000, staleTime: 10000 });
  const markets = Array.isArray(query.data?.data) ? query.data.data : [];
  const visible = markets.filter((market: WolvMarket) => Boolean(marketSymbol(market) && (market.tokenContractAddress || market.contractAddress || market.address) && isSupportedStockPlatform(marketPlatform(market))));
  const top = [...visible].sort((a, b) => (marketChange(b) ?? -Infinity) - (marketChange(a) ?? -Infinity)).slice(0, 4);
  return { ...query, markets: visible, topMarkets: top, source: query.data?.source, receivedAt: query.data?.receivedAt };
}

export function marketTimestamp(market: WolvMarket): string | number | null {
  const value = market.tokenPriceUpdatedAt ?? market.quoteTimestamp ?? market.quoteReceivedAt ?? market.updatedAt ?? market.lastUpdatedAt ?? market.timestamp ?? null;
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export function spreadPercent(price: number | null, reference: number | null) {
  if (price == null || reference == null || reference === 0) return null;
  return ((price - reference) / reference) * 100;
}
