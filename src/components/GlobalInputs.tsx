import { TAX_YEARS } from '../data/tax';
import { percent } from '../lib/format';
import { marginalRatePct } from '../model/tax';
import type { AppState } from '../model/types';
import { Field, NumberInput, Select } from './ui';

/** Indicative UK tariffs, as a starting point rather than an assumption. */
const TARIFF_PRESETS = [
  { name: 'EV overnight tariff', home: 7, note: 'A dedicated EV tariff with a cheap overnight rate.' },
  { name: 'Economy 7', home: 15, note: 'Traditional two-rate meter.' },
  { name: 'Standard variable', home: 25, note: 'One rate around the clock.' },
];

const RAPID_PRESETS = [
  { name: 'Supercharger', rapid: 45 },
  { name: 'Typical rapid network', rapid: 69 },
  { name: 'Premium ultra-rapid', rapid: 79 },
];

export function GlobalInputs({
  state,
  onPatch,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
}) {
  const anyCompanyCar = state.scenarios.some((s) => s.ownership.model !== 'personal');
  const setPrice = (patch: Partial<AppState['prices']>) =>
    onPatch({ prices: { ...state.prices, ...patch } });

  return (
    <>
      <div className="panel-grid">
        <Field label="Annual mileage" hint="The biggest single driver of running cost. Your MOT history has your real figure.">
          <NumberInput value={state.annualMiles} min={0} max={200000} step={500} suffix="miles" onChange={(annualMiles) => onPatch({ annualMiles })} />
        </Field>
        <Field label="Compare over" hint="Costs that only apply in early years, such as the Expensive Car Supplement, are averaged across this.">
          <NumberInput value={state.termYears} min={1} max={15} suffix="years" onChange={(termYears) => onPatch({ termYears })} />
        </Field>
        <Field label="Home electricity" hint="Your cheap overnight rate if you are on an EV tariff. This is where an electric car makes its money.">
          <NumberInput value={state.prices.homePPerKWh} min={0} max={100} step={0.5} suffix="p/kWh" onChange={(v) => setPrice({ homePPerKWh: v })} />
        </Field>
        <Field label="Public rapid" hint="Superchargers and motorway rapids — typically 40p to 85p depending on network and membership.">
          <NumberInput value={state.prices.publicRapidPPerKWh} min={0} max={150} step={1} suffix="p/kWh" onChange={(v) => setPrice({ publicRapidPPerKWh: v })} />
        </Field>
        <Field label="Petrol">
          <NumberInput value={state.prices.petrolPPerLitre} min={0} max={300} step={1} suffix="p/litre" onChange={(v) => setPrice({ petrolPPerLitre: v })} />
        </Field>
        <Field label="Diesel">
          <NumberInput value={state.prices.dieselPPerLitre} min={0} max={300} step={1} suffix="p/litre" onChange={(v) => setPrice({ dieselPPerLitre: v })} />
        </Field>

        {anyCompanyCar ? (
          <>
            <Field label="Gross salary" hint="Used to work out your exact marginal rate, including the 60% band between £100,000 and £125,140 where salary sacrifice is worth the most.">
              <NumberInput value={state.grossSalaryGBP} min={0} step={1000} prefix="£" onChange={(grossSalaryGBP) => onPatch({ grossSalaryGBP })} />
            </Field>
            <Field label="Tax year" hint="Company car tax on an electric car rises every year: 3% in 2025/26 to 9% by 2029/30.">
              <Select
                value={state.taxYear}
                onChange={(taxYear) => onPatch({ taxYear })}
                options={TAX_YEARS.map((y) => ({ value: y, label: y }))}
              />
            </Field>
            <div className="marginal-callout">
              <span className="mc-label">Your marginal rate</span>
              <span className="mc-value">{percent(marginalRatePct(state.grossSalaryGBP), 0)}</span>
            </div>
          </>
        ) : null}
      </div>

      <div className="preset-row">
        <span className="preset-row-label">Home rate</span>
        <div className="preset-chips">
          {TARIFF_PRESETS.map((t) => (
            <button key={t.name} type="button" className="chip" title={t.note} onClick={() => setPrice({ homePPerKWh: t.home })}>
              {t.name} · {t.home}p
            </button>
          ))}
        </div>
      </div>
      <div className="preset-row">
        <span className="preset-row-label">Rapid rate</span>
        <div className="preset-chips">
          {RAPID_PRESETS.map((t) => (
            <button key={t.name} type="button" className="chip" onClick={() => setPrice({ publicRapidPPerKWh: t.rapid })}>
              {t.name} · {t.rapid}p
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
