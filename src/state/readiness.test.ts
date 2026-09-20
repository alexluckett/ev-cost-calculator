import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICES } from '../data/assumptions';
import { defaultState, makeScenario } from './defaults';
import { businessMileageMatters, isReady, missingInputs } from './readiness';

describe('the app starts empty', () => {
  it('has no cars, no mileage, no salary and no prices', () => {
    const state = defaultState();
    expect(state.scenarios).toEqual([]);
    expect(state.baselineId).toBe('');
    expect(state.usage.annualMiles).toBe(0);
    expect(state.tax.grossSalaryGBP).toBe(0);
    expect(Object.values(state.prices).every((v) => v === 0)).toBe(true);
  });

  it('keeps neutral app settings that are not claims about the driver', () => {
    const state = defaultState();
    expect(state.usage.termYears).toBeGreaterThan(0);
    expect(state.tax.taxYear).toBeTruthy();
    expect(state.assumptions.acChargingEfficiencyPct).toBeGreaterThan(0);
  });

  it('is not ready, and says a car is the first thing needed', () => {
    const state = defaultState();
    expect(isReady(state)).toBe(false);
    expect(missingInputs(state).map((m) => m.id)).toContain('no-cars');
  });
});

describe('readiness', () => {
  it('asks for mileage once a car is added', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('mercedes-a180', 'My A-Class', 0)];
    expect(missingInputs(state).map((m) => m.id)).toContain('miles');
  });

  it('asks for the petrol price for a petrol car', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('mercedes-a180', 'My A-Class', 0)];
    state.usage.annualMiles = 9000;
    expect(missingInputs(state).map((m) => m.id)).toEqual(['petrol']);
  });

  it('asks for diesel rather than petrol for a diesel car', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('bmw-320d', 'Diesel', 0)];
    state.usage.annualMiles = 9000;
    expect(missingInputs(state).map((m) => m.id)).toEqual(['diesel']);
  });

  it('asks for electricity for an EV', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('tesla-model-y-premium-awd', 'EV', 0)];
    state.usage.annualMiles = 9000;
    expect(missingInputs(state).map((m) => m.id)).toEqual(['electricity']);
  });

  it('accepts a single electricity rate as enough, since free charging is real', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('tesla-model-y-premium-awd', 'EV', 0)];
    state.usage.annualMiles = 9000;
    state.prices = { ...state.prices, homeOffPeakPPerKWh: 7 };
    expect(isReady(state)).toBe(true);
  });

  it('asks for both fuels when comparing an EV against a diesel', () => {
    const state = defaultState();
    state.scenarios = [
      makeScenario('tesla-model-y-premium-awd', 'EV', 0),
      makeScenario('bmw-320d', 'Diesel', 1),
    ];
    state.usage.annualMiles = 9000;
    expect(missingInputs(state).map((m) => m.id).sort()).toEqual(['diesel', 'electricity']);
  });

  it('is ready once a car, a mileage and the right prices are set', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('mercedes-a180', 'My A-Class', 0)];
    state.usage.annualMiles = 9000;
    state.prices = { ...DEFAULT_PRICES };
    expect(isReady(state)).toBe(true);
    expect(missingInputs(state)).toEqual([]);
  });
});

describe('businessMileageMatters', () => {
  it('is false when nobody claims anything back', () => {
    const state = defaultState();
    state.scenarios = [makeScenario('mercedes-a180', 'Mine', 0)];
    expect(businessMileageMatters(state)).toBe(false);
  });

  it('is true for a personally owned car claiming the approved rates', () => {
    const state = defaultState();
    const s = makeScenario('mercedes-a180', 'Mine', 0);
    s.ownership = { ...s.ownership, claimsAmap: true };
    state.scenarios = [s];
    expect(businessMileageMatters(state)).toBe(true);
  });

  it('is false for a company car whose employer funds all the charging', () => {
    const state = defaultState();
    const s = makeScenario('tesla-model-y-premium-awd', 'Company EV', 0);
    s.ownership = {
      ...s.ownership,
      model: 'company-car',
      claimsAdvisoryRate: true,
      employerPaysPrivateFuel: true,
    };
    state.scenarios = [s];
    expect(businessMileageMatters(state)).toBe(false);
  });

  it('is true for a company car whose driver pays for energy and reclaims it', () => {
    const state = defaultState();
    const s = makeScenario('tesla-model-y-premium-awd', 'Company EV', 0);
    s.ownership = {
      ...s.ownership,
      model: 'company-car',
      claimsAdvisoryRate: true,
      employerPaysPrivateFuel: false,
    };
    state.scenarios = [s];
    expect(businessMileageMatters(state)).toBe(true);
  });

  it('is true if any one car in a mixed comparison claims', () => {
    const state = defaultState();
    const ev = makeScenario('tesla-model-y-premium-awd', 'Company EV', 0);
    ev.ownership = { ...ev.ownership, model: 'company-car', employerPaysPrivateFuel: true };
    const petrol = makeScenario('mercedes-a180', 'Old petrol', 1);
    petrol.ownership = { ...petrol.ownership, claimsAmap: true };
    state.scenarios = [ev, petrol];
    expect(businessMileageMatters(state)).toBe(true);
  });
});
