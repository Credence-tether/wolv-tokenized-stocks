import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Card, Header, Notice, Screen, SectionTitle, formatAddress, formatNumber, formatUsd, timeAgo } from "@/components/wolv-ui";
import { WOLV } from "@/constants/wolv-theme";
import { wolvApi } from "@/lib/wolv-api";
import { useWallet } from "@/lib/wallet/WalletContext";

function tradeSide(item: any) {
  if (String(item?.type) === "1") return "BUY";
  if (String(item?.type) === "2") return "SELL";
  return "TRADE";
}

export default function PortfolioScreen() {
  const wallet = useWallet();
  const router = useRouter();
  const query = useQuery({ queryKey: ["wolv", "portfolio", wallet.address], queryFn: () => wolvApi.portfolio(wallet.address!), enabled: Boolean(wallet.address && wallet.chainId === 56), refetchInterval: 30000, staleTime: 20000 });
  const holdings = query.data?.holdings ?? [];
  const history = query.data?.history ?? [];
  const unpricedCount = holdings.filter((item: any) => item.tokenBalanceUsd == null).length;

  return <Screen>
    <Header address={wallet.address} onConnect={() => wallet.connect().catch(() => router.push("/(tabs)/wallet"))} />
    <SectionTitle title="Portfolio" detail={wallet.address ? `Address ${formatAddress(wallet.address)} · BSC` : "Wallet-linked tokenized-stock positions and history"} />
    {!wallet.isConnected ? <Notice title="Connect your wallet" body="Balances are read from token contracts for your connected BSC address. No sample positions or prices are shown." tone="info" action="Connect wallet" onAction={() => router.push("/(tabs)/wallet")} /> : null}
    {wallet.isConnected && wallet.chainId !== 56 ? <Notice title="Switch to BNB Smart Chain" body={`Current chain ID: ${wallet.chainId ?? "unknown"}. Portfolio reads are fixed to BSC chain 56.`} tone="warn" action="Switch network" onAction={() => void wallet.switchToBsc().catch(() => {})} /> : null}
    {wallet.isConnected && wallet.chainId === 56 && query.isLoading ? <Card style={{ alignItems: "center", padding: 26 }}><ActivityIndicator color={WOLV.amber} /><Text style={{ color: WOLV.muted, fontSize: 11, marginTop: 8 }}>Reading BSC token balances and trade history…</Text></Card> : null}
    {wallet.address && query.error ? <Notice title="Portfolio data unavailable" body={query.error instanceof Error ? query.error.message : "Could not load the wallet's BSC portfolio."} tone="error" action="Retry" onAction={() => void query.refetch()} /> : null}

    {wallet.isConnected && wallet.chainId === 56 && !query.isLoading && !query.error ? <>
      <Card style={{ backgroundColor: WOLV.panel2 }}>
        <Text style={{ color: WOLV.muted, fontSize: 10 }}>Tokenized-stock value · live token prices</Text>
        <Text style={{ color: WOLV.text, fontSize: 26, fontWeight: "900", marginTop: 5 }}>{formatUsd(query.data?.totalValueUsd ?? 0)}</Text>
        <Text style={{ color: WOLV.faint, fontSize: 9, lineHeight: 14, marginTop: 5 }}>{query.data?.source || "BSC token balances + Binance Web3 DEX history"} · {query.data?.receivedAt ? timeAgo(query.data.receivedAt) : "Timestamp unavailable"}</Text>
      </Card>
      {unpricedCount > 0 ? <Notice title="Some balances lack a current valuation" body={`${unpricedCount} token balance(s) are shown without an invented USD value because the live RWA price API did not return a price.`} tone="warn" /> : null}

      <View>
        <SectionTitle title="Holdings" detail="Live balances for supported bStocks/Ondo stock-token contracts on BSC; other wallet assets are outside this view." />
        {holdings.length === 0 ? <Notice title="No listed stock-token balances found" body="The connected address has no positive balance among the token contracts returned by the current BSC RWA listing. Other wallet assets are not shown here." tone="info" /> : holdings.map((item: any, idx: number) => <Card key={`${item.tokenContractAddress || item.tokenSymbol || idx}`} style={{ marginBottom: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: WOLV.panel3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: WOLV.border }}><Text style={{ color: WOLV.amber, fontWeight: "900", fontSize: 10 }}>{String(item.underlyingTicker || item.tokenSymbol || "RWA").slice(0, 4)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: WOLV.text, fontWeight: "800", fontSize: 12 }}>{item.underlyingTicker || item.tokenSymbol || "Tokenized asset"}</Text>
              <Text style={{ color: WOLV.muted, fontSize: 9, marginTop: 2 }}>{item.platformId === "bstock" ? "bStocks" : item.platformId === "ondo" ? "Ondo" : item.platformId || "Tokenized stock"} · {formatNumber(item.tokenBalanceAmount, 6)} tokens</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: WOLV.text, fontWeight: "800", fontSize: 12 }}>{item.tokenBalanceUsd == null ? "—" : formatUsd(item.tokenBalanceUsd)}</Text>
              <Text style={{ color: WOLV.muted, fontSize: 9, marginTop: 3 }}>{item.tokenPrice == null ? "Price unavailable" : `${formatUsd(item.tokenPrice)} / token`}</Text>
            </View>
          </View>
        </Card>)}
      </View>

      <View>
        <SectionTitle title="Recent history" detail="Wallet-specific DEX trades returned by Binance Web3 · newest first" />
        {history.length === 0 ? <Notice title="No indexed DEX trades returned" body="The address-history endpoint returned no BSC DEX trades for this wallet." tone="info" /> : history.slice(0, 15).map((item: any, idx: number) => <Card key={String(item.txHash ?? idx)} style={{ marginBottom: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: WOLV.text, fontSize: 11, fontWeight: "800" }}>{tradeSide(item)} · {item.tokenSymbol || "DEX trade"}</Text>
              <Text style={{ color: WOLV.muted, fontSize: 9, marginTop: 3 }}>{formatNumber(item.amount, 6)} tokens · {formatUsd(item.valueUsd)}{item.price == null ? "" : ` · ${formatUsd(item.price)} / token`}</Text>
              <Text style={{ color: WOLV.faint, fontSize: 8, marginTop: 3 }}>{item.txHash ? `${String(item.txHash).slice(0, 10)}…${String(item.txHash).slice(-8)}` : "Transaction hash unavailable"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: tradeSide(item) === "BUY" ? WOLV.green : WOLV.amber, fontSize: 10, fontWeight: "800" }}>{tradeSide(item)}</Text>
              <Text style={{ color: WOLV.faint, fontSize: 9, marginTop: 3 }}>{item.time || item.timestamp ? timeAgo(item.time || item.timestamp) : "Date unavailable"}</Text>
            </View>
          </View>
        </Card>)}
      </View>
    </> : null}

    <Text style={{ color: WOLV.faint, fontSize: 9, lineHeight: 14, textAlign: "center" }}>Portfolio valuation uses upstream token prices and may be delayed. This view only covers supported listed stock-token contracts on BSC, not the complete wallet. Tokenized assets may not confer rights in the underlying securities.</Text>
  </Screen>;
}
