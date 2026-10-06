# Hackathon Scope & Compliance Notes

## Official challenge

The target is the [BNB Hack: Tokenized Stocks Edition](https://www.bnbchain.org/en/hackathons/tokenized-stocks?tab=overview), with supporting resources at [the official resources tab](https://www.bnbchain.org/en/hackathons/tokenized-stocks?tab=resources) and track guidance at [the tracks tab](https://www.bnbchain.org/en/hackathons/tokenized-stocks?tab=tracks).

The selected product direction is a user-controlled, spot-only mobile interface for tokenized stocks on BSC. The original reference is a WOLV trading/market-analysis terminal. Use bStocks, Ondo, and/or xStocks only where the live Binance Web3 RWA listing and trade API expose supported instruments. The app targets BSC mainnet (`binanceChainId=56`) and deliberately has no perpetual/futures trading.

The hackathon page states the event window as 16 September–11 October 2026. It lists geographic restrictions (including the United States, Canada, Netherlands, United Kingdom, Japan, Iran, Cuba, North Korea, Crimea, Donetsk, and Luhansk). This build cannot determine any participant’s eligibility, and does not submit the user’s project or claim compliance certification.

## API and signing approach

Official references: [Binance Web3 API authentication](https://web3.binance.com/en/dev-docs/authentication), [RWA Data API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data), [Trading API integration flow](https://web3.binance.com/en/dev-docs/products/trading-api/integration-flow), and [Address Portfolio API](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/address-portfolio).

The server adapter uses the documented request authentication pattern: HMAC-SHA256 over `timestamp + HTTP method + request path (including /build and the exact query string) + exact JSON body`, Base64-encoded in `X-OC-SIGN`. Credentials are read from server-only `BINANCE_WEB3_API_KEY` and `BINANCE_WEB3_API_SECRET`. The client never sees these values. The implementation targets the documented RWA token list/prices, token candles, address-specific DEX history, aggregator quote/swap, RFQ order submission/status, on-chain token balances, and wallet signing flows.

Trade safety: a quote is not an order. The user must select a live route and explicitly trigger a wallet signature. The app never stores seed phrases/private keys or claims a fill without an API/chain confirmation. A Binance API key with the required permissions and a Reown/WalletConnect Project ID are deployment prerequisites; no credentials were available for live API verification during code generation.

## Hosting model

[Expo static rendering documentation](https://docs.expo.dev/router/reference/static-rendering/) confirms `web.output = "static"` produces a `dist` export suitable for Vercel. WOLV uses separate Vercel Node functions for signed Binance API calls; Vercel hosts the web export and API, while native iOS/Android release binaries still require an Expo build. Manus production auto-publish is left disabled.

## Developer Experience Report

The challenge requests developer experience feedback. A blank template is provided in `DEVELOPER_EXPERIENCE_REPORT_TEMPLATE.md`; complete it only after real key onboarding, endpoint testing, wallet signing, and deployment. Do not treat this technical documentation review as a substitute for hands-on experience or invent timing/feedback.
