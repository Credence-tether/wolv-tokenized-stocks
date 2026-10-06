import { Platform } from "react-native";

export type WolvMarket = {
  tokenContractAddress?: string;
  contractAddress?: string;
  address?: string;
  tokenSymbol?: string;
  symbol?: string;
  underlyingSymbol?: string;
  underlyingTicker?: string;
  underlyingAssetSymbol?: string;
  tokenName?: string;
  tokenLogoUrl?: string;
  name?: string;
  underlyingName?: string;
  assetType?: number | string;
  tokenToShareRatio?: string | number;
  statusInfo?: { openState?: boolean; marketStatus?: string; reasonCode?: string; reasonMsg?: string };
  platformId?: string;
  platformName?: string;
  platform?: string;
  tokenPlatformName?: string;
  issuerName?: string;
  providerName?: string;
  issuer?: string;
  provider?: string;
  assetClass?: string;
  underlyingType?: string;
  marketStatus?: string;
  sessionStatus?: string;
  tradingStatus?: string;
  decimals?: number | string;
  tokenPrice?: string | number;
  tokenPriceUpdatedAt?: string | number;
  tokenPriceUsd?: string | number;
  currentPrice?: string | number;
  price?: string | number;
  priceUsd?: string | number;
  referencePrice?: string | number;
  referencePriceUsd?: string | number;
  underlyingPrice?: string | number;
  underlyingMarketPrice?: string | number;
  priceChange24h?: string | number;
  priceChangePercent24h?: string | number;
  change24h?: string | number;
  quoteTimestamp?: string | number;
  quoteReceivedAt?: string | number;
  updatedAt?: string | number;
  lastUpdatedAt?: string | number;
  timestamp?: string | number;
  logoUrl?: string;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = { data: T; receivedAt?: number; source?: string; error?: string; code?: string };

function apiBase() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL || "";
  if (Platform.OS !== "web" || typeof window === "undefined") return configured;
  const host = window.location.hostname;
  const webdevPreview = host.endsWith(".manus.computer") || host === "localhost" || host === "127.0.0.1";
  return webdevPreview ? configured : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = apiBase().replace(/\/$/, "");
  const response = await fetch(`${base}/api/wolv/${path.replace(/^\//, "")}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `WOLV API request failed (${response.status})`);
    Object.assign(error, { code: payload?.code, status: response.status });
    throw error;
  }
  return payload as T;
}

export const wolvApi = {
  markets: () => request<ApiEnvelope<WolvMarket[]>>("markets"),
  candles: (address: string, bar = "1h", limit = 48) => request<ApiEnvelope<unknown>>(`candles?${new URLSearchParams({ address, bar, limit: String(limit) }).toString()}`),
  allowance: (tokenAddress: string, owner: string, spender: string) => request<{ allowance: string }>(`allowance?${new URLSearchParams({ tokenAddress, owner, spender }).toString()}`),
  portfolio: (address: string) => request<{ holdings: any[]; history: any[]; totalValueUsd: number; receivedAt: number; source: string }>(`portfolio?address=${encodeURIComponent(address)}`),
  quote: (input: { tokenContractAddress: string; side: "buy" | "sell"; amount: string; walletAddress: string }) => request<any>("quote", { method: "POST", body: JSON.stringify(input) }),
  approval: (input: { tokenContractAddress: string; side: "buy" | "sell"; amount: string; walletAddress: string; vendorName?: string }) => request<any>("approve", { method: "POST", body: JSON.stringify(input) }),
  swap: (input: { tokenContractAddress: string; side: "buy" | "sell"; amount: string; walletAddress: string; quoteId: string; slippagePercent: string }) => request<any>("swap", { method: "POST", body: JSON.stringify(input) }),
  submitRfq: (input: { userSignature: string; vendor: string; quoteId: string; requestId: string; signingScheme?: string }) => request<any>("rfq-submit", { method: "POST", body: JSON.stringify(input) }),
  orderStatus: (orderId: string) => request<any>(`order/${encodeURIComponent(orderId)}`),
  health: () => request<any>("health"),
};

export function marketSymbol(market: WolvMarket) {
  return String(market.underlyingSymbol ?? market.underlyingTicker ?? market.underlyingAssetSymbol ?? market.tokenSymbol ?? market.symbol ?? "RWA").toUpperCase();
}

export function marketAddress(market: WolvMarket) {
  return String(market.tokenContractAddress ?? market.contractAddress ?? market.address ?? "");
}

export function marketName(market: WolvMarket) {
  return String(market.underlyingName ?? market.tokenName ?? market.name ?? marketSymbol(market));
}

export function marketPlatform(market: WolvMarket) {
  const platform = String(market.platformName ?? market.tokenPlatformName ?? market.platformId ?? market.platform ?? market.issuerName ?? market.issuer ?? market.providerName ?? market.provider ?? market.projectName ?? "Binance Web3");
  if (/^bstock$/i.test(platform)) return "bStocks";
  if (/^ondo$/i.test(platform)) return "Ondo";
  if (/^xstock$/i.test(platform)) return "xStocks";
  return platform;
}

export function isSupportedStockPlatform(value: string) {
  return /(?:b.?stocks?|ondo|x.?stocks?)/i.test(value);
}

export function marketPrice(market: WolvMarket) {
  const n = Number(market.tokenPrice ?? market.tokenPriceUsd ?? market.currentPrice ?? market.price ?? market.priceUsd);
  return Number.isFinite(n) ? n : null;
}

export function marketReferencePrice(market: WolvMarket) {
  const n = Number(market.referencePrice ?? market.referencePriceUsd ?? market.underlyingPrice ?? market.underlyingMarketPrice);
  return Number.isFinite(n) ? n : null;
}

export function marketChange(market: WolvMarket) {
  const n = Number(market.priceChange24h ?? market.priceChangePercent24h ?? market.change24h);
  return Number.isFinite(n) ? n : null;
}
