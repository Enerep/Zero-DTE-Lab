import { CONTRACT_MULTIPLIER } from "../constants";
import { explainTrade } from "./explanationEngine";
import { buildChain, getContract } from "./optionsEngine";
import type { ChainRow, Contract, Position, SimState } from "../types";

export function getPositionValue(positions: Position[], chain: ChainRow[]) {
  return positions.reduce((sum, position) => {
    const contract = getContract(chain, position.contractId);
    return sum + (contract?.bid ?? 0) * position.quantity * CONTRACT_MULTIPLIER;
  }, 0);
}

export function getUnrealizedPl(positions: Position[], chain: ChainRow[]) {
  return positions.reduce((sum, position) => {
    const contract = getContract(chain, position.contractId);
    return sum + ((contract?.bid ?? 0) - position.entryPrice) * position.quantity * CONTRACT_MULTIPLIER;
  }, 0);
}

export function getRealizedPl(state: SimState) {
  return state.trades.reduce((sum, trade) => sum + trade.realizedPl, 0);
}

export function buyToOpen(state: SimState, contract: Contract, secondsLeft: number): SimState {
  const cost = contract.ask * CONTRACT_MULTIPLIER;
  if (state.cash < cost || secondsLeft === 0) return state;

  return {
    ...state,
    cash: state.cash - cost,
    positions: [
      ...state.positions,
      {
        id: `pos-${state.tick}-${contract.id}-${Math.random().toString(16).slice(2)}`,
        contractId: contract.id,
        side: contract.side,
        strike: contract.strike,
        quantity: 1,
        entryPrice: contract.ask,
        openedAt: state.tick
      }
    ]
  };
}

export function sellToClose(state: SimState, position: Position, secondsLeft: number): SimState {
  const liveChain = buildChain(state.price, secondsLeft, state.baseIv);
  const contract = getContract(liveChain, position.contractId);
  const exitPrice = contract?.bid ?? 0;
  const realizedPl = (exitPrice - position.entryPrice) * position.quantity * CONTRACT_MULTIPLIER;
  const trade = {
    ...position,
    exitPrice,
    closedAt: state.tick,
    realizedPl
  };

  return {
    ...state,
    cash: state.cash + exitPrice * position.quantity * CONTRACT_MULTIPLIER,
    positions: state.positions.filter((item) => item.id !== position.id),
    trades: [
      {
        ...trade,
        explanation: explainTrade(trade, "You manually sold to close before expiration.")
      },
      ...state.trades
    ]
  };
}
