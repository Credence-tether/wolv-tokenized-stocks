import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, DataRow, Header, MarketGlyph, Notice, PrimaryButton, Screen, SectionTitle, SecondaryButton, formatAddress, formatNumber, formatUsd, timeAgo } from "@/components/wolv-ui";
import { WOLV } from "@/constants/wolv-theme";
import { useMarkets } from "@/lib/market-data";
import { marketAddress, marketName, marketPrice, marketSymbol, wolvApi } from "@/lib/wolv-api";
import { useWallet, type EvmTransaction } from "@/lib/wallet/WalletContext";

function routesFrom(payload: any): any[] {
  const source = payload?.quote ?? payload;
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.routes)) return source.routes;
  if (Array.isArray(source?.quoteList)) return source.quoteList;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}
function approvalsFrom(payload: any): any[] {
  const source = payload?.approval ?? payload;
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data)) return source.data;
  if (Array.isArray(source?.approvals)) return source.approvals;
  return [];
}
function routeMode(route: any) { return String(route?.executionMode ?? route?.mode ?? route?.tradeMode ?? "").toUpperCase(); }
function routeVendor(route: any) { return String(route?.vendorName ?? route?.vendor ?? route?.venue ?? route?.dexName ?? ""); }
function routeQuoteId(route: any, quote: any) { return String(route?.quoteId ?? route?.id ?? route?.routeId ?? quote?.quoteId ?? quote?.requestId ?? ""); }
function routeOutput(route: any) { return route?.toTokenAmount ?? route?.toAmount ?? route?.outputAmount ?? route?.amountOut ?? null; }
function routeMinimum(route: any) { return route?.minimumReceive ?? route?.minimumReceiveAmount ?? route?.minReceiveAmount ?? route?.minOutputAmount ?? route?.toTokenAmountMin ?? route?.toAmountMin ?? null; }
function formatSmallestUnit(value: any, decimals: any) {
  if (value == null) return null;
  const raw = String(value);
  if (raw.includes(".")) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? formatNumber(parsed, 8) : raw;
  }
  if (!/^\d+$/.test(raw)) return raw;
  const digits = Number(decimals);
  if (!Number.isInteger(digits) || digits < 0 || digits > 36) return raw;
  try {
    const units = BigInt(raw);
    const divisor = 10n ** BigInt(digits);
    const whole = (units / divisor).toString();
    const fraction = digits ? (units % divisor).toString().padStart(digits, "0").replace(/0+$/, "") : "";
    return formatNumber(fraction ? `${whole}.${fraction}` : whole, 8);
  } catch { return raw; }
}
function outputDecimals(route: any, side: "buy" | "sell", tokenDecimals: any) {
  const decimals = Number(route?.toToken?.decimal ?? route?.toToken?.decimals ?? (side === "buy" ? tokenDecimals : 18));
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
}
function routeFees(route: any) {
  const charges = [];
  if (route?.tradeFee != null && Number.isFinite(Number(route.tradeFee))) charges.push(`fee est. ${formatUsd(route.tradeFee)}`);
  if (route?.estimateGasFee != null) charges.push(`~${formatSmallestUnit(route.estimateGasFee, 18)} BNB gas`);
  return charges.join(" · ") || "Not supplied by API";
}
function expiryTimestamp(value: any): number | null {
  if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value))) {
    const numeric = Number(value);
    return numeric > 0 ? (numeric < 1e12 ? numeric * 1000 : numeric) : null;
  }
  if (typeof value === "string") { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }
  return null;
}
function routePriceImpact(route: any) { const value = route?.priceImpact ?? route?.priceImpactPercent ?? route?.impact; return value == null ? null : Number(value); }
function uuid() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }

async function pollRfqOrder(orderId: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const response = await wolvApi.orderStatus(orderId);
    const data = response?.order?.data ?? response?.order ?? {};
    const state = String(data?.status ?? data?.orderStatus ?? "").toUpperCase();
    if (["FILLED", "SUCCESS", "COMPLETED"].includes(state)) return { state, data };
    if (["FAILED", "REJECTED", "CANCELLED"].includes(state)) return { state, data };
  }
  return { state: "PENDING", data: {} };
}

