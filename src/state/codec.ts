/**
 * Encodes a comparison into the URL so it can be shared or bookmarked, and
 * decodes it defensively — an old or hand-edited link must never white-screen
 * the app, so anything missing or malformed falls back to the default.
 */

import { SCENARIO_COLOURS, blankVehicleSpec, defaultState, makeCustomScenario } from './defaults';
import type { AppState, Scenario } from '../model/types';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeState(state: AppState): string {
  return toBase64Url(JSON.stringify(state));
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function hydrateScenario(raw: unknown, index: number): Scenario {
  const s = (raw ?? {}) as Partial<Scenario>;
  const template = makeCustomScenario();
  return {
    id: typeof s.id === 'string' && s.id ? s.id : `s${index}-${Math.random().toString(36).slice(2, 8)}`,
    label: typeof s.label === 'string' ? s.label : `Vehicle ${index + 1}`,
    colour: typeof s.colour === 'string' ? s.colour : SCENARIO_COLOURS[index % SCENARIO_COLOURS.length],
    vehicle: { ...blankVehicleSpec(), ...(s.vehicle ?? {}) },
    homeChargingPct: num(s.homeChargingPct, template.homeChargingPct),
    ownership: { ...template.ownership, ...(s.ownership ?? {}) },
    running: { ...template.running, ...(s.running ?? {}) },
  };
}

/** Fills in anything the incoming object is missing, field by field. */
export function hydrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<AppState>;

  return {
    annualMiles: num(input.annualMiles, base.annualMiles),
    termYears: num(input.termYears, base.termYears),
    taxYear: typeof input.taxYear === 'string' ? input.taxYear : base.taxYear,
    grossSalaryGBP: num(input.grossSalaryGBP, base.grossSalaryGBP),
    prices: { ...base.prices, ...(input.prices ?? {}) },
    // An empty comparison is a legitimate state — the app starts that way — so
    // a saved link with no cars stays empty rather than having some put back.
    scenarios: Array.isArray(input.scenarios)
      ? input.scenarios.map((s, i) => hydrateScenario(s, i))
      : base.scenarios,
  };
}

export function decodeState(encoded: string): AppState | null {
  try {
    return hydrate(JSON.parse(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

export function stateFromLocation(): AppState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('c=') ? decodeState(hash.slice(2)) : null;
}

export function shareUrlFor(state: AppState): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#c=${encodeState(state)}`;
}
