# Binance Web3 API implementation notes

**Reference checked:** 2026-10-06. This file records the official API facts used by WOLV; it is not a claim that live credentials or endpoints have been tested.

## Official sources

- [BNB Chain Tokenized Stocks hackathon](https://www.bnbchain.org/en/hackathons/tokenized-stocks?tab=resources)
- [Binance Web3 RWA Data API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data)
- [Binance Web3 Trading API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api)
- [Binance Web3 Address Portfolio API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/address-portfolio)
- [Trading API integration flow](https://web3.binance.com/en/dev-docs/products/trading-api/integration-flow)
- [Binance Web3 authentication](https://web3.binance.com/en/dev-docs/authentication)
- [Market API introduction](https://web3.binance.com/en/dev-docs/products/market-api/introduction)

## RWA market data

- The RWA token list is `GET /api/v1/dex/market/rwa/tokens`; `binanceChainId=56` selects BSC. The documented `platformId` filter currently lists `ondo` and `bstock`.
- The token list includes contract address, platform, asset type, token and underlying ticker/name, decimals, token/share ratio, and nested status information. Documented asset types are `1=Stock`, `2=Pre-IPO`, `3=ETF`; WOLV admits stock/ETF types and excludes pre-IPO listings.
- The price endpoint is `GET /api/v1/dex/market/rwa/price` with `binanceChainId` and comma-separated `tokenContractAddresses` (maximum 100). It returns `tokenPrice`, `referencePrice`, and `tokenPriceUpdatedAt`.
- Binance describes `referencePrice` as an underlying reference price, per-share converted from the on-chain token price—not an official quote from a traditional stock market. WOLV labels it accordingly and does not call it an executable route price.
- The API docs describe bStocks and Ondo identifiers. WOLV does not hard-code or invent xStocks listings; it can display xStocks only if they are returned by the configured upstream listing.
- The Market API has `GET /api/v1/dex/market/candles`. Chart values are intended to come from that upstream response only; WOLV must not synthesize or seed a price series.

## Wallet portfolio

- The documented address DEX history endpoint is `GET /api/v1/dex/market/portfolio/dex-history` with `binanceChainId` and `walletAddress`. Its data includes `transactionList`; `type` `1` means buy and `2` means sell, and rows can include token amount, USD value, execution price, transaction hash, and Unix-millisecond time.
- Current balances in this implementation are read from BSC ERC-20 contracts with `balanceOf(address)` for contracts from the current supported RWA listing; USD values are computed only when the RWA price API returns a price. This is intentionally a scoped stock-token view, not a claim to show the wallet's complete portfolio.

## Trade and signing flow

- `GET /api/v1/dex/aggregator/quote` accepts chain ID, input/output contract addresses, input amount in smallest units, and the connected `userWalletAddress` for RWA routes. Quote routes provide a per-route `quoteId` (about 30-second TTL), vendor, `executionMode`, base-unit output amount, and optional fee/gas/impact data.
- The trading reference states equity/RWA assets use the RFQ flow. `/swap` returns either unsigned transaction data or an RFQ payload with `typedDataToSign`; the latter is signed locally using EIP-712, posted to `/api/v1/dex/aggregator/order/submit` with vendor, quote ID and request ID, then checked with `/api/v1/dex/aggregator/order/{orderId}`.
- For RWA/RFQ approvals, Binance documents a vendor-specific `GET /api/v1/dex/aggregator/approve-transaction` call using the vendor name returned by the quote. WOLV reads allowance before prompting for a precise-amount approval; it does not request unlimited allowance.
- `/swap` needs a slippage value (or `autoSlippage=true`); the UI exposes a narrow, explicit set of user-selectable values and shows the chosen value before the wallet prompt.
- All private signing remains in the connected wallet. Binance API credentials are server-only and belong in Vercel environment variables. WOLV never requests a seed phrase or private key.
- Binance's integration guide also documents its Transaction API as a way to broadcast a signed transaction. The current EVM wallet path submits through the connected wallet provider so the wallet signs and broadcasts directly; this does not upload a private key or raw signing secret to WOLV.

## Authentication

The server adapter uses Binance's documented `X-OC-APIKEY`, ISO-8601 millisecond `X-OC-TIMESTAMP`, `X-OC-SIGN`, and `X-OC-RECV-WINDOW` headers. The signature is Base64 HMAC-SHA256 using the exact `/build` URL path (including query string), HTTP method and request body. Credentials are never exposed as `EXPO_PUBLIC_*` values.
