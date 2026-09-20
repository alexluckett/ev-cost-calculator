import { describe, expect, it } from 'vitest';
import { makeScenario } from '../state/defaults';
import {
  advisoryElectricPaymentFor,
  amapPaymentFor,
  bikPercentFor,
  bikTaxFor,
  employeeNiFor,
  incomeTaxFor,
  marginalRatePct,
  personalAllowanceFor,
  salarySacrificeSaving,
  vedFor,
} from './tax';
import type { VehicleSpec } from './types';

function specOf(presetId: string): VehicleSpec {
  return makeScenario(presetId, 'x', 0).vehicle;
}

describe('personal allowance', () => {
  it('is full below the taper threshold', () => {
    expect(personalAllowanceFor(60000)).toBe(12570);
  });

  it('tapers by £1 for every £2 above £100,000', () => {
    expect(personalAllowanceFor(110000)).toBe(7570);
  });

  it('is gone by £125,140', () => {
    expect(personalAllowanceFor(125140)).toBe(0);
    expect(personalAllowanceFor(200000)).toBe(0);
  });
});

describe('income tax', () => {
  it('charges nothing below the allowance', () => {
    expect(incomeTaxFor(12000, 'uk')).toBe(0);
  });

  it('matches a hand-worked basic rate case', () => {
    // £30,000 − £12,570 = £17,430 taxed at 20%.
    expect(incomeTaxFor(30000, 'uk')).toBeCloseTo(3486, 2);
  });

  it('matches a hand-worked higher rate case', () => {
    // £37,700 at 20% plus £9,730 at 40%.
    expect(incomeTaxFor(60000, 'uk')).toBeCloseTo(7540 + 3892, 2);
  });

  it('applies Scottish bands to a Scottish taxpayer', () => {
    expect(incomeTaxFor(60000, 'scotland')).toBeGreaterThan(incomeTaxFor(60000, 'uk'));
  });
});

describe('national insurance', () => {
  it('charges 8% between the thresholds and 2% above', () => {
    expect(employeeNiFor(50270)).toBeCloseTo((50270 - 12570) * 0.08, 2);
    expect(employeeNiFor(60270)).toBeCloseTo((50270 - 12570) * 0.08 + 10000 * 0.02, 2);
  });

  it('charges nothing below the primary threshold', () => {
    expect(employeeNiFor(10000)).toBe(0);
  });
});

describe('marginal rate', () => {
  it('is 20% plus 8% NI for a basic rate taxpayer', () => {
    expect(marginalRatePct(30000, 'uk')).toBeCloseTo(28, 5);
  });

  it('is 40% plus 2% NI for a higher rate taxpayer', () => {
    expect(marginalRatePct(70000, 'uk')).toBeCloseTo(42, 5);
  });

  it('finds the 60% trap created by the personal allowance taper', () => {
    // 40% on the income plus 40% on the £0.50 of allowance withdrawn, plus 2% NI.
    expect(marginalRatePct(110000, 'uk')).toBeCloseTo(62, 5);
  });
});

describe('salary sacrifice', () => {
  it('saves tax and NI at the marginal rate', () => {
    const saving = salarySacrificeSaving(70000, 6000, 'uk');
    expect(saving.effectiveRatePct).toBeCloseTo(42, 3);
    expect(saving.taxSaved).toBeCloseTo(2400, 2);
    expect(saving.niSaved).toBeCloseTo(120, 2);
  });

  it('is worth far more inside the taper', () => {
    const saving = salarySacrificeSaving(115000, 6000, 'uk');
    expect(saving.effectiveRatePct).toBeCloseTo(62, 3);
  });

  it('never sacrifices more than the salary', () => {
    const saving = salarySacrificeSaving(20000, 999999, 'uk');
    expect(saving.totalSaved).toBeLessThanOrEqual(20000);
  });
});

describe('benefit in kind percentages', () => {
  it('uses the zero-emission schedule for an EV', () => {
    expect(bikPercentFor(specOf('tesla-model-y-premium-awd'), '2025/26')).toBe(3);
    expect(bikPercentFor(specOf('tesla-model-y-premium-awd'), '2026/27')).toBe(4);
    expect(bikPercentFor(specOf('tesla-model-y-premium-awd'), '2029/30')).toBe(9);
  });

  it('bands a plug-in hybrid by electric range, not CO2 alone', () => {
    const shortRange = specOf('bmw-330e'); // 37 electric miles -> 30-39 band
    const midRange = specOf('kia-niro-phev'); // 40 electric miles -> 40-69 band
    const longRange = specOf('mercedes-c300e'); // 68 electric miles -> 40-69 band
    expect(bikPercentFor(shortRange, '2026/27')).toBe(14);
    expect(bikPercentFor(midRange, '2026/27')).toBe(10);
    expect(bikPercentFor(longRange, '2026/27')).toBe(10);
    // Crossing 70 electric miles is worth three percentage points.
    expect(bikPercentFor({ ...longRange, phevElectricRangeMi: 70 }, '2026/27')).toBe(7);
  });

  it('steps by one point every 5 g/km above 55', () => {
    const car = specOf('vw-golf-15tsi');
    expect(bikPercentFor({ ...car, co2gPerKm: 55 }, '2025/26')).toBe(17);
    expect(bikPercentFor({ ...car, co2gPerKm: 59 }, '2025/26')).toBe(17);
    expect(bikPercentFor({ ...car, co2gPerKm: 60 }, '2025/26')).toBe(18);
    expect(bikPercentFor({ ...car, co2gPerKm: 137 }, '2025/26')).toBe(33);
  });

  it('caps at the yearly maximum', () => {
    const car = specOf('vw-golf-15tsi');
    expect(bikPercentFor({ ...car, co2gPerKm: 300 }, '2025/26')).toBe(37);
    expect(bikPercentFor({ ...car, co2gPerKm: 300 }, '2029/30')).toBe(39);
  });

  it('adds the surcharge for a pre-RDE2 diesel only', () => {
    const modern = specOf('bmw-320d');
    const old = specOf('nissan-qashqai-15dci');
    expect(bikPercentFor(modern, '2025/26')).toBe(31);
    expect(bikPercentFor({ ...old, co2gPerKm: 128 }, '2025/26')).toBe(35);
  });
});

