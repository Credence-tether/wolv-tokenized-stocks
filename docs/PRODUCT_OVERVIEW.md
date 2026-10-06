# WOLV Product Overview

WOLV is a mobile-first, BSC spot interface for tokenized stocks. It follows the supplied visual reference while prioritizing live data, route transparency, freshness and wallet-controlled signing.

The Home screen presents only instruments returned by the live Binance Web3 RWA API. Markets supports a live instrument list, token detail, underlying-reference versus token-price context, chart data and a rules-based market read. Trade requests a real quote and shows executable route pricing only when the API returns it; the user must explicitly sign through the connected wallet. Portfolio is tied to the connected address, on-chain balances and Binance Web3 DEX history. Wallet provides connection and chain state.

WOLV does not use mock prices or mock balances as fallback data. If the server credentials, provider, venue liquidity, market hours, token list, or RPC are unavailable, the UI reports that state. It does not claim that an unsigned quote is a filled trade. The stock-token context is accompanied by non-ownership/risk language, and the trade scope is BSC spot only.
