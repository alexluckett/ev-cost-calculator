/**
 * Energy model: turns miles into kWh and litres, and kWh and litres into money.
 *
 * Two things here are easy to get wrong and are handled explicitly:
 *  1. Charging losses. You pay for kWh at the meter, not kWh in the battery.
 *     Efficiency figures (mi/kWh) are quoted at the battery, so grid energy is
 *     always higher — by roughly a tenth on AC.
 *  2. The charging mix. Rapid charging is usually described as a frequency
 *     ("once a month"), not a share, so both are supported and the rest of the
 *     mix rebalances around it.
 */

import { LITRES_PER_IMPERIAL_GALLON } from '../data/assumptions';
import {
  CHARGING_SOURCE_IDS,
  DC_SOURCES,
  type Assumptions,
  type ChargingInputs,
  type ChargingSourceId,
  type EnergyBreakdownRow,
  type EnergyPrices,
  type EnergyResult,
  type Scenario,
  type UsageInputs,
} from './types';

export function usesElectricity(fuelType: string): boolean {
  return fuelType === 'bev' || fuelType === 'phev';
}

export function usesLiquidFuel(fuelType: string): boolean {
  return fuelType !== 'bev';
}

/** Scales a set of shares so they total 100. An all-zero mix falls back to home off-peak. */
export function normaliseMix(
  mix: Record<ChargingSourceId, number>,
): Record<ChargingSourceId, number> {
  const clamped = {} as Record<ChargingSourceId, number>;
  let total = 0;
  for (const id of CHARGING_SOURCE_IDS) {
    const v = Math.max(0, Number.isFinite(mix[id]) ? mix[id] : 0);
    clamped[id] = v;
    total += v;
  }
  if (total === 0) {
    const fallback = {} as Record<ChargingSourceId, number>;
    for (const id of CHARGING_SOURCE_IDS) fallback[id] = 0;
    fallback.homeOffPeak = 100;
    return fallback;
  }
  const out = {} as Record<ChargingSourceId, number>;
  for (const id of CHARGING_SOURCE_IDS) out[id] = (clamped[id] / total) * 100;
  return out;
}

/**
 * Works out the mix actually used, honouring "N rapid sessions a month" by
 * converting those sessions into a share of annual battery energy and
 * rebalancing the other sources proportionally around it.
 */
export function resolveChargingMix(
  charging: ChargingInputs,
  annualBatteryKWh: number,
): Record<ChargingSourceId, number> {
  const base = normaliseMix(charging.mix);
  if (charging.rapidEntryMode !== 'sessions') return base;
  if (annualBatteryKWh <= 0) return base;

  const rapidKWh = Math.max(0, charging.rapidSessionsPerMonth) * 12 * Math.max(0, charging.rapidSessionKWh);
  const rapidShare = Math.min(100, (rapidKWh / annualBatteryKWh) * 100);

  const others = CHARGING_SOURCE_IDS.filter((id) => id !== 'publicRapid');
  const otherTotal = others.reduce((sum, id) => sum + base[id], 0);

  const out = {} as Record<ChargingSourceId, number>;
  out.publicRapid = rapidShare;
  const remaining = 100 - rapidShare;
  for (const id of others) {
    out[id] = otherTotal > 0 ? (base[id] / otherTotal) * remaining : 0;
  }
  if (otherTotal === 0 && remaining > 0) out.homeOffPeak = remaining;
  return out;
}

export function rateFor(source: ChargingSourceId, prices: EnergyPrices): number {
  switch (source) {
    case 'homeOffPeak':
      return prices.homeOffPeakPPerKWh;
    case 'homePeak':
      return prices.homePeakPPerKWh;
    case 'workplace':
      return prices.workplacePPerKWh;
    case 'publicRapid':
      return prices.publicRapidPPerKWh;
    case 'publicSlow':
      return prices.publicSlowPPerKWh;
  }
}

function efficiencyFor(source: ChargingSourceId, assumptions: Assumptions): number {
  const pct = DC_SOURCES.has(source)
    ? assumptions.dcChargingEfficiencyPct
    : assumptions.acChargingEfficiencyPct;
  return Math.min(100, Math.max(1, pct)) / 100;
}

