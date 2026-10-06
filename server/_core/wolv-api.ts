import { createHmac } from "node:crypto";

const BINANCE_ORIGIN = "https://web3.binance.com";
const BSC_CHAIN_ID = "56";
const USDT_BSC = "0x55d398326f99059ff775485246999027b3197955";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type Json = Record<string, unknown>;
type ApiResult = { status: number; body: Json };

class HttpError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") {
    super(message);
  }
}

function apiCredentials() {
  const key = process.env.BINANCE_WEB3_API_KEY;
  const secret = process.env.BINANCE_WEB3_API_SECRET;
  if (!key || !secret) {
    throw new HttpError(503, "Live market and trade API is not configured. Set BINANCE_WEB3_API_KEY and BINANCE_WEB3_API_SECRET in the Vercel server environment.", "BINANCE_API_NOT_CONFIGURED");
  }
  return { key, secret };
}

function serializeQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).length) query.append(key, String(value));
  }
  return query.toString();
}

export function buildBinanceSignature(timestamp: string, method: string, requestPath: string, bodyText: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}${method}${requestPath}${bodyText}`).digest("base64");
}

async function binanceRequest<T = any>(
  method: "GET" | "POST",
  apiPath: string,
  params: Record<string, string | number | undefined> = {},
  body?: Json,
): Promise<T> {
  const { key, secret } = apiCredentials();
  const query = serializeQuery(params);
  const requestPath = `/build${apiPath}${query ? `?${query}` : ""}`;
  const timestamp = new Date().toISOString();
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const signature = buildBinanceSignature(timestamp, method, requestPath, bodyText, secret);

  const response = await fetch(`${BINANCE_ORIGIN}${requestPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-OC-APIKEY": key,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "X-OC-RECV-WINDOW": "5000",
    },
    ...(body === undefined ? {} : { body: bodyText }),
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(502, "Binance Web3 API returned an unreadable response.", "UPSTREAM_INVALID_RESPONSE");
  }
  const businessCode = parsed?.code;
  if (!response.ok || (businessCode !== undefined && ![0, "0", "000000"].includes(businessCode) && parsed?.success !== true)) {
    const message = typeof parsed?.msg === "string" ? parsed.msg : `Binance Web3 API request failed (${response.status}).`;
    const code = businessCode === undefined ? "UPSTREAM_ERROR" : `BINANCE_${String(businessCode)}`;
    throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, message, code);
  }
  return parsed as T;
}

function unwrap<T = any>(response: any): T {
  return (response?.data ?? response) as T;
}

function listFrom(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.tokens)) return value.tokens;
  if (Array.isArray(value?.records)) return value.records;
  return [];
}

function amountToBaseUnits(value: string, decimals: number): string {
  if (!/^\d+(\.\d+)?$/.test(value) || value.length > 64) {
    throw new HttpError(400, "Enter a positive decimal amount.", "INVALID_AMOUNT");
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new HttpError(400, `This token supports at most ${decimals} decimal places.`, "AMOUNT_PRECISION");
  const base = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  if (!/[1-9]/.test(base)) throw new HttpError(400, "Amount must be greater than zero.", "INVALID_AMOUNT");
  return base;
}

async function tokenDecimals(address: string): Promise<number> {
  const rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: address, data: "0x313ce567" }, "latest"] }),
  });
  const result = await response.json() as any;
  if (!response.ok || result?.error || typeof result?.result !== "string") {
    throw new HttpError(502, "Could not read token decimals from BSC. Retry or configure BSC_RPC_URL.", "BSC_RPC_FAILED");
  }
  const decimals = Number.parseInt(result.result, 16);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new HttpError(502, "BSC returned invalid token decimals.", "INVALID_TOKEN_DECIMALS");
  return decimals;
}

function fromBaseUnits(value: bigint, decimals: number) {
  if (decimals === 0) return value.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = (value / divisor).toString();
  const fraction = (value % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function tokenBalance(token: any, walletAddress: string) {
  const address = tokenAddress(token);
  if (!ADDRESS_RE.test(address)) return null;
  const rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
  const data = `0x70a08231${walletAddress.slice(2).toLowerCase().padStart(64, "0")}`;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: address, data }, "latest"] }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json() as any;
  if (!response.ok || result?.error || typeof result?.result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result.result)) {
    throw new HttpError(502, "Could not read the connected wallet's BSC token balances. Retry or configure BSC_RPC_URL.", "BSC_BALANCE_READ_FAILED");
  }
  const units = BigInt(result.result);
  if (units === 0n) return null;
  const parsedDecimals = Number(token?.decimals);
  const decimals = Number.isInteger(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 36 ? parsedDecimals : await tokenDecimals(address);
  return {
    ...token,
    tokenContractAddress: address,
    decimals,
    tokenBalanceAmount: fromBaseUnits(units, decimals),
  };
}

