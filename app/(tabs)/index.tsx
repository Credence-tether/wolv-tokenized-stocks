import React from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useWallet } from "@/lib/wallet/WalletContext";
import { useMarkets } from "@/lib/market-data";
import { WOLV } from "@/constants/wolv-theme";
import { Card, Header, HeroOrbit, MarketCard, Notice, PrimaryButton, Screen, SectionTitle, SecondaryButton } from "@/components/wolv-ui";
import { marketAddress } from "@/lib/wolv-api";

export default function HomeScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const { markets, topMarkets, isLoading, error, refetch, source } = useMarkets();
  const openMarket = (address?: string) => router.push(address ? { pathname: "/(tabs)/markets", params: { address } } : "/(tabs)/markets");
  const openTrade = (address?: string) => router.push(address ? { pathname: "/(tabs)/trade", params: { address } } : "/(tabs)/trade");

  return <Screen>
    <Header address={wallet.address} onConnect={() => wallet.connect().catch(() => router.push("/(tabs)/wallet"))} />
    <Card style={{ padding: 18, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -17, top: 6, opacity: 0.78 }}><HeroOrbit /></View>
      <Text style={{ color: WOLV.amber, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }}>TOKENIZED STOCKS.</Text>
      <Text style={{ color: WOLV.text, fontSize: 26, lineHeight: 30, fontWeight: "900", marginTop: 5 }}>ON-CHAIN{`\n`}<Text style={{ color: WOLV.amber }}>EXECUTION.</Text></Text>
      <Text style={{ color: WOLV.text, fontSize: 13, marginTop: 12 }}><Text style={{ color: WOLV.amber, fontWeight: "800" }}>Find the price.</Text> See the execution.</Text>
      <Text style={{ color: WOLV.muted, fontSize: 11, lineHeight: 16, marginTop: 7, maxWidth: 245 }}>Cross-venue tokenized-stock data and user-signed spot execution on BNB Smart Chain.</Text>
      <View style={{ flexDirection: "row", gap: 9, marginTop: 16 }}><View style={{ flex: 1 }}><PrimaryButton title="Explore markets →" onPress={() => openMarket()} compact /></View><View style={{ flex: 1 }}><SecondaryButton title="How it works" onPress={() => router.push("/(tabs)/wallet")} compact /></View></View>
      <View style={{ marginTop: 13, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: WOLV.greenSoft, borderWidth: 1, borderColor: "#155144" }}><Text style={{ color: WOLV.green, fontSize: 9, fontWeight: "800" }}>BSC MAINNET · SPOT ONLY</Text></View>
    </Card>

    <View>
      <SectionTitle title="Live markets" detail={source ? `Source: ${source}` : "Live instruments from Binance Web3 RWA API"} action="View all" onAction={() => openMarket()} />
      {error ? <Notice title="Live feed unavailable" body={error instanceof Error ? error.message : "Could not reach Binance Web3 API."} tone="error" action="Retry" onAction={() => void refetch()} /> : null}
      {isLoading ? <Card style={{ alignItems: "center", paddingVertical: 26 }}><Text style={{ color: WOLV.muted, fontSize: 12 }}>Connecting to live BSC markets…</Text></Card> : null}
      {!isLoading && !error && markets.length === 0 ? <Notice title="No live instruments returned" body="The connected RWA API has not returned any supported tokenized-stock contracts. WOLV will not substitute sample ticker prices." tone="warn" action="Refresh" onAction={() => void refetch()} /> : null}
      <View style={{ gap: 10 }}>{topMarkets.map((market) => <MarketCard key={marketAddress(market)} market={market} onPress={() => openMarket(marketAddress(market))} onAnalyze={() => router.push({ pathname: "/(tabs)/markets", params: { address: marketAddress(market), view: "analysis" } })} onTrade={() => openTrade(marketAddress(market))} />)}</View>
    </View>

    <Card style={{ paddingVertical: 14 }}>
      <SectionTitle title="Execution controls" detail="Your wallet signs every approval and spot transaction." />
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#102638" }}><Text style={{ color: WOLV.muted, fontSize: 11 }}>Wallet status</Text><Text style={{ color: wallet.isConnected ? WOLV.green : WOLV.amber, fontSize: 11, fontWeight: "800" }}>{wallet.isConnected ? "Connected" : "Not connected"}</Text></View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#102638" }}><Text style={{ color: WOLV.muted, fontSize: 11 }}>Execution chain</Text><Text style={{ color: WOLV.text, fontSize: 11, fontWeight: "700" }}>BNB Smart Chain · 56</Text></View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9 }}><Text style={{ color: WOLV.muted, fontSize: 11 }}>Product scope</Text><Text style={{ color: WOLV.green, fontSize: 11, fontWeight: "700" }}>Spot · no perps</Text></View>
    </Card>
    <Text style={{ color: WOLV.faint, fontSize: 9, lineHeight: 14, textAlign: "center", paddingHorizontal: 10 }}>Tokenized assets may not confer rights in the underlying equity. Data and route availability depend on issuer, venue, market hours, jurisdiction and liquidity. Not investment advice.</Text>
  </Screen>;
}
