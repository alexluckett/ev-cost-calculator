/**
 * What the app still needs before it can give an answer.
 *
 * The app starts completely empty, so it must never present a computed figure
 * derived from blanks — "£0 a year" reads as a result rather than as a missing
 * input, and that is worse than no answer at all. Results stay hidden until
 * the inputs they depend on actually exist.
 */

import type { AppState } from '../model/types';

export interface MissingInput {
  id: string;
  label: string;
  /** Anchor of the section that fixes it. */
  section: 'cars' | 'driving' | 'prices';
}

export function missingInputs(state: AppState): MissingInput[] {
  const missing: MissingInput[] = [];

  if (state.scenarios.length === 0) {
    missing.push({ id: 'no-cars', label: 'Add at least one car to compare', section: 'cars' });
  }

  if (state.usage.annualMiles <= 0) {
    missing.push({ id: 'miles', label: 'Set your annual mileage', section: 'driving' });
  }

  const fuels = new Set(state.scenarios.map((s) => s.vehicle.fuelType));
  const usesElectricity = fuels.has('bev') || fuels.has('phev');
  const liquidFuels = new Set(
    state.scenarios.filter((s) => s.vehicle.fuelType !== 'bev').map((s) => s.vehicle.liquidFuel),
  );

  if (usesElectricity) {
    const { homeOffPeakPPerKWh, homePeakPPerKWh, workplacePPerKWh, publicRapidPPerKWh, publicSlowPPerKWh } =
      state.prices;
    // Any one rate being zero is legitimate — free workplace charging is real.
    // Every rate being zero means nobody has filled the tariff in yet.
    const anySet =
      homeOffPeakPPerKWh > 0 ||
      homePeakPPerKWh > 0 ||
      workplacePPerKWh > 0 ||
      publicRapidPPerKWh > 0 ||
      publicSlowPPerKWh > 0;
    if (!anySet) {
      missing.push({ id: 'electricity', label: 'Set what you pay for electricity', section: 'prices' });
    }
  }

  if (liquidFuels.has('petrol') && state.prices.petrolPPerLitre <= 0) {
    missing.push({ id: 'petrol', label: 'Set the petrol price you pay', section: 'prices' });
  }
  if (liquidFuels.has('diesel') && state.prices.dieselPPerLitre <= 0) {
    missing.push({ id: 'diesel', label: 'Set the diesel price you pay', section: 'prices' });
  }

  return missing;
}

export function isReady(state: AppState): boolean {
  return missingInputs(state).length === 0;
}
