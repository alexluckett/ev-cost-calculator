import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICES } from '../data/assumptions';
import { defaultState, makeScenario } from '../state/defaults';
import { AXES, breakEven, computeAll, describeBreakEven, sensitivitySeries, withAxisValue } from './compare';
import { computeScenario } from './tco';
import type { AppState, Scenario } from './types';

/**
 * The app itself starts empty, so these tests build the comparison they need
 * explicitly rather than relying on anything being there by default.
 */
function baseState(): AppState {
  const state = defaultState();
  state.usage = { annualMiles: 10000, businessMilesPct: 0, termYears: 3 };
  state.prices = { ...DEFAULT_PRICES };
  state.tax = { ...state.tax, grossSalaryGBP: 60000 };
  state.scenarios = [
    makeScenario('tesla-model-y-premium-awd', 'My Model Y', 0),
    makeScenario('vw-golf-15tsi', 'Modern petrol', 1),
    makeScenario('vw-golf-14tsi-mk6', 'My old car', 2),
  ];
  state.baselineId = state.scenarios[0].id;
  return state;
}

function run(state: AppState, scenario: Scenario) {
  return computeScenario(
    scenario,
    state.usage,
    state.prices,
    state.tax,
    state.assumptions,
    state.includeCapitalCosts,
  );
}

function lineValue(result: ReturnType<typeof run>, key: string): number {
  return result.lines.find((l) => l.key === key)?.annualGBP ?? 0;
}

describe('scenario totals', () => {
  it('sums to the annual total and is consistent per mile and per month', () => {
    const state = baseState();
    const result = run(state, state.scenarios[0]);
    const sum = result.lines.reduce((a, l) => a + l.annualGBP, 0);
    expect(result.annualTotalGBP).toBeCloseTo(sum, 6);
    expect(result.monthlyTotalGBP).toBeCloseTo(result.annualTotalGBP / 12, 6);
    expect(result.costPerMilePence).toBeCloseTo((result.annualTotalGBP * 100) / 10000, 6);
  });

  it('multiplies out to the term total when energy prices are flat', () => {
    const state = baseState();
    const result = run(state, state.scenarios[0]);
    expect(result.termTotalGBP).toBeCloseTo(result.annualTotalGBP * 3, 4);
  });

  it('inflates only the energy portion over the term', () => {
    const state = baseState();
    state.assumptions = { ...state.assumptions, energyInflationPct: 10 };
    const result = run(state, state.scenarios[0]);
    const flat = (result.annualTotalGBP - result.annualEnergyGBP) * 3;
    expect(result.termTotalGBP).toBeGreaterThan(result.annualTotalGBP * 3);
    expect(result.termTotalGBP - flat).toBeGreaterThan(result.annualEnergyGBP * 3);
  });

  it('keeps an electric car cheaper on energy than petrol at default prices', () => {
    const state = baseState();
    const [ev, petrol] = computeAll(state);
    expect(ev.annualEnergyGBP).toBeLessThan(petrol.annualEnergyGBP);
    expect(ev.energy.pencePerMile).toBeLessThan(petrol.energy.pencePerMile);
  });
});

describe('VED handling', () => {
  it('charges the Expensive Car Supplement on a new Model Y', () => {
    const state = baseState();
    const result = run(state, state.scenarios[0]);
    expect(lineValue(result, 'ved')).toBeGreaterThan(195);
    expect(result.warnings.join(' ')).toMatch(/Expensive Car Supplement/);
  });

  it('honours a manual VED override', () => {
    const state = baseState();
    const scenario = {
      ...state.scenarios[0],
      running: { ...state.scenarios[0].running, vedOverrideGBP: 0 },
    };
    expect(lineValue(run(state, scenario), 'ved')).toBe(0);
  });
});

