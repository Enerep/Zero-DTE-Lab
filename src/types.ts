export type OptionSide = "call" | "put";
export type EventKind = "earnings" | "news" | "vol-spike" | "iv-crush" | "reversal";

export type Contract = {
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

export type ChainRow = {
  strike: number;
  call: Contract;
  put: Contract;
};

export type Position = {
  id: string;
  contractId: string;
  side: OptionSide;
  strike: number;
  quantity: number;
  entryPrice: number;
  openedAt: number;
};

export type ClosedTrade = Position & {
  exitPrice: number;
  closedAt: number;
  realizedPl: number;
  explanation: string;
};

export type MarketEvent = {
  id: string;
  kind: EventKind;
  title: string;
  impact: string;
  createdAt: number;
  ttl: number;
};

export type SimState = {
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
