# WOLV Tokenized Stocks — Build Plan

## Scope and delivery target

Build a functioning Expo/React Native mobile-first app, closely following the supplied WOLV reference, with live Binance Web3 API data and user-signed BSC spot execution paths. Use the existing Webdev Expo preview only during development; production auto-publish on Manus remains off. The web app is packaged as an Expo static web export for GitHub → Vercel. Native iOS/Android distribution remains a separate Expo build path. Binance API secrets belong in Vercel server environment variables, never in the mobile bundle or Manus project.

The app must not silently fall back to sample prices, fake holdings, fabricated fills, or simulated success. If API or wallet configuration is absent, show an actionable configuration/error state and keep live trading disabled.

## Product and hackathon constraints

- Keep tokenized equities from bStocks, Ondo, or xStocks central; dynamically use supported tokens returned by Binance Web3 RWA APIs.
- BSC mainnet only (`binanceChainId=56`) for tokenized-stock execution; spot only. Do not add perpetual/futures routes.
- Use the Binance Web3 API for RWA data and trading. Signed API requests are generated server-side using HMAC-SHA256 and server-only credentials.
- The client displays the quote and route, then the user’s connected wallet signs the EVM transaction or RFQ EIP-712 payload. Do not custody keys or sign/broadcast without explicit user action.
- Market analytics distinguish on-chain token price, underlying reference price, market status, quote age, venue, and spread. Label values as live only when returned by the API.
- Provide a structured Developer Experience Report template; the user must fill it from real API onboarding and testing. Do not invent feedback or claim unsupported results.
- Hackathon page identifies the event as 16 Sep–11 Oct 2026 and lists restricted jurisdictions including the US, Canada, Netherlands, UK, Japan, Iran, Cuba, North Korea, Crimea, Donetsk and Luhansk. The app build does not establish participant eligibility; do not submit or represent an entry on the user’s behalf.

## Design

- **Design movement:** institutional trading terminal meets restrained neo-industrial fintech.
- **Core principles:** evidence before excitement; dense data with clear hierarchy; one-handed mobile actions; execution risk is always visible.
- **Color philosophy:** near-black/navy conveys instrument-panel focus; warm amber marks the primary action and active selection; green indicates positive movement only; muted blue borders and cool gray text separate structure without visual noise.
- **Layout paradigm:** a portrait, vertically scrolling instrument panel anchored by five-thumb-zone bottom tabs; charts and quote details form stacked full-width cards rather than a shrunken desktop grid.
- **Signature elements:** circular W monogram; a restrained orbital-data hero motif; paired reference/executable price rows with a visible spread badge.
- **Interaction philosophy:** each market card opens token details; quote inputs update estimates only after a live API response; a clear review step precedes any wallet signature; errors and market closures remain actionable and explicit.
- **Animation:** subtle 120–180 ms fades/slides for tab and card transitions; chart animates only when a live series loads; no artificial ticker motion or success confetti.
- **Typography:** platform system sans for labels and copy, bold system headlines, tabular numerals for quotes and holdings; monospaced presentation for addresses and transaction hashes.
- **Brand essence:** WOLV helps mobile users inspect and route tokenized-equity spot trades on BSC with cross-venue context; **clear, composed, rigorous**.
- **Brand voice:** concise, evidence-led, never a promise of returns. Examples: “Find the price. See the execution.” “Review the route. Sign only when you’re ready.”
- **Wordmark & mark:** a custom W inside a thin circular ring, rendered in amber on near-black; keep the symbol distinct from platform branding.
- **Signature brand color:** WOLV amber (`#FFC400`).

## Application structure

- `app/(tabs)/`: Home, Markets, Trade, Portfolio, and Wallet screens; token detail and market-read views use selected-symbol state/query parameters within static routes so Expo can export them to Vercel.
- `components/wolv-ui.tsx`: shared WOLV cards, price rows, status badges, buttons, and loading/error states.
- `lib/wolv-api.ts` and `lib/market-data.ts`: typed live API client and query helpers; never include Binance credentials.
- `lib/wallet/`: Reown/WalletConnect connection and signing abstractions; never persists private keys.
- `server/_core/wolv-api.ts`: reusable Binance signed-request client and domain handlers for the Webdev Express preview.
- `api/wolv/[...path].ts`: Vercel-compatible wrapper over the same domain handlers.
- `tests/wolv-api.test.ts`: deterministic signature construction, route validation, missing-secret and origin-policy tests using synthetic vectors only.
- `vercel.json`, `.env.example`, `README.md`: Expo web export, Vercel function/static routing, required environment names, GitHub/Vercel setup.
- `DEVELOPER_EXPERIENCE_REPORT_TEMPLATE.md`: hackathon report prompts with blanks for the builder’s actual observations.

## Runtime and security decisions

- Expo web static export is the Vercel-hosted responsive web surface. Native Android/iOS builds use Expo; Vercel does not create native release binaries.
- Vercel functions own authenticated Binance calls. Only browser-safe `EXPO_PUBLIC_*` values may enter the app bundle; `BINANCE_WEB3_API_KEY` and `BINANCE_WEB3_API_SECRET` stay server-side.
- BSC chain ID 56 is fixed for stock trading. Do not trust a client-provided chain ID for execution.
- Support Binance `SWAP` and `RFQ` modes as returned by the API. RFQ execution signs typed data in the wallet and submits the signature; AMM execution signs the returned transaction. Reflect pending/filled/failed state only from actual API or chain responses.
- No automatic trades, perps, hosted private keys, hard-coded API data, or fake wallet balances.
- Manus production auto-publish remains disabled. Keep the Manus-managed mobile source as canonical and, when ready, use a private GitHub mirror for Vercel deployment; production deployment and secret entry remain separate user-controlled steps.
