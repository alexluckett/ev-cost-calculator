/**
 * Comparison helpers: break-even solving and sensitivity sweeps.
 *
 * Annual cost is affine in every parameter we solve for — fuel price,
 * electricity rate, rapid-charging share and annual mileage all enter the
 * model linearly — so a break-even point can be found exactly from two
 * evaluations rather than by searching. Evaluating the real pipeline (rather
 * than a simplified formula) keeps the answer consistent with the numbers
 * shown everywhere else.
 */

import { computeScenario } from './tco';
import type { AppState, ScenarioResult } from './types';

export type BreakEvenAxis =
  | 'petrolPrice'
  | 'dieselPrice'
  | 'homeOffPeakRate'
  | 'publicRapidRate'
  | 'rapidSharePct'
  | 'annualMiles';

export interface AxisDefinition {
  id: BreakEvenAxis;
  label: string;
  unit: string;
  /** Sensible plotting range. */
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

export const AXES: Record<BreakEvenAxis, AxisDefinition> = {
  petrolPrice: { id: 'petrolPrice', label: 'Petrol price', unit: 'p/litre', min: 90, max: 220, step: 5, format: (v) => `${v.toFixed(1)}p/l` },
  dieselPrice: { id: 'dieselPrice', label: 'Diesel price', unit: 'p/litre', min: 90, max: 220, step: 5, format: (v) => `${v.toFixed(1)}p/l` },
  homeOffPeakRate: { id: 'homeOffPeakRate', label: 'Home off-peak rate', unit: 'p/kWh', min: 0, max: 45, step: 1, format: (v) => `${v.toFixed(1)}p/kWh` },
  publicRapidRate: { id: 'publicRapidRate', label: 'Public rapid rate', unit: 'p/kWh', min: 20, max: 100, step: 2, format: (v) => `${v.toFixed(1)}p/kWh` },
  rapidSharePct: { id: 'rapidSharePct', label: 'Share charged on rapid DC', unit: '%', min: 0, max: 100, step: 5, format: (v) => `${v.toFixed(0)}%` },
  annualMiles: { id: 'annualMiles', label: 'Annual mileage', unit: 'miles', min: 2000, max: 30000, step: 1000, format: (v) => `${Math.round(v).toLocaleString('en-GB')} mi` },
};

/** Returns a copy of the state with one axis set to `value`. */
export function withAxisValue(state: AppState, axis: BreakEvenAxis, value: number): AppState {
  switch (axis) {
    case 'petrolPrice':
      return { ...state, prices: { ...state.prices, petrolPPerLitre: value } };
    case 'dieselPrice':
      return { ...state, prices: { ...state.prices, dieselPPerLitre: value } };
    case 'homeOffPeakRate':
      return { ...state, prices: { ...state.prices, homeOffPeakPPerKWh: value } };
    case 'publicRapidRate':
      return { ...state, prices: { ...state.prices, publicRapidPPerKWh: value } };
    case 'annualMiles':
      return { ...state, usage: { ...state.usage, annualMiles: value } };
    case 'rapidSharePct': {
      // Move `value` percent of charging onto rapid DC, rebalancing the rest
      // in proportion so the mix still totals 100.
      const scenarios = state.scenarios.map((s) => {
        const others = (Object.keys(s.charging.mix) as (keyof typeof s.charging.mix)[]).filter(
          (k) => k !== 'publicRapid',
        );
        const otherTotal = others.reduce((sum, k) => sum + s.charging.mix[k], 0);
        const remaining = 100 - value;
        const mix = { ...s.charging.mix, publicRapid: value };
        for (const k of others) {
          mix[k] = otherTotal > 0 ? (s.charging.mix[k] / otherTotal) * remaining : 0;
        }
        if (otherTotal === 0) mix.homeOffPeak = remaining;
        return { ...s, charging: { ...s.charging, mix, rapidEntryMode: 'percent' as const } };
      });
      return { ...state, scenarios };
    }
  }
}

export function computeAll(state: AppState): ScenarioResult[] {
  return state.scenarios.map((s) =>
    computeScenario(s, state.usage, state.prices, state.tax, state.assumptions, state.includeCapitalCosts),
  );
}

function totalFor(state: AppState, scenarioId: string): number {
  const scenario = state.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return NaN;
  return computeScenario(
    scenario,
    state.usage,
    state.prices,
    state.tax,
    state.assumptions,
    state.includeCapitalCosts,
  ).annualTotalGBP;
}

export interface BreakEvenResult {
  axis: BreakEvenAxis;
  value: number | null;
  /** True when the break-even point sits inside the plotted range. */
  inRange: boolean;
  /** Scenario id that is cheaper at the bottom of the plotted range. */
  cheaperAtMin: string | null;
  /** Scenario id that is cheaper at the top of the plotted range. */
  cheaperAtMax: string | null;
  /** Which scenario is cheaper below the break-even point. */
  cheaperBelow: string | null;
}

export function breakEven(
  state: AppState,
  aId: string,
  bId: string,
  axis: BreakEvenAxis,
): BreakEvenResult {
  const def = AXES[axis];
  const x0 = def.min;
  const x1 = def.max;

  const f = (x: number) => {
    const s = withAxisValue(state, axis, x);
    return totalFor(s, aId) - totalFor(s, bId);
  };

  const f0 = f(x0);
  const f1 = f(x1);

  if (!Number.isFinite(f0) || !Number.isFinite(f1)) {
    return { axis, value: null, inRange: false, cheaperAtMin: null, cheaperAtMax: null, cheaperBelow: null };
  }

  const cheaperAtMin = f0 <= 0 ? aId : bId;
  const cheaperAtMax = f1 <= 0 ? aId : bId;

  const denominator = f1 - f0;
  if (Math.abs(denominator) < 1e-9) {
    return { axis, value: null, inRange: false, cheaperAtMin, cheaperAtMax, cheaperBelow: null };
  }

  const root = x0 - (f0 * (x1 - x0)) / denominator;
  const inRange = root >= x0 && root <= x1;

  return { axis, value: root, inRange, cheaperAtMin, cheaperAtMax, cheaperBelow: cheaperAtMin };
}

/** Puts a break-even result into a sentence, given the two cars' names. */
export function describeBreakEven(
  result: BreakEvenResult,
  aLabel: string,
  bLabel: string,
  aId: string,
): string {
  const def = AXES[result.axis];
  const nameOf = (id: string | null) => (id === aId ? aLabel : bLabel);

  if (result.value === null) {
    if (result.cheaperAtMin === null) return 'Not enough information to solve.';
    return `${def.label} does not change the gap — ${nameOf(result.cheaperAtMin)} stays cheaper either way.`;
  }
  if (result.inRange) {
    return `They cost the same at ${def.format(result.value)}, and ${nameOf(result.cheaperAtMin)} is cheaper below that.`;
  }
  const winner = nameOf(result.cheaperAtMin);
  return `No crossover: ${winner} is cheaper across the whole range, from ${def.format(def.min)} to ${def.format(def.max)}.`;
}

export interface SeriesPoint {
  x: number;
  values: Record<string, number>;
}

/** Samples annual total cost for every scenario across an axis. */
export function sensitivitySeries(
  state: AppState,
  axis: BreakEvenAxis,
  samples = 24,
): SeriesPoint[] {
  const def = AXES[axis];
  const points: SeriesPoint[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = def.min + ((def.max - def.min) * i) / samples;
    const s = withAxisValue(state, axis, x);
    const values: Record<string, number> = {};
    for (const scenario of s.scenarios) {
      values[scenario.id] = computeScenario(
        scenario,
        s.usage,
        s.prices,
        s.tax,
        s.assumptions,
        s.includeCapitalCosts,
      ).annualTotalGBP;
    }
    points.push({ x, values });
  }
  return points;
}
