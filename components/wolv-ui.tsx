import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { WOLV } from "@/constants/wolv-theme";
import { marketAddress, marketChange, marketName, marketPlatform, marketPrice, marketReferencePrice, marketSymbol, type WolvMarket } from "@/lib/wolv-api";

export function WMark({ size = 34 }: { size?: number }) {
  return <View style={[styles.wMark, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.wMarkText, { fontSize: size * 0.54 }]}>W</Text></View>;
}

export function Header({ onConnect, address }: { onConnect?: () => void; address?: string | null }) {
  return <View style={styles.header}>
    <View style={styles.brand}><WMark /><Text style={styles.wordmark}>WOLV</Text></View>
    <View style={styles.headerRight}><View style={styles.chainBadge}><View style={styles.chainDot} /><Text style={styles.chainText}>BNB Chain</Text></View>
      {onConnect ? <Pressable onPress={onConnect} style={styles.connectChip}><Text style={styles.connectText}>{address ? `${address.slice(0, 5)}…${address.slice(-4)}` : "Connect Wallet"}</Text></Pressable> : null}
    </View>
  </View>;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.screenContent, style]} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{title}</Text>{detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}</View>{action ? <Pressable onPress={onAction}><Text style={styles.link}>{action} →</Text></Pressable> : null}</View>;
}

export function PrimaryButton({ title, onPress, disabled, busy, compact }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; compact?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [styles.primaryButton, compact && styles.buttonCompact, (disabled || busy) && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}>
    {busy ? <ActivityIndicator color={WOLV.bg} size="small" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
  </Pressable>;
}

export function SecondaryButton({ title, onPress, disabled, compact }: { title: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryButton, compact && styles.buttonCompact, disabled && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>{title}</Text></Pressable>;
}

export function Notice({ title, body, tone = "info", action, onAction }: { title: string; body: string; tone?: "info" | "warn" | "error" | "success"; action?: string; onAction?: () => void }) {
  const color = tone === "error" ? WOLV.red : tone === "success" ? WOLV.green : tone === "warn" ? WOLV.amber : WOLV.blue;
  return <View style={[styles.notice, { borderColor: `${color}66`, backgroundColor: `${color}0B` }]}>
    <View style={[styles.noticeDot, { backgroundColor: color }]} />
    <View style={{ flex: 1 }}><Text style={[styles.noticeTitle, { color }]}>{title}</Text><Text style={styles.noticeBody}>{body}</Text>{action && onAction ? <Pressable onPress={onAction} style={{ marginTop: 10 }}><Text style={[styles.link, { color }]}>{action} →</Text></Pressable> : null}</View>
  </View>;
}

export function DataRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return <View style={[styles.dataRow, !last && styles.dataRowDivider]}><Text style={styles.dataLabel}>{label}</Text><Text style={[styles.dataValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>{value}</Text></View>;
}

export function MarketGlyph({ market, size = 38 }: { market: WolvMarket; size?: number }) {
  const logo = String(market.tokenLogoUrl ?? market.logoUrl ?? market.logoURI ?? market.tokenLogo ?? "");
  const symbol = marketSymbol(market);
  return <View style={[styles.marketGlyph, { width: size, height: size, borderRadius: size / 2 }]}>
    {logo.startsWith("https://") ? <Image source={{ uri: logo }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <Text style={[styles.glyphText, { fontSize: Math.max(11, size * 0.34) }]}>{symbol.slice(0, 2)}</Text>}
  </View>;
}

export function MarketCard({ market, onPress, onTrade, onAnalyze }: { market: WolvMarket; onPress?: () => void; onTrade?: () => void; onAnalyze?: () => void }) {
  const price = marketPrice(market);
  const ref = marketReferencePrice(market);
  const change = marketChange(market);
  const spread = price != null && ref != null && ref !== 0 ? ((price - ref) / ref) * 100 : null;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.marketCard, pressed && { borderColor: WOLV.amber }]}>
    <View style={styles.marketTop}><MarketGlyph market={market} /><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.marketSymbol}>{marketSymbol(market)}</Text><Text style={styles.marketName} numberOfLines={1}>{marketName(market)}</Text></View>{change != null ? <Text style={[styles.marketChange, { color: change >= 0 ? WOLV.green : WOLV.red }]}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</Text> : <Text style={styles.marketChangeMuted}>—</Text>}</View>
    <View style={styles.marketPriceRow}><Text style={styles.marketPrice}>{price == null ? "—" : formatUsd(price)}</Text><Text style={styles.marketSpread}>{spread == null ? "Spread —" : `Spread ${Math.abs(spread).toFixed(3)}%`}</Text></View>
    <View style={styles.marketMeta}><Text style={styles.marketPlatform}>{marketPlatform(market)}</Text><Text style={styles.marketChain}>BSC · {marketAddress(market) ? `${marketAddress(market).slice(0, 6)}…${marketAddress(market).slice(-4)}` : "address unavailable"}</Text></View>
    {(onAnalyze || onTrade) ? <View style={styles.marketActions}>{onAnalyze ? <Pressable onPress={(event) => { event.stopPropagation(); onAnalyze(); }} style={styles.marketAction}><Text style={styles.marketActionText}>Analyse</Text></Pressable> : null}{onTrade ? <Pressable onPress={(event) => { event.stopPropagation(); onTrade(); }} style={[styles.marketAction, styles.marketTrade]}><Text style={styles.marketTradeText}>Trade →</Text></Pressable> : null}</View> : null}
  </Pressable>;
}

export function HeroOrbit() {
  return <View style={styles.orbit}>
    <Svg width="100%" height="100%" viewBox="0 0 280 190" style={StyleSheet.absoluteFill}>
      <Path d="M18 106 C70 18 190 14 260 95 C206 170 77 183 18 106Z" stroke="#B79418" strokeWidth="1" opacity="0.44" fill="none" />
      <Path d="M42 147 C95 42 197 28 248 70 C209 150 108 174 42 147Z" stroke="#D7A900" strokeWidth="1" opacity="0.38" fill="none" />
      <Path d="M36 72 C102 140 182 149 252 113" stroke="#5C6D83" strokeWidth="1" opacity="0.35" fill="none" />
      <Circle cx="70" cy="59" r="5" fill={WOLV.amber} /><Circle cx="214" cy="50" r="5" fill={WOLV.green} /><Circle cx="235" cy="135" r="4" fill={WOLV.amber} /><Circle cx="110" cy="160" r="3" fill="#5DB8FF" />
      <Circle cx="147" cy="98" r="42" fill="#0C1C2B" stroke="#34506B" strokeWidth="1" opacity="0.86" /><Circle cx="147" cy="98" r="25" fill="#0B1825" stroke="#947618" strokeWidth="1" />
      <Path d="M134 86 L140 108 L147 91 L154 108 L161 86" stroke={WOLV.amber} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  </View>;
}

export function formatUsd(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 100 ? 2 : n >= 1 ? 3 : 5 }).format(n);
}

