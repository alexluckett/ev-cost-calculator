/**
 * Encodes a comparison into the URL so it can be shared or bookmarked, and
 * decodes it defensively — an old or hand-edited link must never white-screen
 * the app, so anything missing or malformed falls back to the default.
 */

import { DEFAULT_ASSUMPTIONS } from '../data/assumptions';
import { SCENARIO_COLOURS, blankVehicleSpec, defaultCharging, defaultOwnership, defaultState } from './defaults';
import type { AppState, Scenario } from '../model/types';

export const STATE_VERSION = 1;

interface Envelope {
  v: number;
  s: AppState;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(state: AppState): string {
  const envelope: Envelope = { v: STATE_VERSION, s: state };
  return toBase64Url(JSON.stringify(envelope));
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Fills in anything the incoming object is missing, field by field. */
export function hydrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<AppState>;

  // An empty comparison is a legitimate state — the app starts that way — so
  // a saved file with no cars must stay empty rather than have some put back.
  const scenarios: Scenario[] = Array.isArray(input.scenarios)
    ? input.scenarios.map((s, i) => hydrateScenario(s, i))
    : base.scenarios;

  const baselineId = scenarios.some((s) => s.id === input.baselineId)
    ? (input.baselineId as string)
    : (scenarios[0]?.id ?? '');

  return {
    usage: {
      annualMiles: num(input.usage?.annualMiles, base.usage.annualMiles),
      businessMilesPct: num(input.usage?.businessMilesPct, base.usage.businessMilesPct),
      termYears: num(input.usage?.termYears, base.usage.termYears),
    },
    prices: { ...base.prices, ...(input.prices ?? {}) },
    tax: { ...base.tax, ...(input.tax ?? {}) },
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...(input.assumptions ?? {}) },
    scenarios,
    baselineId,
    includeCapitalCosts: bool(input.includeCapitalCosts, base.includeCapitalCosts),
  };
}

function hydrateScenario(raw: unknown, index: number): Scenario {
  const s = (raw ?? {}) as Partial<Scenario>;
  const vehicle = { ...blankVehicleSpec(), ...(s.vehicle ?? {}) };
  const blankRunning = {
    insuranceGBP: 0,
    servicingGBP: 0,
    tyresPencePerMile: 0,
    motGBP: 0,
    breakdownCoverGBP: 0,
    vedOverrideGBP: null,
    congestionChargeDaysPerYear: 0,
    otherAnnualGBP: 0,
  };
  return {
    id: typeof s.id === 'string' && s.id ? s.id : `s${index}-${Math.random().toString(36).slice(2, 8)}`,
    label: typeof s.label === 'string' ? s.label : `Vehicle ${index + 1}`,
    colour: typeof s.colour === 'string' ? s.colour : SCENARIO_COLOURS[index % SCENARIO_COLOURS.length],
    vehicle,
    charging: { ...defaultCharging(), ...(s.charging ?? {}), mix: { ...defaultCharging().mix, ...(s.charging?.mix ?? {}) } },
    ownership: { ...defaultOwnership(vehicle), ...(s.ownership ?? {}) },
    running: { ...blankRunning, ...(s.running ?? {}) },
  };
}

export function decodeState(encoded: string): AppState | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Envelope;
    if (!parsed || typeof parsed !== 'object') return null;
    return hydrate(parsed.s ?? parsed);
  } catch {
    return null;
  }
}

export function stateFromLocation(): AppState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.startsWith('c=')) return null;
  return decodeState(hash.slice(2));
}

export function shareUrlFor(state: AppState): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#c=${encodeState(state)}`;
}
