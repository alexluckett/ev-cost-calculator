/**
 * What the app still needs before it can give an answer.
 *
 * The app starts empty, so it must never present a figure derived from blanks:
 * "£0 a year" reads as a result rather than as a missing input, which is worse
 * than no answer at all.
 */

import type { AppState } from '../model/types';

export function missingInputs(state: AppState): string[] {
  const missing: string[] = [];

  if (state.scenarios.length === 0) missing.push('Add at least one car to compare');
  if (state.annualMiles <= 0) missing.push('Set your annual mileage');

  const fuels = new Set(state.scenarios.map((s) => s.vehicle.fuelType));
  const liquids = new Set(
    state.scenarios.filter((s) => s.vehicle.fuelType !== 'bev').map((s) => s.vehicle.liquidFuel),
  );

  if (fuels.has('bev') || fuels.has('phev')) {
    // A single zero rate is legitimate — free workplace charging is real. All
    // of them being zero means nobody has filled the tariff in yet.
    if (state.prices.homePPerKWh <= 0 && state.prices.publicRapidPPerKWh <= 0) {
      missing.push('Set what you pay for electricity');
    }
  }
  if (liquids.has('petrol') && state.prices.petrolPPerLitre <= 0) {
    missing.push('Set the petrol price you pay');
  }
  if (liquids.has('diesel') && state.prices.dieselPPerLitre <= 0) {
    missing.push('Set the diesel price you pay');
  }

  return missing;
}
