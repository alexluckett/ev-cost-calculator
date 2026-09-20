/**
 * UK tax and duty constants.
 *
 * Every figure here is a *default*, not a fact carved in stone: rates change
 * each April, and several of the forward-year figures are the published
 * schedule rather than something already in force. Each entry carries an
 * `asOf` label and a note, and all of them are surfaced (and overridable) in
 * the app's Assumptions panel. Check anything you are relying on against
 * gov.uk before making a five-figure decision on it.
 */

export interface SourcedValue<T> {
  value: T;
  asOf: string;
  note: string;
}

export const TAX_YEARS = ['2025/26', '2026/27', '2027/28', '2028/29', '2029/30'] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

export const DEFAULT_TAX_YEAR: TaxYear = '2026/27';

// ---------------------------------------------------------------------------
// Benefit in Kind — company car appropriate percentages
// ---------------------------------------------------------------------------

/** Zero-emission (battery electric) appropriate percentage by tax year. */
export const ZERO_EMISSION_BIK_PCT: Record<TaxYear, number> = {
  '2025/26': 3,
  '2026/27': 4,
  '2027/28': 5,
  '2028/29': 7,
  '2029/30': 9,
};

/**
 * 1–50 g/km bands are set by electric-only range, not by CO2 alone — this is
 * what makes a long-range PHEV so much cheaper as a company car than a short
 * range one. Keyed by the minimum electric range for the band.
 */
interface PhevBand {
  minElectricRangeMi: number;
  pct: Record<TaxYear, number>;
}

export const PHEV_BIK_BANDS: PhevBand[] = [
  { minElectricRangeMi: 130, pct: { '2025/26': 3, '2026/27': 4, '2027/28': 5, '2028/29': 18, '2029/30': 19 } },
  { minElectricRangeMi: 70, pct: { '2025/26': 6, '2026/27': 7, '2027/28': 8, '2028/29': 19, '2029/30': 20 } },
  { minElectricRangeMi: 40, pct: { '2025/26': 9, '2026/27': 10, '2027/28': 11, '2028/29': 20, '2029/30': 21 } },
  { minElectricRangeMi: 30, pct: { '2025/26': 13, '2026/27': 14, '2027/28': 15, '2028/29': 21, '2029/30': 22 } },
  { minElectricRangeMi: 0, pct: { '2025/26': 15, '2026/27': 16, '2027/28': 17, '2028/29': 23, '2029/30': 24 } },
];

/** 51–54 g/km is a single band before the 5 g/km steps begin at 55. */
export const BAND_51_54: Record<TaxYear, number> = {
  '2025/26': 16,
  '2026/27': 17,
  '2027/28': 18,
  '2028/29': 24,
  '2029/30': 25,
};

/** Percentage at exactly 55 g/km; each further 5 g/km adds one point. */
export const BASE_AT_55: Record<TaxYear, number> = {
  '2025/26': 17,
  '2026/27': 18,
  '2027/28': 19,
  '2028/29': 20,
  '2029/30': 21,
};

/** Ceiling on the appropriate percentage, including the diesel surcharge. */
export const BIK_MAX_PCT: Record<TaxYear, number> = {
  '2025/26': 37,
  '2026/27': 37,
  '2027/28': 37,
  '2028/29': 38,
  '2029/30': 39,
};

/** Diesel cars that do not meet the RDE2 standard carry a surcharge. */
export const DIESEL_SURCHARGE_PCT = 4;

export const BIK_SOURCE: SourcedValue<string> = {
  value: 'HMRC appropriate percentages',
  asOf: '2025/26 to 2029/30 published schedule',
  note: 'Zero-emission rates rise 3/4/5/7/9% across 2025/26–2029/30. Rates above 75 g/km rise 1pp a year from 2027/28 with the cap rising to 38% then 39%.',
};

// ---------------------------------------------------------------------------
// Income tax and National Insurance
// ---------------------------------------------------------------------------

export interface TaxBand {
  /** Upper bound of taxable income for this band; Infinity for the top band. */
  upTo: number;
  ratePct: number;
  label: string;
}

export const PERSONAL_ALLOWANCE = 12570;
/** Personal allowance is withdrawn by £1 for every £2 of income above this. */
export const PA_TAPER_THRESHOLD = 100000;

/** Bands apply to taxable income, i.e. after the personal allowance. */
export const RUK_BANDS: TaxBand[] = [
  { upTo: 37700, ratePct: 20, label: 'Basic rate' },
  { upTo: 125140 - PERSONAL_ALLOWANCE, ratePct: 40, label: 'Higher rate' },
  { upTo: Infinity, ratePct: 45, label: 'Additional rate' },
];

