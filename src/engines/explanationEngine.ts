import { dollars, signedDollars } from "../lib/format";
import type { ClosedTrade } from "../types";

export function explainTrade(trade: Omit<ClosedTrade, "explanation">, exitReason: string) {
  const won = trade.realizedPl >= 0;
  const direction = trade.side === "call" ? "bullish call" : "bearish put";
  const priceMove = trade.exitPrice > trade.entryPrice ? "premium expanded" : "premium contracted";
  const outcome = won ? "won" : "lost";
  return `This ${direction} ${outcome} because the option ${priceMove} before close. ${exitReason} Entry was ${dollars(
    trade.entryPrice
  )}, exit was ${dollars(trade.exitPrice)}, for ${signedDollars(trade.realizedPl)} after contract multiplier.`;
}