describe('benefit in kind tax', () => {
  it('taxes the benefit at the driver’s marginal rate', () => {
    const spec = specOf('tesla-model-y-premium-awd');
    const result = bikTaxFor(spec, 52000, 0, '2026/27', 60000, 'uk');
    expect(result.bikPercent).toBe(4);
    expect(result.bikValueGBP).toBeCloseTo(2080, 2);
    expect(result.bikTaxGBP).toBeCloseTo(832, 2); // 40% of £2,080
  });

  it('caps the capital contribution at £5,000', () => {
    const spec = specOf('tesla-model-y-premium-awd');
    const a = bikTaxFor(spec, 52000, 5000, '2026/27', 60000, 'uk');
    const b = bikTaxFor(spec, 52000, 20000, '2026/27', 60000, 'uk');
    expect(a.bikValueGBP).toBeCloseTo(b.bikValueGBP, 6);
  });
});

describe('Advisory Electric Rate', () => {
  it('pays the home rate when all charging is done at home', () => {
    expect(advisoryElectricPaymentFor(10000, 100)).toBeCloseTo(700, 2);
  });

  it('pays the public rate when none of it is', () => {
    expect(advisoryElectricPaymentFor(10000, 0)).toBeCloseTo(1500, 2);
  });

  it('blends the two rates by the charging split', () => {
    // 80% home at 7p and 20% public at 15p is a blended 8.6p.
    expect(advisoryElectricPaymentFor(10000, 80)).toBeCloseTo(860, 2);
  });
});

describe('AMAP', () => {
  it('pays 45p for the first 10,000 miles', () => {
    expect(amapPaymentFor(8000)).toBeCloseTo(3600, 2);
  });

  it('drops to 25p beyond 10,000 miles', () => {
    expect(amapPaymentFor(15000)).toBeCloseTo(4500 + 1250, 2);
  });
});

describe('VED', () => {
  it('adds the Expensive Car Supplement to a car over the threshold', () => {
    const spec = specOf('tesla-model-y-premium-awd'); // £51,990 list
    const result = vedFor({ ...spec, firstRegisteredYear: 2026 }, 2026, 3);
    expect(result.supplementApplies).toBe(true);
    // Years 0, 1 and 2 of ownership: the supplement bites in two of them.
    expect(result.supplementGBP).toBeCloseTo((2 / 3) * 440, 2);
  });

  it('leaves a cheaper car on the standard rate', () => {
    const spec = specOf('vw-golf-15tsi');
    const result = vedFor({ ...spec, firstRegisteredYear: 2026 }, 2026, 3);
    expect(result.supplementApplies).toBe(false);
    expect(result.annualGBP).toBe(200);
  });

  it('gives a zero-emission car the higher £50,000 threshold', () => {
    // An EV listed between the two thresholds escapes the supplement; an
    // otherwise identical petrol car does not.
    const ev = { ...specOf('tesla-model-y-premium-awd'), listPriceGBP: 45000, firstRegisteredYear: 2026 };
    const petrol = { ...specOf('vw-golf-15tsi'), listPriceGBP: 45000, firstRegisteredYear: 2026 };

    expect(vedFor(ev, 2026, 3).supplementApplies).toBe(false);
    expect(vedFor(petrol, 2026, 3).supplementApplies).toBe(true);
  });

  it('still charges the supplement on an electric car over £50,000', () => {
    const ev = { ...specOf('tesla-model-y-premium-awd'), listPriceGBP: 55000, firstRegisteredYear: 2026 };
    expect(vedFor(ev, 2026, 3).supplementApplies).toBe(true);
  });

  it('uses the legacy CO2 bands for a pre-2017 car', () => {
    const spec = specOf('ford-focus-16-mk2'); // 159 g/km, registered 2010 -> band G
    const result = vedFor(spec, 2026, 3);
    expect(result.annualGBP).toBe(275);
    expect(result.explanation).toContain('band G');
  });

  it('picks the right legacy band at each boundary', () => {
    const spec = specOf('ford-focus-16-mk2');
    const at = (co2: number) => vedFor({ ...spec, co2gPerKm: co2 }, 2026, 3).annualGBP;
    expect(at(100)).toBe(20);
    expect(at(120)).toBe(35);
    expect(at(121)).toBe(170);
    expect(at(150)).toBe(225);
    expect(at(151)).toBe(275);
    expect(at(256)).toBe(790);
  });

  it('drops the supplement once the car is more than six years old', () => {
    const spec = specOf('tesla-model-y-lr-awd');
    const result = vedFor({ ...spec, firstRegisteredYear: 2018 }, 2026, 3);
    expect(result.supplementApplies).toBe(false);
  });
});
