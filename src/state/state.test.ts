import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, hydrate } from './codec';
import { defaultState, makeScenario } from './defaults';
import { missingInputs } from './readiness';

describe('the app starts empty', () => {
  it('has no cars, no mileage, no salary and no prices', () => {
    const s = defaultState();
    expect(s.scenarios).toEqual([]);
    expect(s.annualMiles).toBe(0);
    expect(s.grossSalaryGBP).toBe(0);
    expect(Object.values(s.prices).every((v) => v === 0)).toBe(true);
  });

  it('keeps neutral settings that are not claims about the driver', () => {
    const s = defaultState();
    expect(s.termYears).toBeGreaterThan(0);
    expect(s.taxYear).toBeTruthy();
  });
});

describe('readiness', () => {
  it('asks for a car first', () => {
    expect(missingInputs(defaultState())[0]).toMatch(/Add at least one car/);
  });

  it('asks for the fuel that the chosen cars actually use', () => {
    const petrol = { ...defaultState(), annualMiles: 9000, scenarios: [makeScenario('mercedes-a180', 'P', 0)] };
    expect(missingInputs(petrol)).toEqual(['Set the petrol price you pay']);

    const diesel = { ...defaultState(), annualMiles: 9000, scenarios: [makeScenario('bmw-320d', 'D', 0)] };
    expect(missingInputs(diesel)).toEqual(['Set the diesel price you pay']);

    const ev = { ...defaultState(), annualMiles: 9000, scenarios: [makeScenario('tesla-model-y-premium-awd', 'E', 0)] };
    expect(missingInputs(ev)).toEqual(['Set what you pay for electricity']);
  });

  it('accepts one electricity rate as enough, since free charging is real', () => {
    const s = defaultState();
    s.annualMiles = 9000;
    s.scenarios = [makeScenario('tesla-model-y-premium-awd', 'E', 0)];
    s.prices = { ...s.prices, homePPerKWh: 7 };
    expect(missingInputs(s)).toEqual([]);
  });

  it('is satisfied once a car, a mileage and the right price are set', () => {
    const s = defaultState();
    s.annualMiles = 9000;
    s.scenarios = [makeScenario('mercedes-a180', 'A180', 0)];
    s.prices = { ...s.prices, petrolPPerLitre: 135 };
    expect(missingInputs(s)).toEqual([]);
  });
});

describe('URL sharing', () => {
  it('round-trips a comparison', () => {
    const s = defaultState();
    s.annualMiles = 17500;
    s.scenarios = [makeScenario('tesla-model-y-premium-awd', 'My Model Y — £ and ⚡', 0)];
    const decoded = decodeState(encodeState(s));
    expect(decoded?.annualMiles).toBe(17500);
    expect(decoded?.scenarios[0].label).toBe('My Model Y — £ and ⚡');
  });

  it('returns null rather than throwing on a broken link', () => {
    expect(decodeState('not-valid-base64!!!')).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it('fills in fields an older link is missing', () => {
    const s = hydrate({ annualMiles: 5000, scenarios: [{ label: 'Just a label' }] });
    expect(s.annualMiles).toBe(5000);
    expect(s.termYears).toBeGreaterThan(0);
    expect(s.scenarios[0].label).toBe('Just a label');
    expect(s.scenarios[0].vehicle.fuelType).toBeDefined();
    expect(s.scenarios[0].ownership.model).toBe('personal');
  });

  it('survives nonsense, and keeps an empty comparison empty', () => {
    expect(hydrate(null).scenarios).toEqual([]);
    expect(hydrate(42).scenarios).toEqual([]);
    expect(hydrate({ scenarios: [] }).scenarios).toEqual([]);
  });
});
