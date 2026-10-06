# WOLV Tokenized Stocks — Build Status

**Implementation status:** The mobile-first Expo app and Binance Web3 integration paths are implemented and compile. Real authenticated market data, wallet connection and transaction execution still require the user's Vercel API credentials and Reown project ID; no live trade or transaction has been submitted during development.

## Implemented

- [x] Recreated the supplied WOLV visual direction with a dark mobile trading-terminal UI and Home, Markets, Trade, Portfolio and Wallet tabs.
- [x] Connected the market, price, candle, quote, approval, swap/RFQ, portfolio and order-status flows to server-side Binance Web3 API handlers; no hard-coded price, sample holding or simulated fill fallback is shown.
- [x] Added live token detail, reference-vs-token price context, freshness, market status, chart ranges, issuer details and transparent rules-based analysis.
- [x] Limited scope to supported bStocks, Ondo and xStocks instruments on BNB Smart Chain mainnet (chain ID 56), spot only; no perps, leverage or short-selling routes.
- [x] Added native Reown/WalletConnect and browser-injected wallet adapters; approvals, transactions and typed-data signatures remain user-authorized in the wallet, and the server stores no private key.
- [x] Added Vercel static Expo export and serverless routing, safe blank environment-variable examples, and GitHub-to-Vercel setup guidance. Manus production publishing is disabled; the task preview is not the production host.
- [x] Added the hackathon compliance notes and a Developer Experience Report template that explicitly requires real observations rather than invented results.
- [x] Removed the unused starter OAuth callback/theme lab routes and simplified the preview server to the WOLV API only.
- [x] Validated TypeScript, lint, unit tests, and static web export. Current checks: 34 tests passed, one unrelated starter auth test skipped; 12 static routes exported.

## Remaining launch gates

- [ ] Add the Binance Web3 API key and HMAC secret in Vercel's **server-only** environment variables; configure the exact production origin and any required API permissions.
- [ ] Add a Reown/WalletConnect Project ID for native builds. For production native-store distribution, select an owned bundle identifier and deep-link scheme before shipping.
- [ ] Import the private GitHub source into Vercel, configure the web build, and deploy only after reviewing the exact public destination.
- [ ] Verify authenticated live markets, candles, wallet connection, quotes and user-signed BSC flows with the user's own authorized key and wallet. Do not use a live transaction as a smoke test.
- [ ] Complete the hackathon Developer Experience Report from actual onboarding and integration observations; confirm participant eligibility separately.