async function tokenAllowance(tokenAddressInput: string, ownerAddress: string, spenderAddress: string) {
  const rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
  const owner = ownerAddress.slice(2).toLowerCase().padStart(64, "0");
  const spender = spenderAddress.slice(2).toLowerCase().padStart(64, "0");
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: tokenAddressInput, data: `0xdd62ed3e${owner}${spender}` }, "latest"] }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json() as any;
  if (!response.ok || result?.error || typeof result?.result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result.result)) {
    throw new HttpError(502, "Could not read the ERC-20 allowance on BSC. Retry or configure BSC_RPC_URL.", "BSC_ALLOWANCE_READ_FAILED");
  }
  return BigInt(result.result).toString();
}

async function mapLimit(items: any[], concurrency: number, mapper: (item: any) => Promise<any>) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function rwaTokens() {
  const response = await binanceRequest("GET", "/api/v1/dex/market/rwa/tokens", { binanceChainId: BSC_CHAIN_ID });
  return listFrom(unwrap(response)).filter(isSupportedStockToken);
}

async function rwaPrices(tokens: any[]) {
  const addresses = [...new Set(tokens.map(tokenAddress).filter((address) => ADDRESS_RE.test(address)).map((address) => address.toLowerCase()))];
  const batches: string[][] = [];
  for (let index = 0; index < addresses.length; index += 100) batches.push(addresses.slice(index, index + 100));
  const responses = await Promise.all(batches.map((batch) => binanceRequest("GET", "/api/v1/dex/market/rwa/price", {
    binanceChainId: BSC_CHAIN_ID,
    tokenContractAddresses: batch.join(","),
  })));
  return responses.flatMap((response) => listFrom(unwrap(response)));
}

function mergeRwaPrices(tokens: any[], prices: any[]) {
  const byAddress = new Map(prices.map((price) => [tokenAddress(price).toLowerCase(), price]));
  return tokens.map((token) => {
    const price = byAddress.get(tokenAddress(token).toLowerCase());
    return price ? { ...token, tokenPrice: price.tokenPrice, referencePrice: price.referencePrice, tokenPriceUpdatedAt: price.tokenPriceUpdatedAt, priceTimestamp: price.timestamp } : token;
  });
}

function tokenAddress(token: any) {
  return String(token?.tokenContractAddress ?? token?.contractAddress ?? token?.address ?? "");
}

function tokenSymbol(token: any) {
  return String(token?.underlyingSymbol ?? token?.underlyingTicker ?? token?.underlyingAssetSymbol ?? token?.tokenSymbol ?? token?.symbol ?? "").toUpperCase();
}

function isSupportedStockToken(token: any) {
  const platform = [token?.platformName, token?.tokenPlatformName, token?.platformId, token?.platform, token?.issuerName, token?.issuer, token?.providerName, token?.provider, token?.projectName].filter(Boolean).join(" ");
  const assetType = token?.assetType == null ? null : Number(token.assetType);
  return /(?:b.?stocks?|ondo|x.?stocks?)/i.test(platform) && (assetType == null || !Number.isFinite(assetType) || [1, 3].includes(assetType));
}

async function tradingContext(input: any) {
  const requestedAddress = String(input?.tokenContractAddress ?? "");
  const side = String(input?.side ?? "buy").toLowerCase();
  const walletAddress = String(input?.walletAddress ?? "");
  const amount = String(input?.amount ?? "");
  if (!ADDRESS_RE.test(requestedAddress) || !["buy", "sell"].includes(side) || !ADDRESS_RE.test(walletAddress)) {
    throw new HttpError(400, "A supported stock token contract, buy/sell side, and connected BSC wallet are required.", "INVALID_TRADE_INPUT");
  }
  const tokens = await rwaTokens();
  const token = tokens.find((item) => tokenAddress(item).toLowerCase() === requestedAddress.toLowerCase());
  if (!token) throw new HttpError(404, "That tokenized-stock instrument is not in the current Binance RWA listing.", "RWA_TOKEN_NOT_FOUND");
  const symbol = tokenSymbol(token);
  const stockAddress = tokenAddress(token);
  const stockDecimals = Number.isInteger(Number(token?.decimals)) ? Number(token.decimals) : await tokenDecimals(stockAddress);
  const fromTokenAddress = side === "buy" ? USDT_BSC : stockAddress;
  const toTokenAddress = side === "buy" ? stockAddress : USDT_BSC;
  const decimals = side === "buy" ? await tokenDecimals(USDT_BSC) : stockDecimals;
  const amountUnits = amountToBaseUnits(amount, decimals);
  return { symbol, side, amount, amountUnits, walletAddress: walletAddress.toLowerCase(), stockAddress, stockDecimals, fromTokenAddress, toTokenAddress, token };
}