describe('ownership models', () => {
  it('charges a company car driver BiK instead of the price of the car', () => {
    const state = baseState();
    const scenario: Scenario = {
      ...state.scenarios[0],
      ownership: { ...state.scenarios[0].ownership, model: 'company-car', p11dGBP: 52000 },
    };
    const result = run(state, scenario);
    expect(result.tax.bikPercent).toBeGreaterThan(0);
    expect(lineValue(result, 'bik')).toBeGreaterThan(0);
    expect(lineValue(result, 'depreciation')).toBe(0);
    expect(lineValue(result, 'finance')).toBe(0);
  });

  it('drops bundled running costs for a contract that includes them', () => {
    const state = baseState();
    const bundled: Scenario = {
      ...state.scenarios[0],
      ownership: { ...state.scenarios[0].ownership, model: 'company-car', bundledRunningCosts: true },
    };
    const unbundled: Scenario = {
      ...bundled,
      ownership: { ...bundled.ownership, bundledRunningCosts: false },
    };
    expect(lineValue(run(state, bundled), 'insurance')).toBe(0);
    expect(lineValue(run(state, unbundled), 'insurance')).toBeGreaterThan(0);
  });

  it('nets salary sacrifice down by tax and NI relief', () => {
    const state = baseState();
    state.includeCapitalCosts = true;
    state.tax = { ...state.tax, grossSalaryGBP: 70000 };
    const scenario: Scenario = {
      ...state.scenarios[0],
      ownership: {
        ...state.scenarios[0].ownership,
        model: 'salary-sacrifice',
        monthlyPaymentGBP: 600,
      },
    };
    const result = run(state, scenario);
    // £7,200 gross, relieved at 42%.
    expect(result.tax.salarySacrificeGrossGBP).toBeCloseTo(7200, 2);
    expect(result.tax.salarySacrificeNetGBP).toBeCloseTo(7200 * 0.58, 1);
    expect(lineValue(result, 'sacrifice')).toBeCloseTo(7200 * 0.58, 1);
  });

  it('is worth more to someone caught in the personal allowance taper', () => {
    const state = baseState();
    state.includeCapitalCosts = true;
    const scenario: Scenario = {
      ...state.scenarios[0],
      ownership: { ...state.scenarios[0].ownership, model: 'salary-sacrifice', monthlyPaymentGBP: 600 },
    };
    const at70k = run({ ...state, tax: { ...state.tax, grossSalaryGBP: 70000 } }, scenario);
    const at110k = run({ ...state, tax: { ...state.tax, grossSalaryGBP: 110000 } }, scenario);
    expect(at110k.tax.salarySacrificeNetGBP).toBeLessThan(at70k.tax.salarySacrificeNetGBP);
  });

  it('removes the fuel bill but adds a fuel benefit charge when the employer pays for petrol', () => {
    const state = baseState();
    const scenario: Scenario = {
      ...state.scenarios[1],
      ownership: {
        ...state.scenarios[1].ownership,
        model: 'company-car',
        employerPaysPrivateFuel: true,
      },
    };
    const result = run(state, scenario);
    expect(result.annualEnergyGBP).toBe(0);
    expect(lineValue(result, 'fuel-benefit')).toBeGreaterThan(0);
  });

  it('charges no fuel benefit on an electric company car', () => {
    const state = baseState();
    const scenario: Scenario = {
      ...state.scenarios[0],
      ownership: {
        ...state.scenarios[0].ownership,
        model: 'company-car',
        employerPaysPrivateFuel: true,
      },
    };
    const result = run(state, scenario);
    expect(result.annualEnergyGBP).toBe(0);
    expect(lineValue(result, 'fuel-benefit')).toBe(0);
  });

  it('treats AMAP payments as income against the cost', () => {
    const state = baseState();
    state.usage = { ...state.usage, businessMilesPct: 50 };
    const scenario: Scenario = {
      ...state.scenarios[0],
      ownership: { ...state.scenarios[0].ownership, claimsAmap: true },
    };
    const withClaim = run(state, scenario);
    const without = run(state, state.scenarios[0]);
    expect(lineValue(withClaim, 'amap')).toBeCloseTo(-2250, 2);
    expect(withClaim.annualTotalGBP).toBeLessThan(without.annualTotalGBP);
  });

  it('excludes the cost of the car when capital costs are switched off', () => {
    const state = baseState();
    const scenario: Scenario = {
      ...state.scenarios[0],
      ownership: {
        ...state.scenarios[0].ownership,
        model: 'personal-cash',
        includeDepreciation: true,
        residualValuePct: 50,
      },
    };
    const excluded = run({ ...state, includeCapitalCosts: false }, scenario);
    const included = run({ ...state, includeCapitalCosts: true }, scenario);
    expect(lineValue(excluded, 'depreciation')).toBe(0);
    expect(lineValue(included, 'depreciation')).toBeGreaterThan(0);
  });
});

