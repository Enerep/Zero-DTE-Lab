# Architecture

Zero DTE Lab is a client-side simulator with a small deterministic market engine, simplified options pricing, and UI state for trades, events, and education.

## Main Modules

- `marketEngine`: advances fake stock price once per second.
- `eventEngine`: injects random market events and changes drift, volatility, or IV.
- `optionsEngine`: builds the call/put chain and recalculates price, Greeks, IV, and theta.
- `portfolioEngine`: tracks cash, open positions, closed trades, and P/L.
- `explanationEngine`: creates simple educational summaries after trades close.
- `ui`: renders chart, chain, portfolio, feed, history, and trade controls.

## State Model

- `clock`: current simulated time and expiration time.
- `ticker`: symbol, price, trend, realized volatility.
- `marketEvents`: active and historical events.
- `optionsChain`: strikes with call and put contracts.
- `account`: starting cash, current cash, realized P/L.
- `positions`: open option contracts.
- `trades`: completed trade records and explanations.

## Simulation Loop

Every second:

1. Advance the clock.
2. Update fake stock price.
3. Possibly create or expire market events.
4. Reprice option contracts.
5. Update portfolio market value and unrealized P/L.
6. Render the latest state.

## Simplified Options Logic

- Intrinsic value:
  - Call: `max(0, stockPrice - strike)`
  - Put: `max(0, strike - stockPrice)`
- Extrinsic value decreases as expiration approaches.
- Higher IV increases extrinsic value.
- Delta is approximated from moneyness.
- Gamma is highest near the money.
- Theta is negative and accelerates near expiration.
- Vega rises with IV sensitivity and time remaining.

## Trade Flow

1. User selects a contract from the options chain.
2. User buys to open using fake cash.
3. Position value updates with stock movement, IV, Greeks, and theta decay.
4. User sells to close before expiration, or the contract expires.
5. Closed trade gets realized P/L and an educational explanation.

## Guardrails

- Always label the experience as simulated.
- Do not connect to real brokers, real accounts, or live market data in the initial version.
- Do not present output as financial advice.
- Keep formulas realistic enough to teach directionally, but simple enough to understand.
