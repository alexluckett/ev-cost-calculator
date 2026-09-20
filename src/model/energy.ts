/**
 * Energy model: turns miles into kWh and litres, and those into money.
 *
 * The one subtlety kept from the fuller version, because dropping it would
 * make the answer wrong rather than merely simpler: you pay for kWh at the
 * meter, not kWh in the battery. Efficiency figures are quoted at the battery,
 * so grid energy is always higher — by about a tenth on a home charger.
 */

import type { EnergyPrices, EnergyResult, Scenario } from './types';

/** An imperial gallon in litres — the UK buys fuel in litres and quotes mpg. */
export const LITRES_PER_IMPERIAL_GALLON = 4.54609;

/**
 * Share of grid energy that reaches the battery. Home AC charging loses about
 * a tenth to the on-board charger, cabling and battery conditioning; rapid DC
 * bypasses the on-board charger and loses about half as much.
 */
export const HOME_CHARGING_EFFICIENCY = 0.9;
export const RAPID_CHARGING_EFFICIENCY = 0.95;

export function usesElectricity(fuelType: string): boolean {
  return fuelType === 'bev' || fuelType === 'phev';
}

export function usesLiquidFuel(fuelType: string): boolean {
  return fuelType !== 'bev';
}

/** Share of annual miles driven on electricity, 0–1. */
export function electricMilesShare(scenario: Scenario): number {
  const { fuelType, phevElectricMilesPct } = scenario.vehicle;
  if (fuelType === 'bev') return 1;
  if (fuelType === 'phev') return Math.min(100, Math.max(0, phevElectricMilesPct)) / 100;
  return 0;
}

export function computeEnergy(
  scenario: Scenario,
  annualMiles: number,
  prices: EnergyPrices,
): EnergyResult {
  const miles = Math.max(0, annualMiles);
  const electricMiles = miles * electricMilesShare(scenario);
  const liquidMiles = miles - electricMiles;

  // --- Electricity ---
  const miPerKWh = Math.max(0.1, scenario.vehicle.miPerKWh);
  const annualBatteryKWh = usesElectricity(scenario.vehicle.fuelType) ? electricMiles / miPerKWh : 0;

  const homeShare = Math.min(100, Math.max(0, scenario.homeChargingPct)) / 100;
  const homeGridKWh = (annualBatteryKWh * homeShare) / HOME_CHARGING_EFFICIENCY;
  const rapidGridKWh = (annualBatteryKWh * (1 - homeShare)) / RAPID_CHARGING_EFFICIENCY;
  const annualGridKWh = homeGridKWh + rapidGridKWh;

  const electricityCostGBP =
    (homeGridKWh * Math.max(0, prices.homePPerKWh) +
      rapidGridKWh * Math.max(0, prices.publicRapidPPerKWh)) /
    100;

  // --- Liquid fuel ---
  const mpg = Math.max(1, scenario.vehicle.mpg);
  const pPerLitre =
    scenario.vehicle.liquidFuel === 'diesel' ? prices.dieselPPerLitre : prices.petrolPPerLitre;
  const annualLitres = usesLiquidFuel(scenario.vehicle.fuelType)
    ? (liquidMiles / mpg) * LITRES_PER_IMPERIAL_GALLON
    : 0;
  const fuelCostGBP = (annualLitres * Math.max(0, pPerLitre)) / 100;

  const costGBP = electricityCostGBP + fuelCostGBP;

  return {
    annualBatteryKWh,
    annualGridKWh,
    annualLitres,
    costGBP,
    pencePerMile: miles > 0 ? (costGBP * 100) / miles : 0,
    blendedPPerKWh: annualGridKWh > 0 ? (electricityCostGBP * 100) / annualGridKWh : 0,
  };
}
