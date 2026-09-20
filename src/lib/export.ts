/**
 * Export helpers. Everything happens in the browser: a Blob and an object URL,
 * no upload and nothing to trust a server with.
 */

import type { AppState, ScenarioResult } from '../model/types';

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJson(state: AppState) {
  download(`ev-cost-comparison-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json');
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv(state: AppState, results: ScenarioResult[]) {
  const rows: (string | number)[][] = [];

  rows.push(['EV Cost Calculator export', stamp()]);
  rows.push([]);
  rows.push(['Annual mileage', state.usage.annualMiles]);
  rows.push(['Business mileage share (%)', state.usage.businessMilesPct]);
  rows.push(['Comparison term (years)', state.usage.termYears]);
  rows.push(['Home off-peak (p/kWh)', state.prices.homeOffPeakPPerKWh]);
  rows.push(['Home peak (p/kWh)', state.prices.homePeakPPerKWh]);
  rows.push(['Public rapid (p/kWh)', state.prices.publicRapidPPerKWh]);
  rows.push(['Petrol (p/litre)', state.prices.petrolPPerLitre]);
  rows.push(['Diesel (p/litre)', state.prices.dieselPPerLitre]);
  rows.push([]);

  const header = ['Line', ...results.map((r) => r.label)];
  rows.push(header);

  const keys = new Map<string, string>();
  for (const r of results) for (const l of r.lines) if (!keys.has(l.key)) keys.set(l.key, l.label);

  for (const [key, label] of keys) {
    rows.push([label, ...results.map((r) => round2(r.lines.find((l) => l.key === key)?.annualGBP ?? 0))]);
  }

  rows.push([]);
  rows.push(['Total per year (£)', ...results.map((r) => round2(r.annualTotalGBP))]);
  rows.push(['Total per month (£)', ...results.map((r) => round2(r.monthlyTotalGBP))]);
  rows.push([`Total over ${state.usage.termYears} years (£)`, ...results.map((r) => round2(r.termTotalGBP))]);
  rows.push(['Energy pence per mile', ...results.map((r) => round2(r.energy.pencePerMile))]);
  rows.push(['All-in pence per mile', ...results.map((r) => round2(r.costPerMilePence))]);
  rows.push(['Grid kWh per year', ...results.map((r) => round2(r.energy.annualGridKWh))]);
  rows.push(['Litres per year', ...results.map((r) => round2(r.energy.annualLitres))]);
  rows.push(['CO2 kg per year', ...results.map((r) => round2(r.annualCO2Kg))]);

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  download(`ev-cost-comparison-${stamp()}.csv`, csv, 'text/csv;charset=utf-8');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function copyShareLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function importJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('That file is not valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsText(file);
  });
}
