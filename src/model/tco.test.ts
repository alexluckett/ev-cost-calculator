import { describe, expect, it } from 'vitest';
import { defaultState, makeScenario } from '../state/defaults';
import { computeAll, computeScenario } from './tco';
import type { AppState, Scenario } from './types';

/** The app starts empty, so tests build the comparison they need explicitly. */
function baseState(scenarios: Scenario[] = []): AppState {
  return {
    ...defaultState(),
    annualMiles: 10000,
    termYears: 3,
    grossSalaryGBP: 60000,
    prices: { homePPerKWh: 7, publicRapidPPerKWh: 45, petrolPPerLitre: 135, dieselPPerLitre: 142 },
    scenarios,
  };
}

const lineValue = (r: ReturnType<typeof computeScenario>, key: string) =>
  r.lines.find((l) => l.key === key)?.annualGBP ?? 0;

function companyEv(): Scenario {
  const s = makeScenario('tesla-model-y-premium-awd', 'Company EV', 0);
  s.ownership = { ...s.ownership, model: 'company-car', p11dGBP: 52000 };
  return s;
}

describe('totals', () => {
  it('sum to the annual total, and are consistent per mile and per month', () => {
    const s = makeScenario('mercedes-a180', 'A180', 0);
    const r = computeScenario(s, baseState([s]));
    expect(r.annualTotalGBP).toBeCloseTo(r.lines.reduce((a, l) => a + l.annualGBP, 0), 6);
    expect(r.monthlyTotalGBP).toBeCloseTo(r.annualTotalGBP / 12, 6);
    expect(r.costPerMilePence).toBeCloseTo((r.annualTotalGBP * 100) / 10000, 6);
    expect(r.termTotalGBP).toBeCloseTo(r.annualTotalGBP * 3, 6);
  });

  it('keep an electric car cheaper on energy than petrol', () => {
    const ev = makeScenario('tesla-model-y-premium-awd', 'EV', 0);
    const petrol = makeScenario('mercedes-a180', 'A180', 1);
    const [a, b] = computeAll(baseState([ev, petrol]));
    expect(a.annualEnergyGBP).toBeLessThan(b.annualEnergyGBP);
  });
});

describe('road tax', () => {
  it('charges the Expensive Car Supplement on a Model Y and warns about it', () => {
    const s = makeScenario('tesla-model-y-premium-awd', 'EV', 0);
    const r = computeScenario(s, baseState([s]));
    expect(lineValue(r, 'ved')).toBeGreaterThan(200);
    expect(r.warnings.join(' ')).toMatch(/Expensive Car Supplement/);
  });
});

describe('ownership', () => {
  it('charges a company car driver tax on the benefit, not the price of the car', () => {
    const s = companyEv();
    const r = computeScenario(s, baseState([s]));
    expect(r.bikPercent).toBe(4);
    expect(lineValue(r, 'bik')).toBeCloseTo(832, 0); // 40% of 4% of £52,000
  });

  it('drops standing costs when the contract bundles them', () => {
    const bundled = companyEv();
    const unbundled = { ...bundled, ownership: { ...bundled.ownership, bundledRunningCosts: false } };
    expect(lineValue(computeScenario(bundled, baseState([bundled])), 'insurance')).toBe(0);
    expect(lineValue(computeScenario(unbundled, baseState([unbundled])), 'insurance')).toBeGreaterThan(0);
  });

  it('nets salary sacrifice down by tax and NI relief', () => {
    const s = companyEv();
    s.ownership = { ...s.ownership, model: 'salary-sacrifice', monthlySacrificeGBP: 600 };
    const state = { ...baseState([s]), grossSalaryGBP: 70000 };
    // £7,200 gross, relieved at 42%.
    expect(lineValue(computeScenario(s, state), 'sacrifice')).toBeCloseTo(7200 * 0.58, 1);
  });

  it('is worth more to someone caught in the taper', () => {
    const s = companyEv();
    s.ownership = { ...s.ownership, model: 'salary-sacrifice', monthlySacrificeGBP: 600 };
    const at70k = lineValue(computeScenario(s, { ...baseState([s]), grossSalaryGBP: 70000 }), 'sacrifice');
    const at110k = lineValue(computeScenario(s, { ...baseState([s]), grossSalaryGBP: 110000 }), 'sacrifice');
    expect(at110k).toBeLessThan(at70k);
  });
});

describe('an employer that funds all charging', () => {
  it('costs an electric company car driver nothing but the benefit tax', () => {
    const s = companyEv();
    s.ownership = { ...s.ownership, employerPaysEnergy: true };
    const r = computeScenario(s, baseState([s]));
    expect(r.annualEnergyGBP).toBe(0);
    // No fuel benefit: electricity is not a "fuel" for benefit purposes.
    expect(lineValue(r, 'fuel-benefit')).toBe(0);
    expect(lineValue(r, 'bik')).toBeGreaterThan(0);
  });

  it('does trigger the fuel benefit charge on a petrol company car', () => {
    const s = makeScenario('mercedes-a180', 'A180', 0);
    s.ownership = { ...s.ownership, model: 'company-car', employerPaysEnergy: true, p11dGBP: 28000 };
    const r = computeScenario(s, baseState([s]));
    expect(r.annualEnergyGBP).toBe(0);
    expect(lineValue(r, 'fuel-benefit')).toBeGreaterThan(0);
  });
});

describe('ownership is per car, not global', () => {
  it('lets a company EV and a personally owned petrol car sit in one comparison', () => {
    const ev = companyEv();
    ev.ownership = { ...ev.ownership, employerPaysEnergy: true };
    const petrol = makeScenario('mercedes-a180', 'My old A-Class', 1);

    const [evResult, petrolResult] = computeAll(baseState([ev, petrol]));

    expect(evResult.annualEnergyGBP).toBe(0);
    expect(evResult.bikPercent).toBeGreaterThan(0);
    expect(petrolResult.annualEnergyGBP).toBeGreaterThan(0);
    expect(petrolResult.bikPercent).toBe(0);
    expect(lineValue(petrolResult, 'bik')).toBe(0);
  });
});
