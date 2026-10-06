import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, DataRow, Header, Notice, PrimaryButton, Screen, SectionTitle, SecondaryButton, formatAddress } from "@/components/wolv-ui";
import { WOLV } from "@/constants/wolv-theme";
import { useWallet } from "@/lib/wallet/WalletContext";

export default function WalletScreen() {
  const wallet = useWallet();
  const router = useRouter();
  const [error, setError] = useState("");
  const connectedToBsc = wallet.isConnected && wallet.chainId === 56;
  const run = async (action: () => Promise<void>) => { setError(""); try { await action(); } catch (e) { const message = e instanceof Error ? e.message : "Wallet action failed."; setError(message); Alert.alert("Wallet", message); } };
  return <Screen>
    <Header address={wallet.address} />
    <SectionTitle title="Wallet" detail="Non-custodial connection · BNB Smart Chain only for stock trades" />
    {error ? <Notice title="Wallet action needs attention" body={error} tone="error" /> : null}
    <Card style={{ alignItems: "center", paddingVertical: 23 }}>
      <View style={{ width: 62, height: 62, borderRadius: 31, borderColor: WOLV.amber, borderWidth: 1.5, backgroundColor: WOLV.panel2, justifyContent: "center", alignItems: "center" }}><Text style={{ fontSize: 28 }}>◈</Text></View>
      <Text style={{ color: WOLV.text, fontSize: 18, fontWeight: "900", marginTop: 13 }}>{wallet.isConnected ? "Wallet connected" : "Connect a wallet"}</Text>
      <Text style={{ color: WOLV.muted, fontSize: 11, textAlign: "center", marginTop: 6 }}>{wallet.isConnected ? formatAddress(wallet.address) : "Review quotes and sign every transaction in your own wallet."}</Text>
      <View style={{ width: "100%", marginTop: 18 }}>{wallet.isConnected ? <SecondaryButton title="Disconnect wallet" onPress={() => void run(wallet.disconnect)} /> : <PrimaryButton title="Connect Wallet" onPress={() => void run(wallet.connect)} />}</View>
    </Card>

    {wallet.isConnected && !connectedToBsc ? <Notice title="Wrong network" body={`Connected chain ID: ${wallet.chainId ?? "unknown"}. WOLV requires BNB Smart Chain (56) for tokenized-stock spot execution.`} tone="warn" action="Switch to BSC" onAction={() => void run(wallet.switchToBsc)} /> : null}
    <Card>
      <SectionTitle title="Connection details" />
      <DataRow label="Address" value={wallet.address ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}` : "Not connected"} />
      <DataRow label="Chain" value={wallet.chainId == null ? "Not connected" : `${wallet.chainId}${wallet.chainId === 56 ? " · BNB Smart Chain" : " · unsupported for stock trading"}`} valueColor={connectedToBsc ? WOLV.green : undefined} />
      <DataRow label="Connector" value={wallet.connector || "Not connected"} />
      <DataRow label="Private keys" value="Never requested or stored" last />
    </Card>
    {!wallet.projectIdConfigured ? <Notice title="WalletConnect setup required for native builds" body="Add EXPO_PUBLIC_REOWN_PROJECT_ID to the native build environment. The Vercel web build accepts an injected wallet such as MetaMask when opened in a wallet browser." tone="warn" /> : null}
    <Card>
      <SectionTitle title="How WOLV execution works" />
      {["1 · Connect a BSC wallet and choose a live tokenized-stock quote.", "2 · Inspect the route, spread, quote age, and any approval request.", "3 · Sign only the transaction or typed data you intend to authorize.", "4 · WOLV waits for an actual chain or RFQ settlement status."].map((line) => <Text key={line} style={{ color: WOLV.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 }}>{line}</Text>)}
    </Card>
    <Pressable onPress={() => router.push("/(tabs)/portfolio")}><Text style={{ color: WOLV.amber, fontSize: 11, fontWeight: "800", textAlign: "center" }}>View wallet portfolio →</Text></Pressable>
  </Screen>;
}
