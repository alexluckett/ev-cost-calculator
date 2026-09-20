import { describe, expect, it } from 'vitest';
import { makeScenario } from '../state/defaults';
import { LITRES_PER_IMPERIAL_GALLON, computeEnergy } from './energy';
import type { EnergyPrices, Scenario } from './types';

const prices: EnergyPrices = {
  homePPerKWh: 7,
  publicRapidPPerKWh: 45,
  petrolPPerLitre: 135,
  dieselPPerLitre: 142,
};

function ev(homeChargingPct = 100): Scenario {
  const s = makeScenario('tesla-model-y-premium-awd', 'EV', 0);
  s.vehicle.miPerKWh = 4;
  return { ...s, homeChargingPct };
}

describe('electric', () => {
  it('bills grid kWh, not battery kWh', () => {
    const r = computeEnergy(ev(), 10000, prices);
    // 10,000 miles at 4 mi/kWh is 2,500 kWh into the battery...
    expect(r.annualBatteryKWh).toBeCloseTo(2500);
    // ...which costs 2,500 / 0.90 = 2,777.8 kWh at the meter.
    expect(r.annualGridKWh).toBeCloseTo(2777.78, 1);
    expect(r.costGBP).toBeCloseTo((2777.78 * 7) / 100, 1);
    expect(r.annualLitres).toBe(0);
  });

  it('uses the lower DC loss for rapid charging', () => {
    const r = computeEnergy(ev(0), 10000, prices);
    expect(r.annualGridKWh).toBeCloseTo(2500 / 0.95, 1);
    expect(r.blendedPPerKWh).toBeCloseTo(45, 5);
  });

  it('blends a home and rapid split into one pence per mile', () => {
    const r = computeEnergy(ev(50), 10000, prices);
    const home = (1250 / 0.9) * 0.07;
    const rapid = (1250 / 0.95) * 0.45;
    expect(r.costGBP).toBeCloseTo(home + rapid, 4);
    expect(r.pencePerMile).toBeCloseTo(((home + rapid) * 100) / 10000, 4);
  });

  it('gets dearer as rapid charging takes over', () => {
    const allHome = computeEnergy(ev(100), 10000, prices).costGBP;
    const half = computeEnergy(ev(50), 10000, prices).costGBP;
    const allRapid = computeEnergy(ev(0), 10000, prices).costGBP;
    expect(half).toBeGreaterThan(allHome);
    expect(allRapid).toBeGreaterThan(half);
  });
});

describe('combustion', () => {
  it('converts mpg and pence per litre into an annual bill', () => {
    const s = makeScenario('mercedes-a180', 'A180', 1);
    s.vehicle.mpg = 40;
    const r = computeEnergy(s, 10000, prices);
    const litres = (10000 / 40) * LITRES_PER_IMPERIAL_GALLON;
    expect(r.annualLitres).toBeCloseTo(litres, 4);
    expect(r.costGBP).toBeCloseTo((litres * 135) / 100, 4);
    expect(r.annualGridKWh).toBe(0);
  });

  it('prices a diesel at the diesel pump price', () => {
    const s = makeScenario('bmw-320d', 'Diesel', 1);
    s.vehicle.mpg = 50;
    const litres = (10000 / 50) * LITRES_PER_IMPERIAL_GALLON;
    expect(computeEnergy(s, 10000, prices).costGBP).toBeCloseTo((litres * 142) / 100, 4);
  });
});

describe('plug-in hybrid', () => {
  it('splits miles between battery and petrol', () => {
    const s = makeScenario('bmw-330e', 'PHEV', 2);
    s.vehicle.phevElectricMilesPct = 60;
    s.vehicle.miPerKWh = 3;
    s.vehicle.mpg = 40;
    const r = computeEnergy({ ...s, homeChargingPct: 100 }, 10000, prices);
    expect(r.annualBatteryKWh).toBeCloseTo(2000);
    expect(r.annualLitres).toBeCloseTo((4000 / 40) * LITRES_PER_IMPERIAL_GALLON, 4);
  });
});

describe('edge cases', () => {
  it('survives zero mileage without dividing by zero', () => {
    const r = computeEnergy(ev(), 0, prices);
    expect(r.costGBP).toBe(0);
    expect(r.pencePerMile).toBe(0);
    expect(Number.isFinite(r.blendedPPerKWh)).toBe(true);
  });
});
