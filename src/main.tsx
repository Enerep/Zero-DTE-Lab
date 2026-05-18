import { StrictMode, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeDollarSign,
  BellRing,
  Bot,
  Clock3,
  History,
  LineChart,
  WalletCards
} from "lucide-react";
import "./styles.css";

type OptionSide = "call" | "put";
type EventKind = "earnings" | "news" | "vol-spike" | "iv-crush" | "reversal";

type Contract = {
  id: string;
  side: OptionSide;
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
};

type Position = {
  id: string;
  contractId: string;
  side: OptionSide;
  strike: number;
  quantity: number;
  entryPrice: number;
  openedAt: number;
};

type ClosedTrade = Position & {
  exitPrice: number;
  closedAt: number;
  realizedPl: number;
  explanation: string;
};

type MarketEvent = {
  id: string;
  kind: EventKind;
  title: string;
  impact: string;
  createdAt: number;
  ttl: number;
};

type SimState = {
  tick: number;
  price: number;
  history: number[];
  drift: number;
  baseIv: number;
  cash: number;
  positions: Position[];
  trades: ClosedTrade[];
  events: MarketEvent[];
};

const STARTING_CASH = 10000;
const START_PRICE = 100;
const EXPIRATION_SECONDS = 390;
const CONTRACT_MULTIPLIER = 100;