describe('an employer that funds all charging', () => {
  // The real case this covers: an electric company car whose employer pays for
  // every mile, private ones included. Electricity is not a "fuel" for benefit
  // purposes, so unlike petrol this costs the driver nothing in tax.
  function companyEv(state: AppState): Scenario {
    const s = makeScenario('tesla-model-y-premium-awd', 'Company EV', 0);
    return {
      ...s,
      ownership: {
        ...s.ownership,
        model: 'company-car',
        monthlyPaymentGBP: 600,
        employerPaysPrivateFuel: true,
        p11dGBP: 52000,
      },
      running: state.scenarios[0].running,
    };
  }

  it('costs the driver nothing but the BiK, with no fuel benefit charge', () => {
    const state = baseState();
    const result = run(state, companyEv(state));
    expect(result.annualEnergyGBP).toBe(0);
    expect(lineValue(result, 'fuel-benefit')).toBe(0);
    expect(lineValue(result, 'bik')).toBeGreaterThan(0);
  });

  it('is unaffected by the business mileage share, at any value', () => {
    const state = baseState();
    const scenario = companyEv(state);
    const totals = [0, 50, 100].map(
      (businessMilesPct) =>
        run({ ...state, usage: { ...state.usage, businessMilesPct } }, scenario).annualTotalGBP,
    );
    // Setting business mileage to 100% is a common guess for this situation.
    // It changes nothing, which is why the app says so rather than leaving the
    // field looking like it might be the right lever.
    expect(totals[1]).toBeCloseTo(totals[0], 6);
    expect(totals[2]).toBeCloseTo(totals[0], 6);
  });

  it('charges the energy to the employer, not the driver', () => {
    const state = baseState();
    const result = run(state, companyEv(state));
    expect(result.tax.employerEnergyGBP).toBeCloseTo(result.energy.totalCostGBP, 6);
    expect(result.tax.employerEnergyGBP).toBeGreaterThan(0);
  });

  it('leaves the employer nothing to pay for energy when it funds none', () => {
    const state = baseState();
    const scenario = companyEv(state);
    const selfFunded = {
      ...scenario,
      ownership: { ...scenario.ownership, employerPaysPrivateFuel: false },
    };
    expect(run(state, selfFunded).tax.employerEnergyGBP).toBe(0);
    expect(run(state, selfFunded).annualEnergyGBP).toBeGreaterThan(0);
  });

  it('raises the employer’s net cost by the energy it buys, after tax relief', () => {
    const state = baseState();
    const scenario = companyEv(state);
    const funded = run(state, scenario);
    const notFunded = run(state, {
      ...scenario,
      ownership: { ...scenario.ownership, employerPaysPrivateFuel: false },
    });
    const corp = state.tax.corporationTaxRatePct / 100;
    expect(funded.tax.employerNetCostGBP - notFunded.tax.employerNetCostGBP).toBeCloseTo(
      funded.energy.totalCostGBP * (1 - corp),
      4,
    );
  });
});

describe('ownership is per car, not global', () => {
  it('lets a company EV and a personally owned petrol car sit in one comparison', () => {
    const state = baseState();
    state.usage = { ...state.usage, businessMilesPct: 30 };

    const ev = makeScenario('tesla-model-y-premium-awd', 'Company EV', 0);
    ev.ownership = {
      ...ev.ownership,
      model: 'company-car',
      monthlyPaymentGBP: 600,
      employerPaysPrivateFuel: true,
      p11dGBP: 52000,
    };

    const petrol = makeScenario('mercedes-a180', 'My old A-Class', 1);
    petrol.ownership = { ...petrol.ownership, model: 'personal-cash', claimsAmap: true };

    const evResult = run(state, ev);
    const petrolResult = run(state, petrol);

    // The EV's energy is the company's problem; the driver sees only BiK.
    expect(evResult.annualEnergyGBP).toBe(0);
    expect(evResult.tax.employerEnergyGBP).toBeGreaterThan(0);
    expect(lineValue(evResult, 'bik')).toBeGreaterThan(0);

    // The petrol car is bought and fuelled by the driver, who claims AMAP.
    expect(petrolResult.annualEnergyGBP).toBeGreaterThan(0);
    expect(petrolResult.tax.bikValueGBP).toBe(0);
    expect(lineValue(petrolResult, 'amap')).toBeLessThan(0);
    expect(lineValue(petrolResult, 'bik')).toBe(0);
  });
});

