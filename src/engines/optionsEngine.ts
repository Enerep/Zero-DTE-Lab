import { EXPIRATION_SECONDS } from "../constants";
import { clamp } from "../lib/math";
import type { ChainRow, Contract, OptionSide } from "../types";

export function priceOption(side: OptionSide, stockPrice: number, strike: number, secondsLeft: number, baseIv: number): Contract {
  const intrinsic = side === "call" ? Math.max(0, stockPrice - strike) : Math.max(0, strike - stockPrice);
  const timeRatio = clamp(secondsLeft / EXPIRATION_SECONDS, 0, 1);
  const moneynessDistance = Math.abs(stockPrice - strike);
  const atmFactor = clamp(1 - moneynessDistance / 18, 0.08, 1);
  const iv = clamp(baseIv + atmFactor * 0.18, 0.12, 1.6);
  const extrinsic = Math.max(0.03, atmFactor * iv * 4.2 * Math.sqrt(timeRatio));
  const mid = Math.max(0.01, intrinsic + extrinsic);
  const spread = clamp(mid * 0.06, 0.03, 0.4);
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
    iv
  };
}

export function buildChain(price: number, secondsLeft: number, baseIv: number): ChainRow[] {
  const center = Math.round(price / 5) * 5;
  const strikes = [-10, -5, 0, 5, 10].map((offset) => center + offset);
  return strikes.map((strike) => ({
    strike,
    call: priceOption("call", price, strike, secondsLeft, baseIv),
    put: priceOption("put", price, strike, secondsLeft, baseIv)
  }));
}

export function getContract(chain: ChainRow[], contractId: string) {
  for (const row of chain) {
    if (row.call.id === contractId) return row.call;
    if (row.put.id === contractId) return row.put;
  }
  return null;
}