function normalizedOrigin(origin: string | undefined) {
  if (!origin) return undefined;
  if (process.env.NODE_ENV !== "production" && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin.endsWith(".manus.computer"))) return origin;
  const configuredOrigins = (process.env.PUBLIC_APP_ORIGIN || "").split(",").map((item) => item.trim().replace(/\/$/, "")).filter(Boolean);
  const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host}`);
  const allowed = [...configuredOrigins, ...vercelOrigins];
  if (allowed.length) return allowed.includes(origin.replace(/\/$/, "")) ? origin : "";
  return "";
}

export async function handleWolvRequest(methodInput: string | undefined, rawUrl: string | undefined, bodyInput: unknown): Promise<ApiResult> {
  try {
    const method = (methodInput || "GET").toUpperCase();
    const url = new URL(rawUrl || "/api/wolv/health", "http://wolv.local");
    const route = url.pathname.replace(/^\/api\/wolv\/?/, "").replace(/\/$/, "");
    const params = url.searchParams;

    if (method === "OPTIONS") return { status: 204, body: {} };
    if (route === "health" && method === "GET") return { status: 200, body: { ok: true, chainId: 56, liveApiConfigured: Boolean(process.env.BINANCE_WEB3_API_KEY && process.env.BINANCE_WEB3_API_SECRET) } };

    if (route === "markets" && method === "GET") {
      const tokens = await rwaTokens();
      const prices = await rwaPrices(tokens);
      return { status: 200, body: { data: mergeRwaPrices(tokens, prices), receivedAt: Date.now(), source: "Binance Web3 RWA Token + Price APIs", binanceChainId: 56 } };
    }

    if (route === "candles" && method === "GET") {
      const address = params.get("address") || "";
      const bar = params.get("bar") || "1h";
      const allowedBars = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"]);
      if (!ADDRESS_RE.test(address) || !allowedBars.has(bar)) throw new HttpError(400, "Valid token address and interval are required.", "INVALID_CANDLE_INPUT");
      const limit = Math.max(1, Math.min(100, Number(params.get("limit") || 48)));
      const raw = await binanceRequest("GET", "/api/v1/dex/market/candles", { binanceChainId: BSC_CHAIN_ID, tokenContractAddress: address.toLowerCase(), bar, limit });
      return { status: 200, body: { data: unwrap(raw), receivedAt: Date.now(), source: "Binance Web3 Market API" } };
    }

    if (route === "allowance" && method === "GET") {
      const tokenAddressInput = params.get("tokenAddress") || "";
      const ownerAddress = params.get("owner") || "";
      const spenderAddress = params.get("spender") || "";
      if (![tokenAddressInput, ownerAddress, spenderAddress].every((address) => ADDRESS_RE.test(address))) {
        throw new HttpError(400, "Valid BSC token, wallet owner and spender addresses are required.", "INVALID_ALLOWANCE_INPUT");
      }
      const allowance = await tokenAllowance(tokenAddressInput, ownerAddress, spenderAddress);
      return { status: 200, body: { allowance, tokenAddress: tokenAddressInput, owner: ownerAddress, spender: spenderAddress, binanceChainId: 56, receivedAt: Date.now(), source: "BSC eth_call" } };
    }

    if (route === "portfolio" && method === "GET") {
      const address = params.get("address") || "";
      if (!ADDRESS_RE.test(address)) throw new HttpError(400, "Connect a valid EVM wallet address to load your portfolio.", "INVALID_WALLET_ADDRESS");
      const [tokens, historyRaw] = await Promise.all([
        rwaTokens(),
        binanceRequest("GET", "/api/v1/dex/market/portfolio/dex-history", { binanceChainId: BSC_CHAIN_ID, walletAddress: address.toLowerCase(), limit: 50 }),
      ]);
      const balances = await mapLimit(tokens, 10, (token) => tokenBalance(token, address));
      const heldTokens = balances.filter(Boolean);
      const prices = await rwaPrices(heldTokens);
      const holdings = mergeRwaPrices(heldTokens, prices).map((token: any) => {
        const amount = Number(token.tokenBalanceAmount);
        const price = Number(token.tokenPrice);
        return { ...token, tokenBalanceUsd: Number.isFinite(amount) && Number.isFinite(price) ? amount * price : null };
      });
      const history = unwrap(historyRaw) as any;
      const totalValueUsd = holdings.reduce((sum: number, item: any) => sum + (Number(item.tokenBalanceUsd) || 0), 0);
      return { status: 200, body: { holdings, totalValueUsd, history: listFrom(history?.transactionList ?? history?.trades ?? history), receivedAt: Date.now(), source: "BSC token balances + Binance Web3 DEX history", binanceChainId: 56 } };
    }

    if (route === "quote" && method === "POST") {
      const context = await tradingContext(bodyInput);
      const raw = await binanceRequest("GET", "/api/v1/dex/aggregator/quote", {
        binanceChainId: BSC_CHAIN_ID,
        fromTokenAddress: context.fromTokenAddress,
        toTokenAddress: context.toTokenAddress,
        amount: context.amountUnits,
        userWalletAddress: context.walletAddress,
      });
      return { status: 200, body: { quote: unwrap(raw), context: { ...context, token: undefined }, receivedAt: Date.now() } };
    }

    if (route === "approve" && method === "POST") {
      const input = bodyInput as any;
      const context = await tradingContext(input);
      const vendor = input?.vendorName ? String(input.vendorName) : undefined;
      const raw = await binanceRequest("GET", "/api/v1/dex/aggregator/approve-transaction", {
        binanceChainId: BSC_CHAIN_ID,
        tokenContractAddress: context.fromTokenAddress,
        approveAmount: context.amountUnits,
        vendor,
      });
      return { status: 200, body: { approval: unwrap(raw), context: { ...context, token: undefined }, receivedAt: Date.now() } };
    }

    if (route === "swap" && method === "POST") {
      const input = bodyInput as any;
      const context = await tradingContext(input);
      const quoteId = String(input?.quoteId ?? "");
      const slippagePercent = String(input?.slippagePercent ?? "0.5");
      if (!quoteId || quoteId.length > 200) throw new HttpError(400, "Choose a current quote route before requesting execution details.", "INVALID_QUOTE_ID");
      if (!["0.25", "0.5", "1", "2", "3", "5"].includes(slippagePercent)) throw new HttpError(400, "Choose a listed slippage tolerance before requesting the swap transaction.", "INVALID_SLIPPAGE");
      const raw = await binanceRequest("GET", "/api/v1/dex/aggregator/swap", {
        binanceChainId: BSC_CHAIN_ID,
        fromTokenAddress: context.fromTokenAddress,
        toTokenAddress: context.toTokenAddress,
        amount: context.amountUnits,
        userWalletAddress: context.walletAddress,
        quoteId,
        slippagePercent,
      });
      return { status: 200, body: { swap: unwrap(raw), context: { ...context, token: undefined }, receivedAt: Date.now() } };
    }

    if (route === "rfq-submit" && method === "POST") {
      const input = bodyInput as any;
      const userSignature = String(input?.userSignature ?? "");
      const vendor = String(input?.vendor ?? "");
      const quoteId = String(input?.quoteId ?? "");
      const requestId = String(input?.requestId ?? "");
      const signingScheme = input?.signingScheme ? String(input.signingScheme) : undefined;
      if (!/^0x[a-fA-F0-9]{130}$/.test(userSignature) || !["InchFusion", "CowSwap", "PcsXRfq"].includes(vendor) || !quoteId || quoteId.length > 256 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) || (signingScheme !== undefined && signingScheme !== "EIP712")) {
        throw new HttpError(400, "Valid EIP-712 signature, RFQ vendor, swap response order ID, signing scheme and idempotency UUID are required.", "INVALID_RFQ_SUBMISSION");
      }
      const raw = await binanceRequest("POST", "/api/v1/dex/aggregator/order/submit", {}, { userSignature, vendor, quoteId, requestId, ...(signingScheme ? { signingScheme } : {}) });
      return { status: 200, body: { order: unwrap(raw), receivedAt: Date.now() } };
    }

    if (route.startsWith("order/") && method === "GET") {
      const orderId = decodeURIComponent(route.slice("order/".length));
      if (!orderId || orderId.length > 256 || orderId.includes("/")) throw new HttpError(400, "Invalid RFQ order ID.", "INVALID_ORDER_ID");
      const raw = await binanceRequest("GET", `/api/v1/dex/aggregator/order/${encodeURIComponent(orderId)}`);
      return { status: 200, body: { order: unwrap(raw), receivedAt: Date.now() } };
    }

    return { status: 404, body: { error: "WOLV API route not found.", code: "NOT_FOUND" } };
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, body: { error: error.message, code: error.code } };
    const message = error instanceof Error ? error.message : "Unexpected WOLV API failure.";
    return { status: 502, body: { error: message, code: "WOLV_API_FAILURE" } };
  }
}

export function setWolvCors(req: { headers?: Record<string, string | string[] | undefined> }, res: { setHeader(name: string, value: string): void; removeHeader?: (name: string) => void }) {
  const originValue = req.headers?.origin;
  const origin = Array.isArray(originValue) ? originValue[0] : originValue;
  const allowed = normalizedOrigin(origin);
  if (origin && !allowed) {
    res.removeHeader?.("Access-Control-Allow-Origin");
    return false;
  }
  if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  return true;
}
