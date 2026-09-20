/**
 * UK tax and duty constants.
 *
 * These are defaults, not facts carved in stone: rates change every April, and
 * several forward-year figures are the published schedule rather than
 * something already in force. Checked against published rates for 2026/27 —
 * verify anything you are making a five-figure decision on.
 */

export const TAX_YEARS = ['2025/26', '2026/27', '2027/28', '2028/29', '2029/30'] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

export const DEFAULT_TAX_YEAR: TaxYear = '2026/27';

// --- Company car tax (Benefit in Kind) -------------------------------------

/** Zero-emission appropriate percentage by tax year. */
export const ZERO_EMISSION_BIK_PCT: Record<TaxYear, number> = {
  '2025/26': 3,
  '2026/27': 4,
  '2027/28': 5,
  '2028/29': 7,
  '2029/30': 9,
};

/**
 * Cars at 1–50 g/km are banded by electric range, not CO2 alone — which is
 * what makes a long-range plug-in hybrid so much cheaper than a short-range
 * one. Keyed by the minimum electric range for the band.
 */
export const PHEV_BIK_BANDS: { minElectricRangeMi: number; pct: Record<TaxYear, number> }[] = [
  { minElectricRangeMi: 130, pct: { '2025/26': 3, '2026/27': 4, '2027/28': 5, '2028/29': 18, '2029/30': 19 } },
  { minElectricRangeMi: 70, pct: { '2025/26': 6, '2026/27': 7, '2027/28': 8, '2028/29': 19, '2029/30': 20 } },
  { minElectricRangeMi: 40, pct: { '2025/26': 9, '2026/27': 10, '2027/28': 11, '2028/29': 20, '2029/30': 21 } },
  { minElectricRangeMi: 30, pct: { '2025/26': 13, '2026/27': 14, '2027/28': 15, '2028/29': 21, '2029/30': 22 } },
  { minElectricRangeMi: 0, pct: { '2025/26': 15, '2026/27': 16, '2027/28': 17, '2028/29': 23, '2029/30': 24 } },
];

/** 51–54 g/km is a single band before the 5 g/km steps begin at 55. */
export const BAND_51_54: Record<TaxYear, number> = {
  '2025/26': 16, '2026/27': 17, '2027/28': 18, '2028/29': 24, '2029/30': 25,
};

/** Percentage at exactly 55 g/km; each further 5 g/km adds one point. */
export const BASE_AT_55: Record<TaxYear, number> = {
  '2025/26': 17, '2026/27': 18, '2027/28': 19, '2028/29': 20, '2029/30': 21,
};

export const BIK_MAX_PCT: Record<TaxYear, number> = {
  '2025/26': 37, '2026/27': 37, '2027/28': 37, '2028/29': 38, '2029/30': 39,
};

/** Diesels that do not meet the RDE2 standard carry a surcharge. */
export const DIESEL_SURCHARGE_PCT = 4;

/** Car fuel benefit multiplier, when an employer pays for private fuel. */
export const CAR_FUEL_BENEFIT_MULTIPLIER = 27800;

// --- Income tax and National Insurance -------------------------------------

export const PERSONAL_ALLOWANCE = 12570;
/** The allowance is withdrawn by £1 for every £2 of income above this. */
export const PA_TAPER_THRESHOLD = 100000;

/** Bands apply to taxable income, i.e. after the personal allowance. */
export const TAX_BANDS: { upTo: number; ratePct: number }[] = [
  { upTo: 37700, ratePct: 20 },
  { upTo: 125140 - PERSONAL_ALLOWANCE, ratePct: 40 },
  { upTo: Infinity, ratePct: 45 },
];

export const NI_PRIMARY_THRESHOLD = 12570;
export const NI_UPPER_EARNINGS_LIMIT = 50270;
export const NI_MAIN_RATE_PCT = 8;
export const NI_UPPER_RATE_PCT = 2;

// --- Vehicle Excise Duty ---------------------------------------------------

export const VED = {
  standardGBP: 200,
  expensiveCarSupplementGBP: 440,
  /** Petrol, diesel and hybrid threshold. */
  expensiveCarThresholdGBP: 40000,
  /** Zero-emission cars have had their own, higher threshold since April 2026. */
  expensiveCarThresholdZeroEmissionGBP: 50000,
  /** Licences 2 to 6, i.e. ages 1 to 5 inclusive. */
  expensiveCarSupplementYears: 5,
};

/** Bands for cars first registered between March 2001 and March 2017. */
export const LEGACY_VED_BANDS: { upToCo2: number; annualGBP: number; band: string }[] = [
  { upToCo2: 100, annualGBP: 20, band: 'A' },
  { upToCo2: 110, annualGBP: 20, band: 'B' },
  { upToCo2: 120, annualGBP: 35, band: 'C' },
  { upToCo2: 130, annualGBP: 170, band: 'D' },
  { upToCo2: 140, annualGBP: 200, band: 'E' },
  { upToCo2: 150, annualGBP: 225, band: 'F' },
  { upToCo2: 165, annualGBP: 275, band: 'G' },
  { upToCo2: 175, annualGBP: 325, band: 'H' },
  { upToCo2: 185, annualGBP: 360, band: 'I' },
  { upToCo2: 200, annualGBP: 410, band: 'J' },
  { upToCo2: 225, annualGBP: 445, band: 'K' },
  { upToCo2: 255, annualGBP: 760, band: 'L' },
  { upToCo2: Infinity, annualGBP: 790, band: 'M' },
];
