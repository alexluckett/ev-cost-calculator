import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, DEFAULT_PRICES, LITRES_PER_IMPERIAL_GALLON } from '../data/assumptions';
import { defaultCharging, makeScenario } from '../state/defaults';
import {
  computeEnergy,
  effectiveMiPerKWh,
  energyInflationFactor,
  normaliseMix,
  resolveChargingMix,
} from './energy';
import type { ChargingSourceId, Scenario, UsageInputs } from './types';

const usage: UsageInputs = { annualMiles: 10000, businessMilesPct: 0, termYears: 3 };

function evScenario(overrides: Partial<Scenario> = {}): Scenario {
  const base = makeScenario('tesla-model-y-premium-awd', 'Test EV', 0);
  return { ...base, ...overrides };
}

function homeOnly(): Record<ChargingSourceId, number> {
  return { homeOffPeak: 100, homePeak: 0, workplace: 0, publicRapid: 0, publicSlow: 0 };
}

describe('normaliseMix', () => {
  it('scales shares to total 100', () => {
    const mix = normaliseMix({ homeOffPeak: 4, homePeak: 1, workplace: 0, publicRapid: 0, publicSlow: 0 });
    expect(mix.homeOffPeak).toBeCloseTo(80);
    expect(mix.homePeak).toBeCloseTo(20);
  });

  it('falls back to home charging when every share is zero', () => {
    const mix = normaliseMix({ homeOffPeak: 0, homePeak: 0, workplace: 0, publicRapid: 0, publicSlow: 0 });
    expect(mix.homeOffPeak).toBe(100);
  });

  it('ignores negative and non-finite input', () => {
    const mix = normaliseMix({ homeOffPeak: 50, homePeak: -10, workplace: NaN, publicRapid: 50, publicSlow: 0 });
    expect(mix.homeOffPeak).toBeCloseTo(50);
    expect(mix.homePeak).toBe(0);
    expect(mix.publicRapid).toBeCloseTo(50);
  });
});

describe('resolveChargingMix', () => {
  it('converts rapid sessions per month into a share of annual energy', () => {
    const charging = {
      ...defaultCharging(),
      mix: homeOnly(),
      rapidEntryMode: 'sessions' as const,
      rapidSessionsPerMonth: 1,
      rapidSessionKWh: 50,
    };
    // 600 kWh of rapid charging out of 3,000 kWh a year is a fifth of it.
    const mix = resolveChargingMix(charging, 3000);
    expect(mix.publicRapid).toBeCloseTo(20);
    expect(mix.homeOffPeak).toBeCloseTo(80);
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100);
  });

  it('caps the rapid share at 100% when sessions exceed annual energy', () => {
    const charging = {
      ...defaultCharging(),
      mix: homeOnly(),
      rapidEntryMode: 'sessions' as const,
      rapidSessionsPerMonth: 10,
      rapidSessionKWh: 60,
    };
    const mix = resolveChargingMix(charging, 3000);
    expect(mix.publicRapid).toBe(100);
    expect(mix.homeOffPeak).toBe(0);
  });

  it('leaves the mix alone in percentage mode', () => {
    const charging = { ...defaultCharging(), mix: homeOnly(), rapidEntryMode: 'percent' as const };
    expect(resolveChargingMix(charging, 3000).publicRapid).toBe(0);
  });
});