describe('the announced per-mile road charge', () => {
  it('is off by default and applies only to plug-in cars when enabled', () => {
    const state = baseState();
    expect(lineValue(run(state, state.scenarios[0]), 'road-charge')).toBe(0);

    const on = { ...state, assumptions: { ...state.assumptions, applyEvRoadCharge: true } };
    expect(lineValue(run(on, on.scenarios[0]), 'road-charge')).toBeCloseTo(300, 2);
    expect(lineValue(run(on, on.scenarios[1]), 'road-charge')).toBe(0);
  });
});

describe('CO2', () => {
  it('rates an electric car below a petrol one on default grid intensity', () => {
    const state = baseState();
    const [ev, petrol] = computeAll(state);
    expect(ev.annualCO2Kg).toBeLessThan(petrol.annualCO2Kg);
    expect(ev.annualCO2Kg).toBeGreaterThan(0);
  });
});

describe('break-even solving', () => {
  it('finds the petrol price at which two cars cost the same', () => {
    const state = baseState();
    const [ev, petrol] = state.scenarios;
    const result = breakEven(state, ev.id, petrol.id, 'petrolPrice');
    expect(result.value).not.toBeNull();

    // Verified by re-running the model at the solved price.
    const at = withAxisValue(state, 'petrolPrice', result.value as number);
    const [a, b] = computeAll(at);
    expect(a.annualTotalGBP).toBeCloseTo(b.annualTotalGBP, 4);
  });

  it('solves the mileage crossover too', () => {
    const state = baseState();
    const [ev, , old] = state.scenarios;
    const result = breakEven(state, ev.id, old.id, 'annualMiles');
    if (result.value !== null && result.inRange) {
      const at = withAxisValue(state, 'annualMiles', result.value);
      const results = computeAll(at);
      const a = results.find((r) => r.scenarioId === ev.id)!;
      const b = results.find((r) => r.scenarioId === old.id)!;
      expect(a.annualTotalGBP).toBeCloseTo(b.annualTotalGBP, 3);
    }
  });

  it('names the car that is cheaper across the whole range', () => {
    const state = baseState();
    const [ev, petrol] = state.scenarios;
    const result = breakEven(state, ev.id, petrol.id, 'publicRapidRate');
    const sentence = describeBreakEven(result, ev.label, petrol.label, ev.id);
    // The EV wins on energy at every plausible rapid rate at this mileage.
    expect(result.cheaperAtMin).toBe(ev.id);
    expect(sentence).toContain(ev.label);
    expect(sentence).not.toContain('undefined');
  });

  it('describes an in-range crossover with the price and the winner below it', () => {
    const state = baseState();
    const [ev, , old] = state.scenarios;
    const result = breakEven(state, ev.id, old.id, 'annualMiles');
    const sentence = describeBreakEven(result, ev.label, old.label, ev.id);
    expect(sentence).toMatch(result.inRange ? /cost the same at/ : /No crossover/);
  });

  it('reports no crossover when an axis cannot close the gap', () => {
    const state = baseState();
    const a = makeScenario('vw-golf-15tsi', 'A', 0);
    const b = { ...makeScenario('vw-golf-15tsi', 'B', 1), id: 'b' };
    const result = breakEven({ ...state, scenarios: [a, b] }, a.id, 'b', 'homeOffPeakRate');
    expect(result.value).toBeNull();
    expect(describeBreakEven(result, 'A', 'B', a.id)).toContain('does not change the gap');
  });
});

describe('sensitivity sweeps', () => {
  it('produces a point per sample for every scenario', () => {
    const state = baseState();
    const series = sensitivitySeries(state, 'annualMiles', 10);
    expect(series).toHaveLength(11);
    expect(series[0].x).toBe(AXES.annualMiles.min);
    for (const point of series) {
      expect(Object.keys(point.values)).toHaveLength(state.scenarios.length);
    }
  });

  it('makes a petrol car more expensive as mileage rises', () => {
    const state = baseState();
    const series = sensitivitySeries(state, 'annualMiles', 4);
    const id = state.scenarios[1].id;
    expect(series[4].values[id]).toBeGreaterThan(series[0].values[id]);
  });

  it('makes an EV dearer as rapid charging takes over', () => {
    const state = baseState();
    const series = sensitivitySeries(state, 'rapidSharePct', 4);
    const id = state.scenarios[0].id;
    expect(series[4].values[id]).toBeGreaterThan(series[0].values[id]);
  });
});