export default function TradeScreen() {
  const params = useLocalSearchParams<{ symbol?: string; address?: string }>();
  const router = useRouter();
  const wallet = useWallet();
  const { markets, isLoading: marketsLoading, error: marketsError } = useMarkets();
  const selected = useMemo(() => {
    const address = String(params.address || "").toLowerCase();
    if (address) return markets.find((market) => marketAddress(market).toLowerCase() === address);
    const symbol = String(params.symbol || "").toUpperCase();
    return markets.find((m) => marketSymbol(m) === symbol) ?? markets[0];
  }, [markets, params.address, params.symbol]);
  const symbol = selected ? marketSymbol(selected) : "";
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [quoteResponse, setQuoteResponse] = useState<any>(null);
  const [preparedSwapResponse, setPreparedSwapResponse] = useState<any>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [approvalTx, setApprovalTx] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoteStale, setQuoteStale] = useState(false);
  const [slippagePercent, setSlippagePercent] = useState("0.5");
  const [rfqRequest, setRfqRequest] = useState<{ key: string; id: string } | null>(null);
  const routes = routesFrom(quoteResponse);
  const route = routes[routeIndex];
  const price = selected ? marketPrice(selected) : null;
  const baseInput = { tokenContractAddress: selected ? marketAddress(selected) : "", side, amount, walletAddress: wallet.address || "" };
  const quotedAddress = String(quoteResponse?.context?.walletAddress ?? "");
  const quoteMatchesWallet = !quotedAddress || Boolean(wallet.address && quotedAddress.toLowerCase() === wallet.address.toLowerCase());
  const canAct = Boolean(selected && wallet.address && wallet.chainId === 56 && amount && !busy && quoteMatchesWallet);
  const preparedSwap = preparedSwapResponse?.swap?.data ?? preparedSwapResponse?.swap;
  const preparedRouterResult = preparedSwap?.routerResult ?? {};
  const preparedTransaction = preparedSwap?.tx ?? {};
  const reviewOutput = preparedRouterResult?.toTokenAmount ?? routeOutput(route);
  const reviewMinimum = preparedTransaction?.minReceiveAmount ?? preparedRouterResult?.minReceiveAmount ?? routeMinimum(route);
  const reviewDecimals = outputDecimals(preparedRouterResult, side, selected?.decimals);
  const reviewMode = routeMode(route) || String(preparedSwap?.executionMode ?? preparedSwap?.mode ?? "").toUpperCase();

  function quoteExpiredNow() {
    const receivedAt = Number(quoteResponse?.receivedAt);
    if (!Number.isFinite(receivedAt) || receivedAt <= 0) return true;
    const apiExpiry = expiryTimestamp(route?.expiresAt ?? route?.expireTime ?? quoteResponse?.quote?.expiresAt ?? quoteResponse?.quote?.expireTime ?? quoteResponse?.quote?.validUntil);
    return Date.now() >= Math.min(apiExpiry ?? receivedAt + 15000, receivedAt + 15000);
  }

  useEffect(() => {
    if (!quoteResponse?.receivedAt) return;
    const receivedAt = Number(quoteResponse.receivedAt);
    const apiExpiry = expiryTimestamp(route?.expiresAt ?? route?.expireTime ?? quoteResponse?.quote?.expiresAt ?? quoteResponse?.quote?.expireTime ?? quoteResponse?.quote?.validUntil);
    const deadline = Math.min(apiExpiry ?? receivedAt + 15000, receivedAt + 15000);
    const timer = setTimeout(() => setQuoteStale(true), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [quoteResponse, route?.expiresAt, route?.expireTime, routeIndex]);

  async function getQuote() {
    if (!selected) { setError("Wait for the live token list before requesting a quote."); return; }
    if (!wallet.isConnected) { setError("Connect your wallet before requesting a route."); return; }
    if (wallet.chainId !== 56) { setError("Switch to BNB Smart Chain (56) before requesting a stock quote."); return; }
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) { setError("Enter an amount greater than zero."); return; }
    setBusy(true); setError(""); setStatus("Requesting a live quote…"); setReview(false); setApprovalTx(null); setPreparedSwapResponse(null); setQuoteStale(false);
    try {
      const response = await wolvApi.quote(baseInput);
      setQuoteResponse(response);
      setRfqRequest(null);
      setRouteIndex(0);
      const found = routesFrom(response);
      setStatus(found.length ? "Live quote received. Choose a route and review it before signing." : "The API returned no executable route for this token, amount, wallet, or market session.");
    } catch (e) {
      setQuoteResponse(null); setStatus(""); setError(e instanceof Error ? e.message : "Quote request failed.");
    } finally { setBusy(false); }
  }

  async function submitRfq(swapData: any, selectedRoute: any) {
    const rfq = swapData?.rfq ?? swapData?.data?.rfq;
    const typedData = rfq?.typedDataToSign;
    const vendor = String(rfq?.vendor ?? rfq?.vendorName ?? routeVendor(selectedRoute));
    const quoteId = String(rfq?.orderId ?? rfq?.quoteId ?? "");
    const signingScheme = rfq?.signingScheme ? String(rfq.signingScheme) : undefined;
    if (!typedData || !vendor || !quoteId) throw new Error("Binance did not return the required RFQ typed-data payload, RFQ vendor, and swap response order ID.");
    if (!wallet.address || String(quoteResponse?.context?.walletAddress ?? "").toLowerCase() !== wallet.address.toLowerCase()) throw new Error("The connected wallet no longer matches the address that requested this RFQ quote. No signature was requested.");
    const requestKey = `${quoteId}:${vendor}`;
    const requestId = rfqRequest?.key === requestKey ? rfqRequest.id : uuid();
    if (rfqRequest?.key !== requestKey) setRfqRequest({ key: requestKey, id: requestId });
    setStatus("Review the typed-data request in your wallet…");
    const signature = await wallet.signTypedData(typedData);
    setStatus("Submitting the wallet-signed RFQ order…");
    const submitted = await wolvApi.submitRfq({ userSignature: signature, vendor, quoteId, requestId, signingScheme });
    const order = submitted?.order?.data ?? submitted?.order;
    const orderId = String(order?.orderId ?? order?.id ?? "");
    if (!orderId) { setStatus("RFQ submission response received; no order ID was returned. Check the provider response before retrying."); return; }
    setStatus(`RFQ order ${orderId} submitted. Waiting for vendor settlement…`);
    const result = await pollRfqOrder(orderId);
    if (["FILLED", "SUCCESS", "COMPLETED"].includes(result.state)) { setStatus(`RFQ order settled: ${result.state}. Order ${orderId}`); return; }
    if (["FAILED", "REJECTED", "CANCELLED"].includes(result.state)) { setStatus(`RFQ order ended with status ${result.state}. ${result.data?.errorMsg || orderId}`); return; }
    setStatus(`RFQ order ${orderId} is still pending. Check the live order status before retrying.`);
  }

  async function reviewRoute() {
    if (!route || !canAct) return;
    if (quoteExpiredNow()) { setQuoteStale(true); setQuoteResponse(null); setPreparedSwapResponse(null); setError("The quote has expired. Request a fresh quote before reviewing or signing."); return; }
    const quoteId = routeQuoteId(route, quoteResponse?.quote);
    if (!quoteId) { setError("The selected API route did not include a quote ID."); return; }
    setBusy(true); setError(""); setStatus("Requesting exact execution details for review…");
    try {
      const response = await wolvApi.swap({ ...baseInput, quoteId, slippagePercent });
      setPreparedSwapResponse(response);
      setReview(true);
      setStatus("Exact swap/RFQ details received. Review minimum output and route data before continuing.");
    } catch (e) {
      setPreparedSwapResponse(null); setReview(false); setStatus(""); setError(e instanceof Error ? e.message : "Could not load exact execution details.");
    } finally { setBusy(false); }
  }

  async function executeSwap(selectedRoute: any, response: any) {
    const quoteId = routeQuoteId(selectedRoute, quoteResponse?.quote);
    if (!quoteId) throw new Error("The selected API route did not include a quote ID.");
    const swapData = response?.swap?.data ?? response?.swap;
    const mode = routeMode(selectedRoute) || String(swapData?.executionMode ?? swapData?.mode ?? "").toUpperCase();
    if (mode === "RFQ" || swapData?.rfq) { await submitRfq(swapData, selectedRoute); return; }
    const transaction = swapData?.tx ?? swapData?.transaction ?? swapData?.data?.tx;
    if (!transaction?.to || !transaction?.data) throw new Error("Binance did not return an unsigned BSC swap transaction for the selected route.");
    const transactionFrom = String(transaction.from ?? "");
    if (!wallet.address || (transactionFrom && transactionFrom.toLowerCase() !== wallet.address.toLowerCase())) throw new Error("The unsigned transaction sender does not match the connected wallet. No transaction was sent.");
    setStatus("Open your wallet and review the unsigned BSC transaction…");
    const hash = await wallet.sendTransaction({ from: wallet.address || undefined, to: String(transaction.to), data: String(transaction.data), value: transaction.value ?? "0", gas: transaction.gas ?? transaction.gasLimit, gasPrice: transaction.gasPrice, maxFeePerGas: transaction.maxFeePerGas, maxPriorityFeePerGas: transaction.maxPriorityFeePerGas } as EvmTransaction);
    setStatus(`Transaction submitted: ${hash}. Waiting for BSC confirmation…`);
    const chainStatus = await wallet.waitForTransaction(hash);
    if (chainStatus === "success") setStatus(`Confirmed on BNB Smart Chain. Transaction ${hash}`);
    else if (chainStatus === "reverted") setStatus(`Transaction reverted on BNB Smart Chain. Transaction ${hash}`);
    else setStatus(`Transaction ${hash} is pending. Check BscScan or your wallet before retrying.`);
  }

  async function prepareAndSubmit() {
    if (!route || !canAct) return;
    if (!wallet.address || String(quoteResponse?.context?.walletAddress ?? "").toLowerCase() !== wallet.address.toLowerCase()) { setQuoteResponse(null); setPreparedSwapResponse(null); setReview(false); setError("The quote belongs to a different wallet. Request a fresh quote for the connected address."); return; }
    if (quoteStale || quoteExpiredNow()) { setError("The quote has expired. Request a fresh quote before reviewing or signing."); setQuoteResponse(null); setPreparedSwapResponse(null); setReview(false); return; }
    if (!preparedSwapResponse) { setError("Execution details are missing. Review the route again before signing."); setReview(false); return; }
    setBusy(true); setError(""); setStatus("Checking whether the quoted input token needs approval…");
    try {
      if (route?.approveTarget !== null) {
        const vendorName = routeVendor(route) || undefined;
        const response = await wolvApi.approval({ ...baseInput, vendorName });
        const approvals = approvalsFrom(response);
        const approval = approvals.find((item: any) => item?.data || item?.transactionData || item?.tx?.data);
        if (!approval) throw new Error("Binance did not return an approval transaction for this route. No wallet transaction was sent.");
        const spender = String(approval.dexContractAddress ?? route?.approveTarget ?? "");
        const tokenAddress = String(quoteResponse?.context?.fromTokenAddress ?? "");
        const amountUnits = String(quoteResponse?.context?.amountUnits ?? "");
        if (!/^0x[a-fA-F0-9]{40}$/.test(spender) || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress) || !/^\d+$/.test(amountUnits)) throw new Error("The approval response or quote is missing a valid BSC token, spender or exact amount.");
        if (route?.approveTarget && String(route.approveTarget).toLowerCase() !== spender.toLowerCase()) throw new Error("The approval spender does not match the selected quote route. No wallet transaction was sent.");
        const allowanceResponse = await wolvApi.allowance(tokenAddress, wallet.address || "", spender);
        if (BigInt(allowanceResponse.allowance) < BigInt(amountUnits)) {
          if (quoteExpiredNow()) { setQuoteStale(true); setQuoteResponse(null); setPreparedSwapResponse(null); setReview(false); throw new Error("The quote expired while allowance was being checked. Request a fresh quote."); }
          setApprovalTx({ ...approval, tokenAddress, dexContractAddress: spender, vendorName, approveAmount: amountUnits, walletAddress: wallet.address });
          setStatus("The current allowance is below the exact quote input. Review a limited approval before signing.");
          setReview(false);
          return;
        }
      }
      if (quoteExpiredNow()) { setQuoteStale(true); setQuoteResponse(null); setPreparedSwapResponse(null); setReview(false); throw new Error("The quote expired while allowance was being checked. Request a fresh quote."); }
      setStatus("Waiting for your wallet to review and sign the selected route…");
      await executeSwap(route, preparedSwapResponse);
      setQuoteResponse(null); setPreparedSwapResponse(null); setReview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare the order.");
      setStatus("");
    } finally { setBusy(false); }
  }

  async function signApproval() {
    if (!approvalTx || !wallet.address) return;
    setBusy(true); setError("");
    try {
      if (wallet.chainId !== 56 || String(approvalTx.walletAddress ?? "").toLowerCase() !== wallet.address.toLowerCase()) throw new Error("The wallet account or network changed. Dismiss this approval and request a fresh quote on BNB Smart Chain.");
      const txData = approvalTx.data ?? approvalTx.transactionData ?? approvalTx.tx?.data;
      const gas = approvalTx.gasLimit ?? approvalTx.gas ?? approvalTx.tx?.gas;
      const gasPrice = approvalTx.gasPrice ?? approvalTx.tx?.gasPrice;
      if (!txData || !approvalTx.tokenAddress) throw new Error("Approval response is missing the token contract or calldata.");
      setStatus("Review and sign the token approval in your wallet…");
      const hash = await wallet.sendTransaction({ to: approvalTx.tokenAddress, data: txData, value: "0", gas, gasPrice });
      setStatus(`Approval submitted: ${hash}. Waiting for confirmation…`);
      const confirmed = await wallet.waitForTransaction(hash);
      if (confirmed === "reverted") throw new Error(`Approval transaction reverted: ${hash}`);
      if (confirmed === "pending") { setStatus(`Approval ${hash} is pending. Do not place the swap until it confirms.`); setApprovalTx(null); return; }
      setApprovalTx(null); setQuoteResponse(null); setPreparedSwapResponse(null); setReview(false);
      setStatus("Approval confirmed. Request a fresh quote before placing the trade.");
    } catch (e) { setError(e instanceof Error ? e.message : "Approval signing failed."); }
    finally { setBusy(false); }
  }

  return <Screen>
    <Header address={wallet.address} onConnect={() => wallet.connect().catch((e) => setError(e instanceof Error ? e.message : "Wallet connection failed."))} />
    <SectionTitle title="Trade" detail="Spot-only · BNB Smart Chain mainnet · wallet-signed" />
    {marketsError ? <Notice title="Live token list unavailable" body={marketsError instanceof Error ? marketsError.message : "Could not load the token list."} tone="error" /> : null}
    {!wallet.isConnected ? <Notice title="Connect a wallet to continue" body="The quote is calculated for your connected BSC address. WOLV never receives or stores your private key." tone="info" action="Connect wallet" onAction={() => router.push("/(tabs)/wallet")} /> : wallet.chainId !== 56 ? <Notice title="BNB Smart Chain required" body={`Your wallet is on chain ${wallet.chainId ?? "unknown"}. Stock-token execution is fixed to chain ID 56.`} tone="warn" action="Switch to BSC" onAction={() => void wallet.switchToBsc().catch((e) => setError(e instanceof Error ? e.message : "Could not switch network."))} /> : null}
    {!quoteMatchesWallet && quoteResponse ? <Notice title="Wallet account changed" body="This quote belongs to a different address. Request a fresh quote before signing or approving anything." tone="warn" action="Get fresh quote" onAction={() => void getQuote()} /> : null}
    {error ? <Notice title="Trade could not continue" body={error} tone="error" /> : null}

    <Card>
      <SectionTitle title="Select instrument" detail={selected ? "Current instrument comes from the live RWA listing." : "Waiting for live tokenized-stock instruments."} />
      {selected ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><MarketGlyph market={selected} /><View style={{ flex: 1 }}><Text style={{ color: WOLV.text, fontSize: 14, fontWeight: "900" }}>{symbol}</Text><Text style={{ color: WOLV.muted, fontSize: 10 }}>{marketName(selected)} · {marketAddress(selected).slice(0, 8)}…</Text></View><Text style={{ color: WOLV.text, fontSize: 14, fontWeight: "800" }}>{price == null ? "—" : formatUsd(price)}</Text></View> : <Text style={{ color: WOLV.muted, fontSize: 11 }}>{marketsLoading ? "Loading live instruments…" : "No instrument is available until the Binance RWA API returns a supported stock token."}</Text>}
    </Card>

    <Card>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {(["buy", "sell"] as const).map((item) => <Pressable key={item} onPress={() => { setSide(item); setQuoteResponse(null); setPreparedSwapResponse(null); setApprovalTx(null); setReview(false); setStatus(""); }} style={{ flex: 1, borderRadius: 11, paddingVertical: 10, alignItems: "center", backgroundColor: side === item ? WOLV.amber : WOLV.panel2, borderWidth: 1, borderColor: side === item ? WOLV.amber : WOLV.border }}><Text style={{ color: side === item ? WOLV.bg : WOLV.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{item}</Text></Pressable>)}
      </View>
      <Text style={{ color: WOLV.muted, fontSize: 10, marginBottom: 7 }}>{side === "buy" ? "Spend amount · USDT" : `Sell amount · ${symbol || "token"} shares`}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: WOLV.borderBright, borderRadius: 12, backgroundColor: WOLV.panel2, paddingHorizontal: 12 }}><Text style={{ color: WOLV.faint, fontSize: 18, fontWeight: "800" }}>{side === "buy" ? "$" : ""}</Text><TextInput value={amount} onChangeText={(value) => { setAmount(value.replace(/[^0-9.]/g, "")); setQuoteResponse(null); setPreparedSwapResponse(null); setApprovalTx(null); setReview(false); setStatus(""); }} placeholder="0.00" placeholderTextColor={WOLV.faint} keyboardType="decimal-pad" style={{ flex: 1, color: WOLV.text, fontSize: 20, fontWeight: "800", padding: 11 }} /><Text style={{ color: WOLV.muted, fontSize: 11, fontWeight: "700" }}>{side === "buy" ? "USDT" : symbol}</Text></View>
      <Text style={{ color: WOLV.faint, fontSize: 9, lineHeight: 14, marginTop: 9 }}>Minimum size, route availability, market hours and token approvals are determined by the live API. Quotes are blocked after an upstream expiry or a conservative 15-second local safety window.</Text>
      <View style={{ marginTop: 13 }}><PrimaryButton title="Get live quote" onPress={() => void getQuote()} disabled={busy || !selected} busy={busy} /></View>
    </Card>

    {routes.length > 0 ? <Card>
      <SectionTitle title="Executable routes" detail="Choose a route returned by the live Binance quote API." />
      {routes.map((item, index) => {
        const mode = routeMode(item) || "ROUTE";
        const output = routeOutput(item);
        const decimals = outputDecimals(item, side, selected?.decimals);
        const impact = routePriceImpact(item);
        return <Pressable key={`${routeQuoteId(item, quoteResponse?.quote)}-${index}`} onPress={() => { setRouteIndex(index); setPreparedSwapResponse(null); setApprovalTx(null); setReview(false); }} style={{ borderWidth: 1, borderColor: routeIndex === index ? WOLV.amber : WOLV.border, backgroundColor: routeIndex === index ? WOLV.amberSoft : WOLV.panel2, borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: WOLV.text, fontSize: 12, fontWeight: "800" }}>{routeVendor(item) || "Binance Web3 route"}</Text><Text style={{ color: WOLV.muted, fontSize: 9, marginTop: 3 }}>{mode} · BSC</Text></View><Text style={{ color: WOLV.amber, fontSize: 10, fontWeight: "900" }}>{routeIndex === index ? "SELECTED" : "SELECT"}</Text></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 9 }}><Text style={{ color: WOLV.muted, fontSize: 9 }}>Expected output</Text><Text style={{ color: WOLV.text, fontSize: 10, fontWeight: "800" }}>{output == null ? "See route details" : `${formatSmallestUnit(output, decimals)} ${side === "buy" ? symbol : "USDT"}`}</Text></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}><Text style={{ color: WOLV.muted, fontSize: 9 }}>Minimum receive</Text><Text style={{ color: WOLV.text, fontSize: 9, fontWeight: "700" }}>{routeMinimum(item) == null ? "See exact swap details" : `${formatSmallestUnit(routeMinimum(item), decimals)} ${side === "buy" ? symbol : "USDT"}`}</Text></View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5, gap: 8 }}><Text style={{ color: WOLV.muted, fontSize: 9 }}>Fees</Text><Text style={{ color: WOLV.text, fontSize: 9, fontWeight: "700", textAlign: "right", flexShrink: 1 }}>{routeFees(item)}</Text></View>
          {impact != null ? <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}><Text style={{ color: WOLV.muted, fontSize: 9 }}>Price impact</Text><Text style={{ color: Math.abs(impact) > 1 ? WOLV.amber : WOLV.green, fontSize: 9, fontWeight: "700" }}>{impact}%</Text></View> : null}
        </Pressable>;
      })}
      <DataRow label="Wallet" value={formatAddress(wallet.address)} />
      <DataRow label="Quote age" value={quoteResponse?.receivedAt ? `${timeAgo(quoteResponse.receivedAt)} · safety window 15s` : "Timestamp unavailable"} />
      <DataRow label="Quote expiry" value={quoteStale ? "Expired · refresh required" : "Current · rechecked before signing"} valueColor={quoteStale ? WOLV.red : WOLV.green} last />
      {quoteStale ? <Notice title="Quote expired" body="No wallet action was sent. Refresh the quote and review the current route again." tone="warn" action="Get fresh quote" onAction={() => void getQuote()} /> : null}
      {!review && !approvalTx ? <View style={{ marginTop: 12 }}><PrimaryButton title="Review exact route →" onPress={() => void reviewRoute()} disabled={!canAct || busy || quoteStale} busy={busy} /></View> : null}
    </Card> : null}

    {review && route ? <Card style={{ borderColor: WOLV.amber }}>
      <SectionTitle title="Review order" detail="No transaction is sent until you confirm and approve in your wallet." />
      <DataRow label="Action" value={`${side.toUpperCase()} ${symbol} · spot`} />
      <DataRow label="Amount" value={`${amount} ${side === "buy" ? "USDT" : symbol}`} />
      <DataRow label="Route" value={routeVendor(route) || routeMode(route) || "Binance Web3 route"} />
      <DataRow label="Execution mode" value={routeMode(route) || "API-defined"} />
      <DataRow label="Expected output" value={reviewOutput == null ? "Not supplied by API" : `${formatSmallestUnit(reviewOutput, reviewDecimals)} ${side === "buy" ? symbol : "USDT"}`} />
      <DataRow label="Minimum receive" value={reviewMinimum == null ? "Not supplied by execution API" : `${formatSmallestUnit(reviewMinimum, reviewDecimals)} ${side === "buy" ? symbol : "USDT"}`} />
      <DataRow label="Fees" value={routeFees(preparedRouterResult?.tradeFee != null || preparedRouterResult?.estimateGasFee != null ? preparedRouterResult : route)} />
      {reviewMode === "SWAP" ? <View style={{ marginTop: 10, marginBottom: 6 }}><Text style={{ color: WOLV.muted, fontSize: 10, marginBottom: 7 }}>Slippage tolerance · applied to swap transaction</Text><View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{["0.25", "0.5", "1", "2", "3", "5"].map((item) => <Pressable key={item} onPress={() => { setSlippagePercent(item); setPreparedSwapResponse(null); }} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: slippagePercent === item ? WOLV.amber : WOLV.border, backgroundColor: slippagePercent === item ? WOLV.amberSoft : WOLV.panel2 }}><Text style={{ color: slippagePercent === item ? WOLV.amber : WOLV.muted, fontSize: 9, fontWeight: "800" }}>{item}%</Text></Pressable>)}</View></View> : null}
      {reviewMode === "SWAP" ? <DataRow label="AMM slippage request" value={`${slippagePercent}% · included in unsigned route details`} /> : null}
      {!preparedSwapResponse ? <Notice title="Execution details need refreshing" body="The selected slippage or quote changed. Load fresh unsigned route details before signing." tone="warn" action="Refresh execution details" onAction={() => void reviewRoute()} /> : null}
      <DataRow label="Quote status" value={quoteStale ? "Expired" : "Current · short safety window"} valueColor={quoteStale ? WOLV.red : WOLV.green} last />
      <Notice title="Tokenized asset risk" body="This is a BSC spot trade in a third-party token, not a purchase of the underlying company’s shares. Review fees, spread, liquidity, issuer terms and wallet transaction details." tone="warn" />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}><View style={{ flex: 1 }}><SecondaryButton title="Back" onPress={() => setReview(false)} /></View><View style={{ flex: 1 }}><PrimaryButton title="Continue to wallet" onPress={() => void prepareAndSubmit()} disabled={!canAct || quoteStale || !preparedSwapResponse} busy={busy} /></View></View>
    </Card> : null}

    {approvalTx ? <Card style={{ borderColor: WOLV.amber }}>
      <SectionTitle title="Token approval required" detail="Approval authorizes a contract to spend the input token amount. Review the spender and calldata in your wallet." />
      <DataRow label="Token contract" value={`${String(approvalTx.tokenAddress).slice(0, 10)}…${String(approvalTx.tokenAddress).slice(-8)}`} />
      <DataRow label="Spender" value={approvalTx.dexContractAddress ? `${String(approvalTx.dexContractAddress).slice(0, 10)}…${String(approvalTx.dexContractAddress).slice(-8)}` : "See wallet approval details"} />
      <DataRow label="Maximum approved" value={`${amount} ${side === "buy" ? "USDT" : symbol} · exact quote input`} />
      <Text style={{ color: WOLV.muted, fontSize: 10, lineHeight: 15, marginVertical: 8 }}>After confirmation, request a new quote—the original quote may have expired while the approval settled.</Text>
      <PrimaryButton title="Review & sign approval" onPress={() => void signApproval()} disabled={busy || !quoteMatchesWallet || wallet.chainId !== 56} busy={busy} />
    </Card> : null}

    {status ? <Notice title="Trade status" body={status} tone={status.toLowerCase().includes("reverted") || status.toLowerCase().includes("failed") ? "error" : status.toLowerCase().includes("confirmed") || status.toLowerCase().includes("settled") ? "success" : "info"} /> : null}
    <Card style={{ padding: 12 }}><Text style={{ color: WOLV.faint, fontSize: 9, lineHeight: 14 }}>WOLV is spot-only and fixed to BSC chain 56. Market availability can vary by issuer, venue, jurisdiction, liquidity and U.S. market hours. No investment advice or return guarantee.</Text></Card>
  </Screen>;
}
