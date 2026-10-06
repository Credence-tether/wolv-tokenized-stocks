import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Card, DataRow, Header, MarketCard, MarketGlyph, Notice, PrimaryButton, Screen, SectionTitle, formatUsd, timeAgo } from "@/components/wolv-ui";
import { WOLV } from "@/constants/wolv-theme";
import { useMarkets, marketTimestamp, spreadPercent } from "@/lib/market-data";
import { marketAddress, marketName, marketPlatform, marketPrice, marketReferencePrice, marketSymbol, wolvApi } from "@/lib/wolv-api";
import { useWallet } from "@/lib/wallet/WalletContext";

function candlesFrom(payload: any): any[] {
  const raw = payload?.data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.list)) return raw.list;
  if (Array.isArray(raw?.candles)) return raw.candles;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}
function closeOf(candle: any): number | null {
  const raw = Array.isArray(candle) ? candle[4] : candle?.close ?? candle?.c ?? candle?.closePrice ?? candle?.price;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const CHART_PERIODS = {
  "1H": { bar: "1m", limit: 60 },
  "1D": { bar: "15m", limit: 96 },
  "1W": { bar: "4h", limit: 42 },
  "1M": { bar: "1d", limit: 30 },
  "1Y": { bar: "1w", limit: 52 },
  ALL: { bar: "1M", limit: 60 },
} as const;
type ChartPeriod = keyof typeof CHART_PERIODS;

function LiveChart({ address }: { address: string }) {
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const interval = CHART_PERIODS[period];
  const query = useQuery({ queryKey: ["wolv", "candles", address, period], queryFn: () => wolvApi.candles(address, interval.bar, interval.limit), enabled: Boolean(address), staleTime: 60000 });
  const closes = candlesFrom(query.data).map(closeOf).filter((n): n is number => n != null);
  const periodControls = <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 5, marginBottom: 8 }}>{(Object.keys(CHART_PERIODS) as ChartPeriod[]).map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: period === item ? WOLV.amber : WOLV.border, backgroundColor: period === item ? WOLV.amberSoft : "transparent" }}><Text style={{ color: period === item ? WOLV.amber : WOLV.muted, fontSize: 9, fontWeight: "800" }}>{item}</Text></Pressable>)}</View>;
  if (query.isLoading) return <View>{periodControls}<View style={{ height: 130, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={WOLV.amber} /><Text style={{ color: WOLV.muted, fontSize: 10, marginTop: 9 }}>Loading live candles…</Text></View></View>;
  if (query.error || closes.length < 2) return <View>{periodControls}<View style={{ height: 125, justifyContent: "center", alignItems: "center", padding: 14 }}><Text style={{ color: WOLV.muted, fontSize: 11, textAlign: "center" }}>{query.error instanceof Error ? query.error.message : "No candle series was returned for this token and interval."}</Text></View></View>;
  const min = Math.min(...closes); const max = Math.max(...closes); const span = max - min || 1;
  const points = closes.map((value, index) => `${12 + (index / (closes.length - 1)) * 276},${118 - ((value - min) / span) * 98}`);
  const positive = closes[closes.length - 1] >= closes[0];
  return <View>
    {periodControls}
    <Svg width="100%" height={150} viewBox="0 0 300 132" preserveAspectRatio="none"><Path d={`M ${points.join(" L ")}`} fill="none" stroke={positive ? WOLV.amber : WOLV.red} strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" /></Svg>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: WOLV.faint, fontSize: 9 }}>Live Binance candle data · {period} · latest {closes.length} bars</Text><Text style={{ color: WOLV.muted, fontSize: 9 }}>{query.data?.receivedAt ? timeAgo(query.data.receivedAt) : "Updated on request"}</Text></View>
    {period === "ALL" ? <Text style={{ color: WOLV.faint, fontSize: 8, marginTop: 5 }}>ALL uses the latest monthly bars returned by the API; this endpoint may not provide the asset’s complete history.</Text> : null}
  </View>;
}

export default function MarketsScreen() {
  const params = useLocalSearchParams<{ symbol?: string; address?: string; view?: string }>();
  const router = useRouter();
  const wallet = useWallet();
  const { markets, isLoading, error, refetch, source, receivedAt } = useMarkets();
  const [search, setSearch] = useState("");
  const selected = useMemo(() => {
    const address = String(params.address || "").toLowerCase();
    if (address) return markets.find((market) => marketAddress(market).toLowerCase() === address);
    return params.symbol ? markets.find((market) => marketSymbol(market) === String(params.symbol).toUpperCase()) : undefined;
  }, [markets, params.address, params.symbol]);
  const filtered = markets.filter((m) => `${marketSymbol(m)} ${marketName(m)} ${marketPlatform(m)}`.toLowerCase().includes(search.toLowerCase()));
  const current = selected;
  const price = current ? marketPrice(current) : null;
  const reference = current ? marketReferencePrice(current) : null;
  const spread = spreadPercent(price, reference);
  const marketStatus = String(current?.statusInfo?.marketStatus ?? current?.marketStatus ?? current?.sessionStatus ?? current?.tradingStatus ?? "Not supplied by API");
  const view = String(params.view || "overview");
  const goView = (next: string) => router.replace({ pathname: "/(tabs)/markets", params: { address: marketAddress(current!), view: next } });
  const toTrade = () => router.push({ pathname: "/(tabs)/trade", params: { address: marketAddress(current!) } });

  return <Screen>
    <Header address={wallet.address} onConnect={() => wallet.connect().catch(() => router.push("/(tabs)/wallet"))} />
    <SectionTitle title={current ? `${marketSymbol(current)} · ${marketName(current)}` : "Tokenized markets"} detail={current ? `${marketPlatform(current)} · BSC Mainnet` : source || "Binance Web3 RWA API · BSC mainnet"} action={current ? "Back to markets" : undefined} onAction={() => router.replace("/(tabs)/markets")} />

    {error ? <Notice title="Live market API unavailable" body={error instanceof Error ? error.message : "Unable to load the current RWA token listing."} tone="error" action="Retry" onAction={() => void refetch()} /> : null}
    {!current ? <>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search symbol, issuer or platform" placeholderTextColor={WOLV.faint} style={{ backgroundColor: WOLV.panel, color: WOLV.text, borderWidth: 1, borderColor: WOLV.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 12 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: WOLV.muted, fontSize: 10 }}>{isLoading ? "Connecting to Binance…" : `${filtered.length} live instruments`}</Text><Text style={{ color: WOLV.faint, fontSize: 9 }}>{receivedAt ? `Updated ${timeAgo(receivedAt)}` : "Live feed"}</Text></View>
      {isLoading ? <View style={{ padding: 30, alignItems: "center" }}><ActivityIndicator color={WOLV.amber} /></View> : null}
      {!isLoading && !error && filtered.length === 0 ? <Notice title="No live market data" body="No matching supported token was returned by the API. WOLV does not display hard-coded ticker prices." tone="warn" /> : null}
      <View style={{ gap: 10 }}>{filtered.map((market) => <MarketCard key={marketAddress(market)} market={market} onPress={() => router.push({ pathname: "/(tabs)/markets", params: { address: marketAddress(market) } })} onAnalyze={() => router.push({ pathname: "/(tabs)/markets", params: { address: marketAddress(market), view: "analysis" } })} onTrade={() => router.push({ pathname: "/(tabs)/trade", params: { address: marketAddress(market) } })} />)}</View>
      <Notice title="Spot-only execution" body="WOLV routes tokenized-equity spot orders on BNB Smart Chain. Perpetuals, leverage, and short selling are not available." tone="info" />
    </> : <>
      <Card style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><MarketGlyph market={current} size={44} /><View style={{ flex: 1 }}><Text style={{ color: WOLV.text, fontSize: 18, fontWeight: "900" }}>{marketSymbol(current)}</Text><Text style={{ color: WOLV.muted, fontSize: 10 }}>{marketName(current)} · {marketPlatform(current)}</Text></View><View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#1D594D", backgroundColor: WOLV.greenSoft }}><Text style={{ color: WOLV.green, fontSize: 9, fontWeight: "800" }}>BSC · SPOT</Text></View></View>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 17 }}><Text style={{ color: WOLV.text, fontSize: 27, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{price == null ? "—" : formatUsd(price)}</Text><Text style={{ color: WOLV.muted, fontSize: 9 }}>Quote age: {timeAgo(marketTimestamp(current))}</Text></View>
        <Text style={{ color: WOLV.muted, fontSize: 9, marginTop: 2 }}>Tokenized-stock market price · not the underlying equity price</Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{["overview", "chart", "venues", "analysis"].map((tab) => <Pressable key={tab} onPress={() => goView(tab)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: view === tab ? WOLV.amber : WOLV.border, backgroundColor: view === tab ? WOLV.amberSoft : WOLV.panel }}><Text style={{ color: view === tab ? WOLV.amber : WOLV.muted, fontSize: 10, fontWeight: "800", textTransform: "capitalize" }}>{tab === "analysis" ? "AI analysis" : tab}</Text></Pressable>)}</View>

      {view === "overview" ? <Card>
        <SectionTitle title="Reference vs token price" detail="The executable route and final price are returned separately by the live trade quote API." />
        <DataRow label="Reference price (underlying)" value={reference == null ? "Not supplied" : formatUsd(reference)} />
        <DataRow label="Token price (on-chain)" value={price == null ? "Not supplied" : formatUsd(price)} />
        <DataRow label="Price difference" value={spread == null ? "Not available" : `${spread >= 0 ? "+" : ""}${spread.toFixed(3)}%`} valueColor={spread == null ? undefined : Math.abs(spread) < 0.5 ? WOLV.green : WOLV.amber} />
        <DataRow label="Market/session status" value={current.statusInfo?.openState === true ? `${marketStatus} · Open` : current.statusInfo?.openState === false ? `${marketStatus} · Closed` : marketStatus} />
        <DataRow label="Quote freshness" value={timeAgo(marketTimestamp(current))} />
        <DataRow label="Data source" value="Binance Web3 RWA API" />
        <DataRow label="Token contract" value={marketAddress(current) ? `${marketAddress(current).slice(0, 10)}…${marketAddress(current).slice(-8)}` : "Unavailable"} last />
      </Card> : null}

      {view === "chart" ? <Card><SectionTitle title="Live token chart" detail="Candles returned by Binance Web3 Market API; no synthetic series." /><LiveChart address={marketAddress(current)} /></Card> : null}

      {view === "venues" ? <Card><SectionTitle title="Issuer & venue context" detail="Venue data is shown only when returned by the listing." /><DataRow label="Issuance platform" value={marketPlatform(current)} /><DataRow label="Token/share ratio" value={current.tokenToShareRatio == null ? "Not supplied" : `1 token ≈ ${current.tokenToShareRatio} underlying shares`} /><DataRow label="Market status" value={marketStatus} /><DataRow label="Status reason" value={current.statusInfo?.reasonMsg ?? current.statusInfo?.reasonCode ?? "Not supplied"} /><DataRow label="Contract" value={marketAddress(current) || "Not supplied"} /><DataRow label="BSC chain" value="56 · BNB Smart Chain" /><DataRow label="24h change" value={current.priceChange24h == null && current.priceChangePercent24h == null && current.change24h == null ? "Not supplied" : `${Number(current.priceChange24h ?? current.priceChangePercent24h ?? current.change24h).toFixed(3)}%`} last /></Card> : null}

      {view === "analysis" ? <Card>
        <SectionTitle title="WOLV AI market read" detail="Explainable signal rules using live fields only · not investment advice" />
        <View style={{ padding: 12, borderRadius: 13, backgroundColor: WOLV.panel2, borderWidth: 1, borderColor: WOLV.border, marginBottom: 12 }}><Text style={{ color: WOLV.amber, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>LIVE DATA CHECK</Text><Text style={{ color: WOLV.text, fontSize: 13, fontWeight: "800", marginTop: 7 }}>{spread == null ? "Reference comparison unavailable" : Math.abs(spread) <= 0.25 ? "Token and reference prices are closely aligned" : "Token price differs from underlying reference"}</Text><Text style={{ color: WOLV.muted, fontSize: 10, lineHeight: 15, marginTop: 6 }}>{spread == null ? "The current API record does not contain both price fields required for this comparison." : `Observed signed price difference: ${spread >= 0 ? "+" : ""}${spread.toFixed(3)}%. This is a price comparison, not a forecast.`}</Text></View>
        <DataRow label="Quote freshness" value={timeAgo(marketTimestamp(current))} />
        <DataRow label="Reference price" value={reference == null ? "Not supplied" : formatUsd(reference)} />
        <DataRow label="Token price" value={price == null ? "Not supplied" : formatUsd(price)} />
        <DataRow label="Market/issuer" value={marketPlatform(current)} last />
        <Text style={{ color: WOLV.faint, fontSize: 9, lineHeight: 14, marginTop: 12 }}>This market read uses transparent thresholds and upstream fields. It is not a generative model, recommendation, or guarantee of liquidity.</Text>
      </Card> : null}

      <Card style={{ padding: 12 }}><Text style={{ color: WOLV.muted, fontSize: 10, lineHeight: 15 }}>Tokenized assets are issued by third parties and may not represent ownership, voting, dividends, or rights in the underlying company. Verify issuer disclosures and local availability.</Text></Card>
      <PrimaryButton title={`Trade ${marketSymbol(current)} spot →`} onPress={toTrade} />
    </>}
  </Screen>;
}
