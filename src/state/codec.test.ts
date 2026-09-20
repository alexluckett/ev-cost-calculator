import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, hydrate } from './codec';
import { defaultState, makeScenario } from './defaults';

describe('URL state codec', () => {
  it('round-trips a comparison', () => {
    const state = defaultState();
    state.usage.annualMiles = 17500;
    state.scenarios = [makeScenario('tesla-model-y-premium-awd', 'My Model Y', 0)];
    state.scenarios[0].label = 'My Model Y — £ and ⚡';
    const decoded = decodeState(encodeState(state));
    expect(decoded?.usage.annualMiles).toBe(17500);
    expect(decoded?.scenarios[0].label).toBe('My Model Y — £ and ⚡');
    expect(decoded?.scenarios).toHaveLength(state.scenarios.length);
  });

  it('returns null rather than throwing on a broken link', () => {
    expect(decodeState('not-valid-base64!!!')).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it('fills in fields an older link is missing', () => {
    const partial = { usage: { annualMiles: 5000 }, scenarios: [{ label: 'Just a label' }] };
    const state = hydrate(partial);
    expect(state.usage.annualMiles).toBe(5000);
    expect(state.usage.termYears).toBeGreaterThan(0);
    expect(state.scenarios[0].label).toBe('Just a label');
    expect(state.scenarios[0].vehicle.fuelType).toBeDefined();
    expect(state.scenarios[0].charging.mix.homeOffPeak).toBeGreaterThan(0);
    expect(state.baselineId).toBe(state.scenarios[0].id);
  });

  it('survives complete nonsense', () => {
    expect(hydrate(null).scenarios).toEqual([]);
    expect(hydrate(42).scenarios).toEqual([]);
    expect(hydrate(undefined).usage.termYears).toBeGreaterThan(0);
  });

  it('keeps an empty comparison empty instead of putting cars back', () => {
    const state = hydrate({ scenarios: [] });
    expect(state.scenarios).toEqual([]);
    expect(state.baselineId).toBe('');
  });
});