describe('computeEnergy — electric', () => {
  it('bills grid kWh, not battery kWh', () => {
    const scenario = evScenario();
    scenario.vehicle.miPerKWh = 4;
    scenario.charging = { ...defaultCharging(), mix: homeOnly() };

    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);

    // 10,000 miles at 4 mi/kWh is 2,500 kWh into the battery...
    expect(result.annualBatteryKWh).toBeCloseTo(2500);
    // ...which costs 2,500 / 0.90 = 2,777.8 kWh at the meter.
    expect(result.annualGridKWh).toBeCloseTo(2777.78, 1);
    expect(result.electricityCostGBP).toBeCloseTo((2777.78 * 7) / 100, 1);
    expect(result.liquidFuelCostGBP).toBe(0);
  });

  it('charges DC energy at the DC rate and the DC loss factor', () => {
    const scenario = evScenario();
    scenario.vehicle.miPerKWh = 4;
    scenario.charging = {
      ...defaultCharging(),
      mix: { homeOffPeak: 0, homePeak: 0, workplace: 0, publicRapid: 100, publicSlow: 0 },
    };

    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);

    expect(result.annualGridKWh).toBeCloseTo(2500 / 0.95, 1);
    expect(result.blendedPPerKWh).toBeCloseTo(DEFAULT_PRICES.publicRapidPPerKWh, 5);
  });

  it('blends a mixed tariff into one pence-per-mile figure', () => {
    const scenario = evScenario();
    scenario.vehicle.miPerKWh = 4;
    scenario.charging = {
      ...defaultCharging(),
      mix: { homeOffPeak: 50, homePeak: 0, workplace: 0, publicRapid: 50, publicSlow: 0 },
    };

    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);

    const homeCost = (1250 / 0.9) * 0.07;
    const rapidCost = (1250 / 0.95) * 0.45;
    expect(result.totalCostGBP).toBeCloseTo(homeCost + rapidCost, 4);
    expect(result.pencePerMile).toBeCloseTo(((homeCost + rapidCost) * 100) / 10000, 4);
  });

  it('applies the real-world derating penalty', () => {
    const scenario = evScenario();
    scenario.vehicle.miPerKWh = 4;
    scenario.charging = { ...defaultCharging(), mix: homeOnly(), realWorldPenaltyPct: 25 };

    expect(effectiveMiPerKWh(scenario)).toBeCloseTo(3.2);
    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);
    expect(result.annualBatteryKWh).toBeCloseTo(3125);
  });
});

describe('computeEnergy — combustion', () => {
  it('converts mpg and pence per litre into an annual bill', () => {
    const scenario = makeScenario('vw-golf-15tsi', 'Golf', 1);
    scenario.vehicle.mpg = 40;

    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);

    const expectedLitres = (10000 / 40) * LITRES_PER_IMPERIAL_GALLON;
    expect(result.annualLitres).toBeCloseTo(expectedLitres, 4);
    expect(result.liquidFuelCostGBP).toBeCloseTo((expectedLitres * 135) / 100, 4);
    expect(result.annualGridKWh).toBe(0);
  });

  it('prices a diesel at the diesel pump price', () => {
    const scenario = makeScenario('bmw-320d', 'Diesel', 1);
    scenario.vehicle.mpg = 50;
    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);
    const litres = (10000 / 50) * LITRES_PER_IMPERIAL_GALLON;
    expect(result.liquidFuelCostGBP).toBeCloseTo((litres * DEFAULT_PRICES.dieselPPerLitre) / 100, 4);
  });
});

describe('computeEnergy — plug-in hybrid', () => {
  it('splits miles between battery and petrol', () => {
    const scenario = makeScenario('bmw-330e', 'PHEV', 2);
    scenario.vehicle.phevElectricMilesPct = 60;
    scenario.vehicle.miPerKWh = 3;
    scenario.vehicle.mpg = 40;
    scenario.charging = { ...defaultCharging(), mix: homeOnly() };

    const result = computeEnergy(scenario, usage, DEFAULT_PRICES, DEFAULT_ASSUMPTIONS);

    expect(result.electricMiles).toBeCloseTo(6000);
    expect(result.liquidMiles).toBeCloseTo(4000);
    expect(result.annualBatteryKWh).toBeCloseTo(2000);
    expect(result.annualLitres).toBeCloseTo((4000 / 40) * LITRES_PER_IMPERIAL_GALLON, 4);
    expect(result.totalCostGBP).toBeCloseTo(result.electricityCostGBP + result.liquidFuelCostGBP, 6);
  });
});

describe('energyInflationFactor', () => {
  it('is 1 with no inflation', () => {
    expect(energyInflationFactor(5, 0)).toBe(1);
  });

  it('averages the multiplier across the term', () => {
    // Years at 1.00 and 1.10 average 1.05.
    expect(energyInflationFactor(2, 10)).toBeCloseTo(1.05);
  });
});
