import { describe, expect, it } from 'vitest';
import { makeScenario } from '../state/defaults';
import {
  bikPercentFor,
  employeeNiFor,
  fuelBenefitFor,
  incomeTaxFor,
  marginalRatePct,
  personalAllowanceFor,
  salarySacrificeSaving,
  taxOnBenefit,
  vedFor,
} from './tax';
import type { VehicleSpec } from './types';

const specOf = (id: string): VehicleSpec => makeScenario(id, 'x', 0).vehicle;

describe('income tax and NI', () => {
  it('tapers the personal allowance above £100,000', () => {
    expect(personalAllowanceFor(60000)).toBe(12570);
    expect(personalAllowanceFor(110000)).toBe(7570);
    expect(personalAllowanceFor(125140)).toBe(0);
  });

  it('matches hand-worked cases', () => {
    expect(incomeTaxFor(12000)).toBe(0);
    expect(incomeTaxFor(30000)).toBeCloseTo(3486, 2); // £17,430 at 20%
    expect(incomeTaxFor(60000)).toBeCloseTo(7540 + 3892, 2); // 20% then 40%
  });

  it('charges NI at 8% then 2%', () => {
    expect(employeeNiFor(50270)).toBeCloseTo((50270 - 12570) * 0.08, 2);
    expect(employeeNiFor(60270)).toBeCloseTo((50270 - 12570) * 0.08 + 10000 * 0.02, 2);
    expect(employeeNiFor(10000)).toBe(0);
  });

  it('derives the marginal rate, including the 60% trap', () => {
    expect(marginalRatePct(30000)).toBeCloseTo(28, 5);
    expect(marginalRatePct(70000)).toBeCloseTo(42, 5);
    // 40% on the income plus 40% on the 50p of allowance withdrawn, plus 2% NI.
    expect(marginalRatePct(110000)).toBeCloseTo(62, 5);
  });
});

describe('salary sacrifice', () => {
  it('saves tax and NI at the marginal rate', () => {
    expect(salarySacrificeSaving(70000, 6000)).toBeCloseTo(6000 * 0.42, 2);
  });

  it('is worth far more inside the taper', () => {
    expect(salarySacrificeSaving(115000, 6000)).toBeCloseTo(6000 * 0.62, 2);
  });

  it('never sacrifices more than the salary', () => {
    expect(salarySacrificeSaving(20000, 999999)).toBeLessThanOrEqual(20000);
  });
});

describe('company car tax', () => {
  it('uses the zero-emission schedule for an EV', () => {
    const ev = specOf('tesla-model-y-premium-awd');
    expect(bikPercentFor(ev, '2025/26')).toBe(3);
    expect(bikPercentFor(ev, '2026/27')).toBe(4);
    expect(bikPercentFor(ev, '2029/30')).toBe(9);
  });

  it('bands a plug-in hybrid by electric range, not CO2 alone', () => {
    const short = specOf('bmw-330e'); // 37 electric miles
    const long = specOf('mercedes-c300e'); // 68 electric miles
    expect(bikPercentFor(short, '2026/27')).toBe(14);
    expect(bikPercentFor(long, '2026/27')).toBe(10);
    expect(bikPercentFor({ ...long, phevElectricRangeMi: 70 }, '2026/27')).toBe(7);
  });

  it('steps by one point every 5 g/km above 55, capped', () => {
    const car = specOf('mercedes-a180');
    expect(bikPercentFor({ ...car, co2gPerKm: 55 }, '2025/26')).toBe(17);
    expect(bikPercentFor({ ...car, co2gPerKm: 59 }, '2025/26')).toBe(17);
    expect(bikPercentFor({ ...car, co2gPerKm: 60 }, '2025/26')).toBe(18);
    expect(bikPercentFor({ ...car, co2gPerKm: 300 }, '2025/26')).toBe(37);
    expect(bikPercentFor({ ...car, co2gPerKm: 300 }, '2029/30')).toBe(39);
  });

  it('adds the surcharge for a pre-RDE2 diesel only', () => {
    expect(bikPercentFor(specOf('bmw-320d'), '2025/26')).toBe(31);
    const old = { ...specOf('nissan-qashqai-15dci'), co2gPerKm: 128 };
    expect(bikPercentFor(old, '2025/26')).toBe(35);
  });

  it('taxes a benefit at the rate it reaches on top of salary', () => {
    expect(taxOnBenefit(2080, 60000)).toBeCloseTo(832, 2); // 40% of £2,080
  });
});

describe('car fuel benefit', () => {
  it('is charged on a combustion car', () => {
    expect(fuelBenefitFor(specOf('mercedes-a180'), 30)).toBeCloseTo(27800 * 0.3, 2);
  });

  it('is never charged on an electric car, which is the whole perk', () => {
    expect(fuelBenefitFor(specOf('tesla-model-y-premium-awd'), 4)).toBe(0);
  });
});

describe('road tax', () => {
  it('gives a zero-emission car the higher £50,000 threshold', () => {
    const ev = { ...specOf('tesla-model-y-premium-awd'), listPriceGBP: 45000, firstRegisteredYear: 2026 };
    const petrol = { ...specOf('mercedes-a180'), listPriceGBP: 45000, firstRegisteredYear: 2026 };
    expect(vedFor(ev, 2026, 3).supplementGBP).toBe(0);
    expect(vedFor(petrol, 2026, 3).supplementGBP).toBeGreaterThan(0);
  });

  it('averages the supplement across the term', () => {
    const ev = { ...specOf('tesla-model-y-premium-awd'), firstRegisteredYear: 2026 }; // £51,990
    // Years 0, 1 and 2 of ownership: the supplement bites in two of them.
    expect(vedFor(ev, 2026, 3).supplementGBP).toBeCloseTo((2 / 3) * 440, 2);
  });

  it('drops the supplement once the car is more than six years old', () => {
    const ev = { ...specOf('tesla-model-y-premium-awd'), firstRegisteredYear: 2018 };
    expect(vedFor(ev, 2026, 3).supplementGBP).toBe(0);
  });

  it('uses the legacy CO2 bands for a pre-2017 car', () => {
    const old = specOf('ford-focus-16-mk2'); // 159 g/km, 2010 -> band G
    const r = vedFor(old, 2026, 3);
    expect(r.annualGBP).toBe(275);
    expect(r.explanation).toContain('band G');
  });

  it('picks the right legacy band at each boundary', () => {
    const s = specOf('ford-focus-16-mk2');
    const at = (co2: number) => vedFor({ ...s, co2gPerKm: co2 }, 2026, 3).annualGBP;
    expect(at(100)).toBe(20);
    expect(at(121)).toBe(170);
    expect(at(150)).toBe(225);
    expect(at(151)).toBe(275);
    expect(at(256)).toBe(790);
  });
});