export const SCOTLAND_BANDS: TaxBand[] = [
  { upTo: 2827, ratePct: 19, label: 'Starter rate' },
  { upTo: 14921, ratePct: 20, label: 'Scottish basic rate' },
  { upTo: 31092, ratePct: 21, label: 'Intermediate rate' },
  { upTo: 62430, ratePct: 42, label: 'Higher rate' },
  { upTo: 125140 - PERSONAL_ALLOWANCE, ratePct: 45, label: 'Advanced rate' },
  { upTo: Infinity, ratePct: 48, label: 'Top rate' },
];

/** Employee Class 1 National Insurance. */
export const NI_PRIMARY_THRESHOLD = 12570;
export const NI_UPPER_EARNINGS_LIMIT = 50270;
export const NI_MAIN_RATE_PCT = 8;
export const NI_UPPER_RATE_PCT = 2;

/** Employer Class 1A on benefits in kind. */
export const CLASS_1A_RATE_PCT = 15;

export const INCOME_TAX_SOURCE: SourcedValue<string> = {
  value: 'Income tax and NI thresholds',
  asOf: '2025/26, frozen to 2027/28',
  note: 'Personal allowance £12,570 with the £100k taper. Employee NI 8% then 2%. Employer Class 1A 15%. Scottish rates apply to non-savings income for Scottish taxpayers.',
};

// ---------------------------------------------------------------------------
// Vehicle Excise Duty
// ---------------------------------------------------------------------------

export interface VedRates {
  /** Standard rate from the second licence onwards. */
  standardGBP: number;
  /** Additional rate for cars with a list price above the threshold. */
  expensiveCarSupplementGBP: number;
  /** Threshold for petrol, diesel and hybrid cars. */
  expensiveCarThresholdGBP: number;
  /**
   * Zero-emission cars have had their own, higher threshold since April 2026.
   * Before that they shared the £40,000 threshold.
   */
  expensiveCarThresholdZeroEmissionGBP: number;
  /** Years of ownership the supplement applies to (licences 2–6). */
  expensiveCarSupplementYears: number;
  /** First-year rate for a zero-emission car. */
  firstYearZeroEmissionGBP: number;
}

export const VED: VedRates = {
  standardGBP: 200,
  expensiveCarSupplementGBP: 440,
  expensiveCarThresholdGBP: 40000,
  expensiveCarThresholdZeroEmissionGBP: 50000,
  expensiveCarSupplementYears: 5,
  firstYearZeroEmissionGBP: 10,
};

export const VED_SOURCE: SourcedValue<string> = {
  value: 'VED standard and additional rates',
  asOf: '2026/27 — rates are uprated each April',
  note: 'Electric cars have paid VED since April 2025. From April 2026 the Expensive Car Supplement threshold for zero-emission cars rose to £50,000, while petrol, diesel and hybrids stay at £40,000. The supplement runs for five years from the second licence.',
};

// ---------------------------------------------------------------------------
// Mileage reimbursement
// ---------------------------------------------------------------------------

/** Approved Mileage Allowance Payments, for a personally-owned car. */
export const AMAP_FIRST_10K_PENCE = 45;
export const AMAP_ABOVE_10K_PENCE = 25;
export const AMAP_THRESHOLD_MILES = 10000;

/**
 * Advisory Electric Rate for reimbursing business miles in a company EV.
 * HMRC splits this by where the car was charged, which is why the calculator
 * blends the two using your charging mix rather than quoting a single rate.
 */
export const ADVISORY_ELECTRIC_RATE_HOME_PENCE = 7;
export const ADVISORY_ELECTRIC_RATE_PUBLIC_PENCE = 15;

/**
 * Indicative Advisory Fuel Rate for a combustion company car. The real rates
 * are published quarterly and vary by engine size and fuel, from roughly 11p
 * to 25p a mile; this is a mid-range stand-in.
 */
export const ADVISORY_FUEL_RATE_PENCE = 14;

/** Car fuel benefit multiplier, used when an employer pays for private fuel. */
export const CAR_FUEL_BENEFIT_MULTIPLIER = 27800;

export const MILEAGE_SOURCE: SourcedValue<string> = {
  value: 'AMAP, AER and the car fuel benefit multiplier',
  asOf: '2026/27',
  note: 'AMAP has been 45p/25p since 2011. The Advisory Electric Rate is reviewed quarterly and is now split by where the car was charged: 7p a mile for home charging and 15p for public charging.',
};

// ---------------------------------------------------------------------------
// Announced but not yet in force
// ---------------------------------------------------------------------------

export const EV_ROAD_CHARGE = {
  evPencePerMile: 3,
  phevPencePerMile: 1.5,
  fromTaxYear: '2028/29',
  note: 'A per-mile charge on electric and plug-in hybrid cars has been announced to start in April 2028. It is off by default; turn it on to see its effect on a long-term comparison.',
};

export const CORPORATION_TAX_MAIN_RATE_PCT = 25;
