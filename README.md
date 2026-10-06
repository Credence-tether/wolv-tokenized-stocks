# WOLV Tokenized Stocks

WOLV is a mobile-first Expo Router app based on the supplied reference: dark trading-terminal UI, live tokenized-equity discovery, BSC spot quote and wallet-signing flows, address-linked portfolio, and transparent market analysis. The application does **not** fall back to fabricated quotes, sample holdings, simulated fills, or server-held wallet keys.

## Product surfaces

Five portrait-first bottom tabs—**Home, Markets, Trade, Portfolio, Wallet**—cover the reference’s home markets, instrument detail, time-range chart, issuer context, rules-based market read, quote/review flow, wallet connection and address portfolio. Markets distinguishes the token price from the underlying reference; an executable route price is shown only when the live trade-quote API returns one. The market-read panel uses explainable rules over returned values; it is not a generative AI model, recommendation, or return forecast.

The app is restricted to **BSC mainnet (chain ID 56)** and spot execution in supported tokenized-stock instruments from **bStocks, Ondo, or xStocks**. It contains no perpetuals, futures, leverage or short-selling route. Every approval, EVM transaction or RFQ typed-data signature is initiated and confirmed by the connected user wallet.

## Deployment boundary

The Expo app is developed in this task's mobile workspace. Manus production auto-publish is disabled. The intended production route is a **private GitHub repository imported by Vercel**: Vercel serves the static Expo web export and Node API function. Native Android/iOS distribution is a separate Expo build path; Vercel does not produce native binaries.

No production site has been published by this project. The temporary development preview is not the production host. The private GitHub repository is the source Vercel should deploy; no WOLV production website or API is hosted through Manus.

## Required configuration for live operation

The UI and transaction flows are implemented, but live authenticated data, quotes and orders remain configuration-dependent. Set these in **Vercel Project → Settings → Environment Variables**; never paste secrets into chat, the Expo client, `EXPO_PUBLIC_*`, or GitHub.

| Variable | Where | Purpose |
| --- | --- | --- |
| `BINANCE_WEB3_API_KEY` | Vercel server only | Binance Web3 API authentication |
| `BINANCE_WEB3_API_SECRET` | Vercel server only | HMAC signing secret; never bundled |
| `PUBLIC_APP_ORIGIN` | Vercel server only | Comma-separated exact production/preview origins allowed by the API |
| `BSC_RPC_URL` | Vercel server only (optional) | BSC RPC for token decimals and portfolio reads |
| `EXPO_PUBLIC_REOWN_PROJECT_ID` | Native build environment | Public Reown/WalletConnect project ID for mobile-wallet connection |
| `EXPO_PUBLIC_API_BASE_URL` | Native build environment | Deployed Vercel origin used by native API requests |
| `EXPO_PUBLIC_APP_URL` | Native build environment | Deployed web origin used for Reown universal-link metadata |
| `EXPO_PUBLIC_BSC_RPC_URL` | Public build environment (optional) | BSC RPC for native wallet metadata/network setup |

The Vercel web app calls `/api/wolv` on the same origin and can use an injected EIP-1193 wallet (for example, a wallet browser extension). Native builds use Reown AppKit/WalletConnect. The API server returns an explicit configuration error when Binance credentials are absent; it does not serve demo data. Use preview/production Binance keys with only the permissions needed for the chosen Web3 API products.

For Web requests, `PUBLIC_APP_ORIGIN` must include the exact site origin that will call the API. Include relevant Vercel preview origins when testing previews. Native calls have no browser `Origin` and are allowed by the server.

## Local checks and development

Requirements: Node.js 22 and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm test
pnpm build:web
pnpm dev
```

`pnpm build:web` exports static web files to `dist/`. `pnpm dev` starts the temporary Expo/Express development preview. No production Binance keys are expected in that workspace; authenticated market data and execution will show the configuration-required state until the user configures Vercel. No database or Manus authentication is used by the WOLV product screens.

## GitHub → Vercel web deployment

1. Keep the repository private and import its root into Vercel.
2. Use build command `pnpm build:web` and output directory `dist` (also declared in `vercel.json`).
3. Configure the server variables above in Vercel; set the public build variables before any native build.
4. Deploy a Vercel Preview and verify `/api/wolv/health`, authenticated markets, candles, portfolio, wallet connection and quote handling with the project’s own authorized API key and wallet.
5. Test a real order only when the user explicitly reviews and signs it in their own wallet. Do not use a live transaction as a deployment smoke test.

## Compliance and honest verification status

See [`docs/HACKATHON_COMPLIANCE.md`](docs/HACKATHON_COMPLIANCE.md). The app code follows the challenge’s BSC/spot/tokenized-stock scope, but does not determine participant eligibility or submit the project. The challenge’s Developer Experience Report must be completed from real onboarding and testing; use [`DEVELOPER_EXPERIENCE_REPORT_TEMPLATE.md`](DEVELOPER_EXPERIENCE_REPORT_TEMPLATE.md) without estimating or inventing observations.

The code has not been end-to-end verified against a live Binance API key or real wallet because no such credentials were provided to this development workspace. Complete the template’s “Honest status” section after Vercel configuration and real testing. Never claim an order filled unless Binance or the BSC transaction receipt confirms it.

## Environment file

Copy `.env.example` only to use the variable names locally. `.env` files are ignored by Git. The example keeps secret values blank; do not commit or share populated secrets.