export function formatNumber(value: number | string | null | undefined, max = 4) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: max }).format(n) : "—";
}

export function formatAddress(address?: string | null) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected";
}

export function timeAgo(value?: string | number | null) {
  if (value == null || value === "") return "Timestamp unavailable";
  const n = Number(value);
  const date = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Timestamp unavailable";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WOLV.bg },
  screenContent: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24, gap: 16 },
  header: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  wordmark: { color: WOLV.text, fontSize: 18, fontWeight: "800", letterSpacing: 1.7 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  chainBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: WOLV.panel2, borderWidth: 1, borderColor: WOLV.border, borderRadius: 18 },
  chainDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: WOLV.amber },
  chainText: { color: WOLV.muted, fontSize: 10, fontWeight: "700" },
  connectChip: { borderWidth: 1, borderColor: WOLV.amber, backgroundColor: WOLV.amberSoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  connectText: { color: WOLV.amber, fontWeight: "800", fontSize: 10 },
  wMark: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: WOLV.amber, backgroundColor: "#11150F" },
  wMarkText: { color: WOLV.amber, fontWeight: "900", marginTop: -1 },
  card: { backgroundColor: WOLV.panel, borderColor: WOLV.border, borderWidth: 1, borderRadius: WOLV.radius, padding: 15 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { color: WOLV.text, fontSize: 15, fontWeight: "800", letterSpacing: 0.1 },
  sectionDetail: { color: WOLV.muted, fontSize: 11, marginTop: 3 },
  link: { color: WOLV.amber, fontSize: 11, fontWeight: "800" },
  primaryButton: { minHeight: 46, borderRadius: 12, backgroundColor: WOLV.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#14140C", fontWeight: "900", fontSize: 13, letterSpacing: 0.1 },
  secondaryButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: WOLV.borderBright, backgroundColor: WOLV.panel2, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryButtonText: { color: WOLV.text, fontWeight: "700", fontSize: 12 },
  buttonCompact: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10 },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, padding: 13 },
  noticeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  noticeTitle: { fontSize: 12, fontWeight: "800", marginBottom: 3 },
  noticeBody: { color: WOLV.muted, fontSize: 11, lineHeight: 16 },
  dataRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  dataRowDivider: { borderBottomColor: "#102638", borderBottomWidth: 1 },
  dataLabel: { color: WOLV.muted, fontSize: 11 },
  dataValue: { color: WOLV.text, fontSize: 11, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  marketGlyph: { backgroundColor: "#102333", borderColor: WOLV.borderBright, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  glyphText: { color: WOLV.amber, fontWeight: "900", letterSpacing: 0.1 },
  marketCard: { borderRadius: 15, borderWidth: 1, borderColor: WOLV.border, backgroundColor: WOLV.panel, padding: 13, gap: 11 },
  marketTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketSymbol: { color: WOLV.text, fontSize: 14, fontWeight: "900" },
  marketName: { color: WOLV.muted, fontSize: 10, marginTop: 2 },
  marketChange: { fontSize: 11, fontWeight: "800" },
  marketChangeMuted: { color: WOLV.faint, fontSize: 12, fontWeight: "800" },
  marketPriceRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  marketPrice: { color: WOLV.text, fontWeight: "800", fontSize: 17, fontVariant: ["tabular-nums"] },
  marketSpread: { color: WOLV.green, fontSize: 9, fontWeight: "700" },
  marketMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  marketPlatform: { color: WOLV.amber, fontSize: 9, fontWeight: "800" },
  marketChain: { color: WOLV.faint, fontSize: 9, flexShrink: 1, textAlign: "right" },
  marketActions: { flexDirection: "row", gap: 8 },
  marketAction: { flex: 1, minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: WOLV.borderBright, alignItems: "center", justifyContent: "center" },
  marketActionText: { color: WOLV.text, fontSize: 11, fontWeight: "700" },
  marketTrade: { backgroundColor: WOLV.amber, borderColor: WOLV.amber },
  marketTradeText: { color: "#17150A", fontSize: 11, fontWeight: "900" },
  orbit: { height: 168, width: 220, alignSelf: "center", opacity: 0.9 },
});
