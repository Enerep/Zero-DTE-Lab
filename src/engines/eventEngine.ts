import { clamp } from "../lib/math";
import type { EventKind, MarketEvent } from "../types";

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

export function ageEvents(events: MarketEvent[]) {
  return events.map((event) => ({ ...event, ttl: event.ttl - 1 })).filter((event) => event.ttl > 0);
}

export function createEvent(tick: number, drift: number): { event: MarketEvent; drift: number; ivMove: number; jump: number } {
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

export function maybeApplyRandomEvent(tick: number, secondsLeft: number, drift: number, baseIv: number, events: MarketEvent[]) {
  if (Math.random() >= 0.08 || secondsLeft <= 20) {
    return { drift, baseIv, jump: 0, events };
  }

  const created = createEvent(tick, drift);
  return {
    drift: created.drift,
    baseIv: clamp(baseIv + created.ivMove, 0.18, 1.25),
    jump: created.jump,
    events: [created.event, ...events].slice(0, 8)
  };
}
