import { CONTRACT_MULTIPLIER, EXPIRATION_SECONDS, STARTING_CASH, START_PRICE } from "../constants";
import { clamp } from "../lib/math";
import { ageEvents, maybeApplyRandomEvent } from "./eventEngine";
import { explainTrade } from "./explanationEngine";
import { buildChain, getContract } from "./optionsEngine";
import type { SimState } from "../types";

export function getSecondsLeft(tick: number) {
  return Math.max(0, EXPIRATION_SECONDS - tick);
}

export function initialState(): SimState {
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

export function advanceMarket(state: SimState): SimState {
  const nextTick = state.tick + 1;
  const secondsLeft = getSecondsLeft(nextTick);
  const fadedDrift = state.drift * 0.985;
  const fadedIv = clamp(state.baseIv * 0.996, 0.18, 1.25);
  const agedEvents = ageEvents(state.events);
  const eventAdjusted = maybeApplyRandomEvent(nextTick, secondsLeft, fadedDrift, fadedIv, agedEvents);
  const noise = (Math.random() - 0.5) * (0.34 + eventAdjusted.baseIv * 0.46);
  const nextPrice = Math.max(35, state.price + eventAdjusted.drift + noise + eventAdjusted.jump);
  const nextHistory = [...state.history.slice(-59), nextPrice];
  const nextChain = buildChain(nextPrice, secondsLeft, eventAdjusted.baseIv);

  if (secondsLeft === 0 && state.positions.length > 0) {
    const expiredTrades = state.positions.map((position) => {
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
      ...state,
      tick: nextTick,
      price: nextPrice,
      history: nextHistory,
      drift: eventAdjusted.drift,
      baseIv: eventAdjusted.baseIv,
      positions: [],
      trades: [...expiredTrades, ...state.trades],
      cash: state.cash + expiredTrades.reduce((sum, trade) => sum + trade.exitPrice * trade.quantity * CONTRACT_MULTIPLIER, 0),
      events: [
        {
          id: `expiration-${nextTick}`,
          kind: "iv-crush" as const,
          title: "Expiration reached",
          impact: "Open positions were marked to their final bid value.",
          createdAt: nextTick,
          ttl: 999
        },
        ...eventAdjusted.events
      ].slice(0, 8)
    };
  }

  return {
    ...state,
    tick: nextTick,
    price: nextPrice,
    history: nextHistory,
    drift: eventAdjusted.drift,
    baseIv: eventAdjusted.baseIv,
    events: eventAdjusted.events
  };
}