const eventTemplates: Record<EventKind, Omit<MarketEvent, "id" | "kind" | "createdAt" | "ttl">> = {
  earnings: {
    title: "Mock earnings rumor",
    impact: "IV rises and price movement gets jumpier."
  },
  news: {
    title: "Breaking fake headline",
    impact: "A short directional push hits the ticker."
  },
  "vol-spike": {
    title: "Volatility spike",
    impact: "Option premiums expand even without a big move."
  },
  "iv-crush": {
    title: "IV crush",
    impact: "Extrinsic value drops across the chain."
  },
  reversal: {
    title: "Trend reversal",
    impact: "The current price drift flips direction."
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dollars(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
}

function signedDollars(value: number) {
  return `${value >= 0 ? "+" : ""}${dollars(value)}`;
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function priceOption(side: OptionSide, stockPrice: number, strike: number, secondsLeft: number, baseIv: number): Contract {
  const intrinsic = side === "call" ? Math.max(0, stockPrice - strike) : Math.max(0, strike - stockPrice);
  const timeRatio = clamp(secondsLeft / EXPIRATION_SECONDS, 0, 1);
  const moneynessDistance = Math.abs(stockPrice - strike);
  const atmFactor = clamp(1 - moneynessDistance / 18, 0.08, 1);
  const iv = clamp(baseIv + atmFactor * 0.18, 0.12, 1.6);
  const extrinsic = Math.max(0.03, atmFactor * iv * 4.2 * Math.sqrt(timeRatio));
  const mid = Math.max(0.01, intrinsic + extrinsic);
  const spread = clamp(mid * 0.06, 0.03, 0.4);
  const direction = side === "call" ? 1 : -1;
  const rawDelta = side === "call" ? 0.5 + (stockPrice - strike) / 18 : -0.5 + (stockPrice - strike) / 18;

  return {
    id: `${side}-${strike}`,
    side,
    strike,
    bid: Math.max(0.01, mid - spread / 2),
    ask: mid + spread / 2,
    mid,
    delta: clamp(rawDelta, side === "call" ? 0.03 : -0.97, side === "call" ? 0.97 : -0.03),
    gamma: atmFactor * 0.08,
    theta: -Math.max(0.01, atmFactor * iv * (1.2 - timeRatio) * 0.12),
    vega: atmFactor * timeRatio * 0.18,
    iv: iv * direction * direction
  };
}

function buildChain(price: number, secondsLeft: number, baseIv: number) {
  const center = Math.round(price / 5) * 5;
  const strikes = [-10, -5, 0, 5, 10].map((offset) => center + offset);
  return strikes.map((strike) => ({
    strike,
    call: priceOption("call", price, strike, secondsLeft, baseIv),
    put: priceOption("put", price, strike, secondsLeft, baseIv)
  }));
}

function getContract(chain: ReturnType<typeof buildChain>, contractId: string) {
  for (const row of chain) {
    if (row.call.id === contractId) return row.call;
    if (row.put.id === contractId) return row.put;
  }
  return null;
}

function explainTrade(trade: Omit<ClosedTrade, "explanation">, exitReason: string) {
  const won = trade.realizedPl >= 0;
  const direction = trade.side === "call" ? "bullish call" : "bearish put";
  const priceMove = trade.exitPrice > trade.entryPrice ? "premium expanded" : "premium contracted";
  const outcome = won ? "won" : "lost";
  return `This ${direction} ${outcome} because the option ${priceMove} before close. ${exitReason} Entry was ${dollars(
    trade.entryPrice
  )}, exit was ${dollars(trade.exitPrice)}, for ${signedDollars(trade.realizedPl)} after contract multiplier.`;
}

function createEvent(tick: number, drift: number): { event: MarketEvent; drift: number; ivMove: number; jump: number } {
  const kinds: EventKind[] = ["earnings", "news", "vol-spike", "iv-crush", "reversal"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const template = eventTemplates[kind];

  const effects = {
    earnings: { drift, ivMove: 0.18, jump: (Math.random() - 0.5) * 2.8 },
    news: { drift: drift + (Math.random() > 0.5 ? 0.08 : -0.08), ivMove: 0.04, jump: (Math.random() - 0.5) * 1.8 },
    "vol-spike": { drift, ivMove: 0.22, jump: 0 },
    "iv-crush": { drift, ivMove: -0.24, jump: 0 },
    reversal: { drift: -drift || (Math.random() > 0.5 ? 0.06 : -0.06), ivMove: 0.02, jump: (Math.random() - 0.5) * 1.2 }
  } satisfies Record<EventKind, { drift: number; ivMove: number; jump: number }>;

  return {
    event: {
      id: `${kind}-${tick}-${Math.random().toString(16).slice(2)}`,
      kind,
      title: template.title,
      impact: template.impact,
      createdAt: tick,
      ttl: 28
    },
    ...effects[kind]
  };
}

function initialState(): SimState {
  return {
    tick: 0,
    price: START_PRICE,
    history: Array.from({ length: 36 }, (_, index) => START_PRICE + Math.sin(index / 4) * 0.4),
    drift: 0.03,
    baseIv: 0.42,
    cash: STARTING_CASH,
    positions: [],
    trades: [],
    events: [
      {
        id: "open",
        kind: "news",
        title: "Opening bell simulation",
        impact: "Fake ticker ZLAB starts with one same-day expiration.",
        createdAt: 0,
        ttl: 999
      }
    ]
  };
}

function App() {
  const [state, setState] = useState(initialState);

  const secondsLeft = Math.max(0, EXPIRATION_SECONDS - state.tick);
  const chain = useMemo(() => buildChain(state.price, secondsLeft, state.baseIv), [state.price, secondsLeft, state.baseIv]);

  const positionValue = state.positions.reduce((sum, position) => {
    const contract = getContract(chain, position.contractId);
    return sum + (contract?.bid ?? 0) * position.quantity * CONTRACT_MULTIPLIER;
  }, 0);

  const unrealizedPl = state.positions.reduce((sum, position) => {
    const contract = getContract(chain, position.contractId);
    return sum + (((contract?.bid ?? 0) - position.entryPrice) * position.quantity * CONTRACT_MULTIPLIER);
  }, 0);

  const realizedPl = state.trades.reduce((sum, trade) => sum + trade.realizedPl, 0);
  const accountValue = state.cash + positionValue;
  const latestExplanation = state.trades[0]?.explanation;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => {
        const nextTick = current.tick + 1;
        const nextSecondsLeft = Math.max(0, EXPIRATION_SECONDS - nextTick);
        let nextDrift = current.drift * 0.985;
        let nextIv = clamp(current.baseIv * 0.996, 0.18, 1.25);
        let jump = 0;
        let nextEvents = current.events
          .map((event) => ({ ...event, ttl: event.ttl - 1 }))
          .filter((event) => event.ttl > 0);

        if (Math.random() < 0.08 && nextSecondsLeft > 20) {
          const created = createEvent(nextTick, nextDrift);
          nextDrift = created.drift;
          nextIv = clamp(nextIv + created.ivMove, 0.18, 1.25);
          jump = created.jump;
          nextEvents = [created.event, ...nextEvents].slice(0, 8);
        }

        const noise = (Math.random() - 0.5) * (0.34 + nextIv * 0.46);
        const nextPrice = Math.max(35, current.price + nextDrift + noise + jump);
        const nextHistory = [...current.history.slice(-59), nextPrice];
        const nextChain = buildChain(nextPrice, nextSecondsLeft, nextIv);

        if (nextSecondsLeft === 0 && current.positions.length > 0) {
          const expiredTrades = current.positions.map((position) => {
            const contract = getContract(nextChain, position.contractId);
            const exitPrice = contract?.bid ?? 0;
            const realizedPl = (exitPrice - position.entryPrice) * position.quantity * CONTRACT_MULTIPLIER;
            const trade = {
              ...position,
              exitPrice,
              closedAt: nextTick,
              realizedPl
            };
            return {
              ...trade,
              explanation: explainTrade(trade, "The position was closed automatically at expiration.")
            };
          });

          return {
            ...current,
            tick: nextTick,
            price: nextPrice,
            history: nextHistory,
            drift: nextDrift,
            baseIv: nextIv,
            positions: [],
            trades: [...expiredTrades, ...current.trades],
            cash: current.cash + expiredTrades.reduce((sum, trade) => sum + trade.exitPrice * trade.quantity * CONTRACT_MULTIPLIER, 0),
            events: [
              {
                id: `expiration-${nextTick}`,
                kind: "iv-crush" as const,
                title: "Expiration reached",
                impact: "Open positions were marked to their final bid value.",
                createdAt: nextTick,
                ttl: 999
              },
              ...nextEvents
            ].slice(0, 8)
          };
        }

        return {
          ...current,
          tick: nextTick,
          price: nextPrice,
          history: nextHistory,
          drift: nextDrift,
          baseIv: nextIv,
          events: nextEvents
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function buyContract(contract: Contract) {
    const cost = contract.ask * CONTRACT_MULTIPLIER;
    if (state.cash < cost || secondsLeft === 0) return;

    setState((current) => ({
      ...current,
      cash: current.cash - cost,
      positions: [
        ...current.positions,
        {
          id: `pos-${current.tick}-${contract.id}-${Math.random().toString(16).slice(2)}`,
          contractId: contract.id,
          side: contract.side,
          strike: contract.strike,
          quantity: 1,
          entryPrice: contract.ask,
          openedAt: current.tick
        }
      ]
    }));
  }

  function closePosition(position: Position) {
    const liveChain = buildChain(state.price, secondsLeft, state.baseIv);
    const contract = getContract(liveChain, position.contractId);
    const exitPrice = contract?.bid ?? 0;
    const realizedPlForTrade = (exitPrice - position.entryPrice) * position.quantity * CONTRACT_MULTIPLIER;
    const trade = {
      ...position,
      exitPrice,
      closedAt: state.tick,
      realizedPl: realizedPlForTrade
    };

    setState((current) => ({
      ...current,
      cash: current.cash + exitPrice * position.quantity * CONTRACT_MULTIPLIER,
      positions: current.positions.filter((item) => item.id !== position.id),
      trades: [
        {
          ...trade,
          explanation: explainTrade(trade, "You manually sold to close before expiration.")
        },
        ...current.trades
      ]
    }));
  }

  function resetSim() {
    setState(initialState());
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Simulated paper trading</p>
          <h1>Zero DTE Lab</h1>
        </div>
        <div className="status-strip">
          <Metric label="ZLAB" value={dollars(state.price)} accent={state.drift >= 0 ? "good" : "bad"} />
          <Metric label="Expires" value={formatSeconds(secondsLeft)} />
          <Metric label="Account" value={dollars(accountValue)} accent={accountValue >= STARTING_CASH ? "good" : "bad"} />
        </div>
        <button className="ghost-button" onClick={resetSim}>
          Reset
        </button>
      </header>

      <section className="disclaimer">Educational simulator only. No real market data, no real orders, no financial advice.</section>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelTitle icon={<LineChart size={18} />} title="Live Chart" meta="1s ticks" />
          <PriceChart values={state.history} />
        </section>

        <section className="panel chain-panel">
          <PanelTitle icon={<Activity size={18} />} title="Options Chain" meta={`IV ${(state.baseIv * 100).toFixed(0)}%`} />
          <OptionsChain rows={chain} onBuy={buyContract} disabled={secondsLeft === 0} />
        </section>

        <section className="panel portfolio-panel">
          <PanelTitle icon={<WalletCards size={18} />} title="Portfolio" meta={`${state.positions.length} open`} />
          <div className="portfolio-metrics">
            <Metric label="Cash" value={dollars(state.cash)} />
            <Metric label="Open value" value={dollars(positionValue)} />
            <Metric label="Unrealized" value={signedDollars(unrealizedPl)} accent={unrealizedPl >= 0 ? "good" : "bad"} />
            <Metric label="Realized" value={signedDollars(realizedPl)} accent={realizedPl >= 0 ? "good" : "bad"} />
          </div>
          <div className="positions-list">
            {state.positions.length === 0 ? (
              <p className="empty">No open contracts.</p>
            ) : (
              state.positions.map((position) => {
                const contract = getContract(chain, position.contractId);
                const pl = ((contract?.bid ?? 0) - position.entryPrice) * CONTRACT_MULTIPLIER;
                return (
                  <div className="position-row" key={position.id}>
                    <span>
                      {position.side.toUpperCase()} {position.strike}
                    </span>
                    <span className={pl >= 0 ? "good" : "bad"}>{signedDollars(pl)}</span>
                    <button onClick={() => closePosition(position)}>Sell</button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="panel events-panel">
          <PanelTitle icon={<BellRing size={18} />} title="Event Feed" meta="randomized" />
          <div className="feed">
            {state.events.map((event) => (
              <article key={event.id} className="feed-item">
                <span>{event.title}</span>
                <p>{event.impact}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel history-panel">
          <PanelTitle icon={<History size={18} />} title="Trade History" meta={`${state.trades.length} closed`} />
          <div className="history-list">
            {state.trades.length === 0 ? (
              <p className="empty">Closed trades will appear here.</p>
            ) : (
              state.trades.slice(0, 6).map((trade) => (
                <div className="history-row" key={`${trade.id}-${trade.closedAt}`}>
                  <span>
                    {trade.side.toUpperCase()} {trade.strike}
                  </span>
                  <span className={trade.realizedPl >= 0 ? "good" : "bad"}>{signedDollars(trade.realizedPl)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel explanation-panel">
          <PanelTitle icon={<Bot size={18} />} title="AI-Style Explanation" meta="after close" />
          <p>{latestExplanation ?? "Close a trade to get a short educational reason for the result."}</p>
        </section>

        <section className="panel clock-panel">
          <PanelTitle icon={<Clock3 size={18} />} title="Greeks Snapshot" meta="chain avg" />
          <GreekSummary rows={chain} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "good" | "bad" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={accent}>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) {
  return (
    <div className="panel-title">
      <span className="title-left">
        {icon}
        {title}
      </span>
      <span>{meta}</span>
    </div>
  );
}

function PriceChart({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 88 - 6;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Fake ZLAB price chart">
        <polyline className="chart-grid" points="0,25 100,25" />
        <polyline className="chart-grid" points="0,50 100,50" />
        <polyline className="chart-grid" points="0,75 100,75" />
        <polyline className="chart-line" points={points} />
      </svg>
      <div className="chart-axis">
        <span>{dollars(max)}</span>
        <span>{dollars(min)}</span>
      </div>
    </div>
  );
}

function OptionsChain({
  rows,
  onBuy,
  disabled
}: {
  rows: ReturnType<typeof buildChain>;
  onBuy: (contract: Contract) => void;
  disabled: boolean;
}) {
  return (
    <div className="chain-table">
      <div className="chain-header">
        <span>Call</span>
        <span>Strike</span>
        <span>Put</span>
      </div>
      {rows.map((row) => (
        <div className="chain-row" key={row.strike}>
          <ContractButton contract={row.call} onBuy={onBuy} disabled={disabled} />
          <strong>{row.strike}</strong>
          <ContractButton contract={row.put} onBuy={onBuy} disabled={disabled} />
        </div>
      ))}
    </div>
  );
}

function ContractButton({
  contract,
  onBuy,
  disabled
}: {
  contract: Contract;
  onBuy: (contract: Contract) => void;
  disabled: boolean;
}) {
  return (
    <button className="contract-button" onClick={() => onBuy(contract)} disabled={disabled}>
      <span>
        <BadgeDollarSign size={14} />
        {dollars(contract.ask)}
      </span>
      <small>
        D {contract.delta.toFixed(2)} T {contract.theta.toFixed(2)}
      </small>
    </button>
  );
}

function GreekSummary({ rows }: { rows: ReturnType<typeof buildChain> }) {
  const contracts = rows.flatMap((row) => [row.call, row.put]);
  const avg = (key: keyof Pick<Contract, "delta" | "gamma" | "theta" | "vega" | "iv">) =>
    contracts.reduce((sum, contract) => sum + Math.abs(contract[key]), 0) / contracts.length;

  return (
    <div className="greek-grid">
      <Metric label="Delta" value={avg("delta").toFixed(2)} />
      <Metric label="Gamma" value={avg("gamma").toFixed(3)} />
      <Metric label="Theta" value={avg("theta").toFixed(3)} accent="bad" />
      <Metric label="Vega" value={avg("vega").toFixed(3)} />
      <Metric label="IV" value={`${(avg("iv") * 100).toFixed(0)}%`} />
    </div>
  );
}

export default App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
