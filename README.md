# Crypto Market Analyzer (Stage 2: live data + chart)
Educational tool. Not financial advice. No signal is a guaranteed profit; you can lose money. Paper/learning use only; no orders are ever placed.

## Run locally
```
npm install
npm test        # Stage 1 logic tests + Stage 2 data/chart-data tests
npm run dev     # open the printed local URL
npm run build   # type-checks then builds to dist/
npm run preview # serve the production build
```
To test on an Android phone on the same Wi-Fi: `npm run dev -- --host`, then open the printed Network URL.

## Structure
- `src/lib/` Stage 1 logic (indicators, risk, signal). Unchanged.
- `src/data/config.ts` pairs and timeframes. Add a pair by adding one line to `PAIRS`.
- `src/data/binance.ts` public Binance client: validation, ordering, dedupe, rate-limit and error handling.
- `src/hooks/useMarketData.ts` history load, 5-second polling, merge by timestamp, stale detection.
- `src/chart/` Lightweight Charts wrapper (created once, updated incrementally, removed on unmount).

## Data behaviour
- Uses only public market-data endpoints (`data-api.binance.vision`, falling back to `api.binance.com`). No key needed.
- If Binance fails (network, rate limit, region block) the app shows an error and keeps the last real data marked Stale/Offline. It never shows invented prices.
- The forming candle is drawn grey and may change until it closes. "Closed" is decided from your device clock, so a badly wrong clock can mislabel the latest candle.
- Some networks and regions block Binance (HTTP 451/403); the app reports this.

## Attribution
Charts by TradingView Lightweight Charts™ (link shown in the footer). Keep it when deploying.

## Not yet built
Indicators on the chart, setup assessment UI, trade calculator UI, paper trading, learning panel (Stages 3-4). GitHub Pages deployment steps arrive in Stage 4; `base: './'` is already set.