/** Real-world efficiency at the battery, after the user's derating penalty. */
export function effectiveMiPerKWh(scenario: Scenario): number {
  const penalty = Math.max(-50, scenario.charging.realWorldPenaltyPct) / 100;
  const base = Math.max(0.1, scenario.vehicle.miPerKWh);
  return base / (1 + penalty);
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
  usage: UsageInputs,
  prices: EnergyPrices,
  assumptions: Assumptions,
): EnergyResult {
  const miles = Math.max(0, usage.annualMiles);
  const elecShare = electricMilesShare(scenario);
  const electricMiles = miles * elecShare;
  const liquidMiles = miles - electricMiles;

  const miPerKWh = effectiveMiPerKWh(scenario);
  const annualBatteryKWh = usesElectricity(scenario.vehicle.fuelType) ? electricMiles / miPerKWh : 0;

  const mix = resolveChargingMix(scenario.charging, annualBatteryKWh);

  const rows: EnergyBreakdownRow[] = [];
  let annualGridKWh = 0;
  let electricityCostGBP = 0;

  for (const source of CHARGING_SOURCE_IDS) {
    const sharePct = mix[source];
    const batteryKWh = (annualBatteryKWh * sharePct) / 100;
    const gridKWh = batteryKWh / efficiencyFor(source, assumptions);
    const pPerKWh = Math.max(0, rateFor(source, prices));
    const costGBP = (gridKWh * pPerKWh) / 100;
    annualGridKWh += gridKWh;
    electricityCostGBP += costGBP;
    rows.push({ source, sharePct, batteryKWh, gridKWh, pPerKWh, costGBP });
  }

  const mpg = Math.max(1, scenario.vehicle.mpg);
  const pPerLitre =
    scenario.vehicle.liquidFuel === 'diesel' ? prices.dieselPPerLitre : prices.petrolPPerLitre;
  const annualLitres = usesLiquidFuel(scenario.vehicle.fuelType)
    ? (liquidMiles / mpg) * LITRES_PER_IMPERIAL_GALLON
    : 0;
  const liquidFuelCostGBP = (annualLitres * Math.max(0, pPerLitre)) / 100;

  const totalCostGBP = electricityCostGBP + liquidFuelCostGBP;
  const blendedPPerKWh = annualGridKWh > 0 ? (electricityCostGBP * 100) / annualGridKWh : 0;

  const usableBattery = Math.max(0, scenario.vehicle.usableBatteryKWh);
  const tank = Math.max(0, scenario.vehicle.tankLitres);

  return {
    annualBatteryKWh,
    annualGridKWh,
    annualLitres,
    electricityCostGBP,
    liquidFuelCostGBP,
    totalCostGBP,
    pencePerMile: miles > 0 ? (totalCostGBP * 100) / miles : 0,
    blendedPPerKWh,
    rows,
    electricMiles,
    liquidMiles,
    // A "full charge" is billed at the meter, so it carries the charging losses.
    fullChargeCostGBP: usesElectricity(scenario.vehicle.fuelType)
      ? (usableBattery / (Math.max(1, assumptions.acChargingEfficiencyPct) / 100) * blendedPPerKWh) / 100
      : 0,
    fullChargeRangeMi: usesElectricity(scenario.vehicle.fuelType) ? usableBattery * miPerKWh : 0,
    fullTankCostGBP: usesLiquidFuel(scenario.vehicle.fuelType) ? (tank * pPerLitre) / 100 : 0,
    fullTankRangeMi: usesLiquidFuel(scenario.vehicle.fuelType)
      ? (tank / LITRES_PER_IMPERIAL_GALLON) * mpg
      : 0,
  };
}

/**
 * Multiplier turning a year-one energy bill into the average across the term
 * once inflation is applied. Returns 1 when inflation is zero.
 */
export function energyInflationFactor(termYears: number, inflationPct: number): number {
  const years = Math.max(1, Math.round(termYears));
  const rate = inflationPct / 100;
  if (rate === 0) return 1;
  let total = 0;
  for (let y = 0; y < years; y += 1) total += (1 + rate) ** y;
  return total / years;
}
