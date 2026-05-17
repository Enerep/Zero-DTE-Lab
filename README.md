# Zero DTE Lab

Zero DTE Lab is a fake real-time options trading simulator for learning same-day options behavior without using real money.

The app is educational only and is not financial advice.

## Goal

Build a fast trading-game interface where users can practice buying and selling simplified 0DTE call and put contracts on one fake ticker.

## Core Features

- Fake stock ticker with price updates every second.
- Simulated options chain with calls, puts, strikes, Greeks, IV, bid, ask, and mid.
- Paper cash account for opening and closing option trades.
- Portfolio view with cash, positions, market value, realized P/L, and unrealized P/L.
- Expiration countdown with visible theta decay.
- Random market events: news, earnings, volatility spike, IV crush, trend reversal.
- Event feed and trade history.
- Post-trade AI-style explanation of why a closed trade won or lost.

## Initial Scope

- One fake ticker.
- One same-day expiration.
- A small strike ladder around the current fake stock price.
- Long option trades first: buy to open, sell to close.
- Simplified pricing logic, not broker-grade modeling.

## UX Shape

The first screen should be the simulator, not a marketing page.

Main panels:

- Live chart
- Options chain
- Portfolio
- Event feed
- Trade history
- Trade explanation modal or drawer

## Development Notes

- Keep the simulation deterministic enough to debug, but random enough to feel alive.
- Keep all trading copy educational and avoid real-money advice.
- Prefer clear, inspectable formulas over complex financial modeling.
- Design for future LLM contributors: small modules, named state transitions, and concise docs.
