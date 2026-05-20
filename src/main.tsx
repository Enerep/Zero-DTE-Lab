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
import { CONTRACT_MULTIPLIER, STARTING_CASH } from "./constants";
import { advanceMarket, getSecondsLeft, initialState } from "./engines/marketEngine";
import { buildChain, getContract } from "./engines/optionsEngine";
import {
  buyToOpen,
  getPositionValue,
  getRealizedPl,
  getUnrealizedPl,
  sellToClose
} from "./engines/portfolioEngine";
import { dollars, formatSeconds, signedDollars } from "./lib/format";
import type { Candle, ChainRow, Contract, Position } from "./types";
import "./styles.css";

function App() {
  const [state, setState] = useState(initialState);

  const secondsLeft = getSecondsLeft(state.tick);
  const chain = useMemo(() => buildChain(state.price, secondsLeft, state.baseIv), [state.price, secondsLeft, state.baseIv]);
  const positionValue = getPositionValue(state.positions, chain);
  const unrealizedPl = getUnrealizedPl(state.positions, chain);
  const realizedPl = getRealizedPl(state);
  const accountValue = state.cash + positionValue;
  const latestExplanation = state.trades[0]?.explanation;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState(advanceMarket);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function buyContract(contract: Contract) {
    setState((current) => buyToOpen(current, contract, getSecondsLeft(current.tick)));
  }

  function closePosition(position: Position) {
    setState((current) => sellToClose(current, position, getSecondsLeft(current.tick)));
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
          <PanelTitle icon={<LineChart size={18} />} title="Live Chart" meta="5s candles" />
          <CandlestickChart candles={state.candles} />
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

function CandlestickChart({ candles }: { candles: Candle[] }) {
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const range = Math.max(1, max - min);
  const candleWidth = Math.max(0.9, 70 / Math.max(1, candles.length));
  const yFor = (value: number) => 100 - ((value - min) / range) * 88 - 6;

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Fake ZLAB candlestick chart">
        <polyline className="chart-grid" points="0,25 100,25" />
        <polyline className="chart-grid" points="0,50 100,50" />
        <polyline className="chart-grid" points="0,75 100,75" />
        {candles.map((candle, index) => {
          const x = (index / Math.max(1, candles.length - 1)) * 82 + 4;
          const openY = yFor(candle.open);
          const closeY = yFor(candle.close);
          const highY = yFor(candle.high);
          const lowY = yFor(candle.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(0.9, Math.abs(openY - closeY));
          const isUp = candle.close >= candle.open;

          return (
            <g className={isUp ? "candle candle-up" : "candle candle-down"} key={candle.startTick}>
              <line x1={x} x2={x} y1={highY} y2={lowY} />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} rx="0.35" />
            </g>
          );
        })}
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
  rows: ChainRow[];
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

function GreekSummary({ rows }: { rows: ChainRow[] }) {
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
