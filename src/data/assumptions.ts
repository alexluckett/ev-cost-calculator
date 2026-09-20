/**
 * Physical and market constants, with their provenance.
 *
 * These are the numbers that quietly decide the answer, so they are all in one
 * place and all editable in the app rather than buried in the calculation.
 */

import type { Assumptions, EnergyPrices } from '../model/types';

/** An imperial gallon in litres — the UK buys fuel in litres and quotes mpg. */
export const LITRES_PER_IMPERIAL_GALLON = 4.54609;

export const KM_PER_MILE = 1.609344;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  acChargingEfficiencyPct: 90,
  dcChargingEfficiencyPct: 95,
  energyInflationPct: 0,
  gridCarbonIntensityGPerKWh: 124,
  petrolKgCO2PerLitre: 2.31,
  dieselKgCO2PerLitre: 2.68,
  evRoadChargePencePerMile: 3,
  phevRoadChargePencePerMile: 1.5,
  applyEvRoadCharge: false,
};

export const ASSUMPTION_NOTES: Record<keyof Assumptions, string> = {
  acChargingEfficiencyPct:
    'Share of AC grid energy that reaches the battery. Typically 85–92% on a 7 kW home charger — losses go to the on-board charger, cabling and battery conditioning. Set this to 100 if your efficiency figure is already measured from the wall.',
  dcChargingEfficiencyPct:
    'Rapid DC bypasses the on-board charger, so losses are lower — usually 93–96%.',
  energyInflationPct:
    'Real annual increase applied to electricity and fuel prices across the comparison term. Leave at 0 to compare at today’s prices.',
  gridCarbonIntensityGPerKWh:
    'Average carbon intensity of UK grid electricity. Charging overnight on a wind-heavy night can be far below this; a still winter evening far above.',
  petrolKgCO2PerLitre: 'Tailpipe CO2 from burning a litre of petrol.',
  dieselKgCO2PerLitre: 'Tailpipe CO2 from burning a litre of diesel.',
  evRoadChargePencePerMile:
    'Announced per-mile charge for electric cars from April 2028. Off by default.',
  phevRoadChargePencePerMile:
    'Announced per-mile charge for plug-in hybrids from April 2028. Off by default.',
  applyEvRoadCharge:
    'Include the announced per-mile road charge for electric and plug-in hybrid cars.',
};

export const DEFAULT_PRICES: EnergyPrices = {
  homeOffPeakPPerKWh: 7,
  homePeakPPerKWh: 26,
  workplacePPerKWh: 0,
  publicRapidPPerKWh: 45,
  publicSlowPPerKWh: 55,
  petrolPPerLitre: 135,
  dieselPPerLitre: 142,
};

export interface TariffPreset {
  id: string;
  name: string;
  description: string;
  offPeakPPerKWh: number;
  peakPPerKWh: number;
  offPeakWindow: string;
}

/**
 * Indicative UK domestic tariffs. Unit rates vary by region, meter type and
 * standing charge, so treat these as starting points and put your own rate in.
 */
export const TARIFF_PRESETS: TariffPreset[] = [
  {
    id: 'ev-overnight-cheap',
    name: 'EV tariff — deep overnight rate',
    description: 'A dedicated EV tariff with a very low overnight unit rate and a higher day rate.',
    offPeakPPerKWh: 7,
    peakPPerKWh: 26,
    offPeakWindow: '23:30–05:30',
  },
  {
    id: 'ev-smart-extended',
    name: 'EV tariff — smart / extended window',
    description: 'Smart-charging tariff where the cheap rate is available for a longer window and often on demand.',
    offPeakPPerKWh: 7,
    peakPPerKWh: 25,
    offPeakWindow: '23:30–05:30 plus smart top-ups',
  },
  {
    id: 'economy-7',
    name: 'Economy 7',
    description: 'Traditional two-rate meter. Cheaper than standard overnight, dearer than an EV tariff.',
    offPeakPPerKWh: 15,
    peakPPerKWh: 30,
    offPeakWindow: '7 night hours, varies by region',
  },
  {
    id: 'standard-variable',
    name: 'Standard variable — single rate',
    description: 'One rate around the clock. No benefit from charging overnight.',
    offPeakPPerKWh: 25,
    peakPPerKWh: 25,
    offPeakWindow: 'n/a',
  },
  {
    id: 'off-peak-heat',
    name: 'Time-of-use heat pump / cosy tariff',
    description: 'Several cheap windows spread across the day, with a higher evening peak rate.',
    offPeakPPerKWh: 12,
    peakPPerKWh: 30,
    offPeakWindow: '04:00–07:00, 13:00–16:00, 22:00–24:00',
  },
];

export interface PublicNetworkPreset {
  id: string;
  name: string;
  rapidPPerKWh: number;
  slowPPerKWh: number;
  note: string;
}

export const PUBLIC_NETWORK_PRESETS: PublicNetworkPreset[] = [
  { id: 'supercharger', name: 'Tesla Supercharger', rapidPPerKWh: 45, slowPPerKWh: 45, note: 'Varies by site and time of day; cheaper with a membership.' },
  { id: 'supercharger-member', name: 'Tesla Supercharger (membership)', rapidPPerKWh: 36, slowPPerKWh: 36, note: 'Monthly membership brings the per-kWh rate down.' },
  { id: 'premium-rapid', name: 'Premium ultra-rapid network', rapidPPerKWh: 79, slowPPerKWh: 69, note: 'The most expensive way to buy miles in the UK.' },
  { id: 'mid-rapid', name: 'Typical rapid network', rapidPPerKWh: 69, slowPPerKWh: 59, note: 'Representative of most motorway and forecourt rapids.' },
  { id: 'budget-rapid', name: 'Budget / supermarket rapid', rapidPPerKWh: 44, slowPPerKWh: 39, note: 'Supermarket and off-peak network pricing.' },
  { id: 'destination', name: 'Destination AC (hotel, car park)', rapidPPerKWh: 50, slowPPerKWh: 44, note: 'Slow AC charging while parked.' },
];
