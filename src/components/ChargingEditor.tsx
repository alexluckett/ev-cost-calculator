import { CHARGING_SOURCE_IDS, CHARGING_SOURCE_LABELS } from '../model/types';
import type { ChargingInputs, ChargingSourceId, EnergyPrices, EnergyResult } from '../model/types';
import { money, number, pence, percent } from '../lib/format';
import { MixBar } from './charts';
import { Field, InfoDot, NumberInput, Select } from './ui';

const SOURCE_COLOURS: Record<ChargingSourceId, string> = {
  homeOffPeak: '#0f9d76',
  homePeak: '#f0a202',
  workplace: '#2f6fed',
  publicRapid: '#e2683a',
  publicSlow: '#8a5cf6',
};

/**
 * Editing one share and leaving the rest alone would let the mix drift away
 * from 100%, so the others absorb the change in proportion — the slider always
 * describes a complete week of charging.
 */
function rebalance(
  mix: Record<ChargingSourceId, number>,
  changed: ChargingSourceId,
  value: number,
): Record<ChargingSourceId, number> {
  const next = Math.min(100, Math.max(0, value));
  const others = CHARGING_SOURCE_IDS.filter((id) => id !== changed);
  const otherTotal = others.reduce((sum, id) => sum + mix[id], 0);
  const remaining = 100 - next;

  const out = { ...mix, [changed]: next };
  if (otherTotal <= 0) {
    // Nothing to scale, so put the remainder somewhere sensible.
    for (const id of others) out[id] = 0;
    if (changed !== 'homeOffPeak') out.homeOffPeak = remaining;
    return out;
  }
  for (const id of others) out[id] = (mix[id] / otherTotal) * remaining;
  return out;
}

export function ChargingEditor({
  charging,
  energy,
  prices,
  onChange,
}: {
  charging: ChargingInputs;
  energy: EnergyResult;
  prices: EnergyPrices;
  onChange: (next: ChargingInputs) => void;
}) {
  const sessionsMode = charging.rapidEntryMode === 'sessions';
  const effective = energy.rows;

  return (
    <div className="charging-editor">
      <Field
        label="How do you describe your rapid charging?"
        hint="Most people know how often they rapid charge, not what share of their energy it is. Pick whichever you can answer honestly."
      >
        <Select
          value={charging.rapidEntryMode}
          onChange={(rapidEntryMode) => onChange({ ...charging, rapidEntryMode })}
          options={[
            { value: 'percent', label: 'As a percentage of charging' },
            { value: 'sessions', label: 'As sessions per month' },
          ]}
        />
      </Field>

      {sessionsMode ? (
        <div className="grid-2">
          <Field label="Rapid sessions per month">
            <NumberInput
              value={charging.rapidSessionsPerMonth}
              min={0}
              max={60}
              step={0.5}
              suffix="/month"
              onChange={(rapidSessionsPerMonth) => onChange({ ...charging, rapidSessionsPerMonth })}
            />
          </Field>
          <Field label="Energy added per session" hint="A rapid stop from about 20% to 80% on a big battery is roughly 45–50 kWh.">
            <NumberInput
              value={charging.rapidSessionKWh}
              min={1}
              max={150}
              step={1}
              suffix="kWh"
              onChange={(rapidSessionKWh) => onChange({ ...charging, rapidSessionKWh })}
            />
          </Field>
        </div>
      ) : null}

      <div className="mix-list">
        {CHARGING_SOURCE_IDS.map((id) => {
          const row = effective.find((r) => r.source === id);
          const locked = sessionsMode && id === 'publicRapid';
          return (
            <div key={id} className="mix-row">
              <div className="mix-row-head">
                <span className="mix-swatch" style={{ background: SOURCE_COLOURS[id] }} aria-hidden="true" />
                <span className="mix-name">{CHARGING_SOURCE_LABELS[id]}</span>
                <span className="mix-rate">{pence(rateOf(id, prices), 1)}/kWh</span>
              </div>
              <div className="mix-row-controls">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(charging.mix[id])}
                  disabled={locked}
                  aria-label={`${CHARGING_SOURCE_LABELS[id]} share`}
                  onChange={(e) => onChange({ ...charging, mix: rebalance(charging.mix, id, Number(e.target.value)) })}
                />
                <NumberInput
                  value={Math.round(charging.mix[id] * 10) / 10}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  disabled={locked}
                  ariaLabel={`${CHARGING_SOURCE_LABELS[id]} percentage`}
                  onChange={(v) => onChange({ ...charging, mix: rebalance(charging.mix, id, v) })}
                />
              </div>
              {row && row.gridKWh > 0 ? (
                <p className="mix-detail">
                  {number(row.gridKWh)} kWh a year from the meter · {money(row.costGBP)}
                  {sessionsMode ? ` · ${percent(row.sharePct, 0)} of charging once your rapid sessions are counted` : ''}
                  {locked ? ' · set by your sessions per month' : ''}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <MixBar
        segments={CHARGING_SOURCE_IDS.map((id) => ({
          id,
          pct: effective.find((r) => r.source === id)?.sharePct ?? 0,
          colour: SOURCE_COLOURS[id],
          label: CHARGING_SOURCE_LABELS[id],
        }))}
      />

      <div className="grid-2">
        <Field
          label="Real-world efficiency penalty"
          hint="Adds to the car's consumption. Winter, motorway speeds, a roof box or a towbar all push this up — 15–25% is typical for a cold British winter."
        >
          <NumberInput
            value={charging.realWorldPenaltyPct}
            min={-20}
            max={60}
            step={1}
            suffix="%"
            onChange={(realWorldPenaltyPct) => onChange({ ...charging, realWorldPenaltyPct })}
          />
        </Field>
        <div className="mini-stat">
          <span className="mini-stat-label">
            Blended cost of a kWh <InfoDot text="Weighted across every source, and measured at the meter, so it includes charging losses." />
          </span>
          <span className="mini-stat-value">{pence(energy.blendedPPerKWh, 1)}/kWh</span>
          <span className="mini-stat-sub">
            {number(energy.annualGridKWh)} kWh bought · {number(energy.annualBatteryKWh)} kWh into the battery (
            {percent(energy.annualGridKWh > 0 ? (1 - energy.annualBatteryKWh / energy.annualGridKWh) * 100 : 0, 1)} lost)
          </span>
        </div>
      </div>
    </div>
  );
}

function rateOf(id: ChargingSourceId, prices: EnergyPrices): number {
  switch (id) {
    case 'homeOffPeak':
      return prices.homeOffPeakPPerKWh;
    case 'homePeak':
      return prices.homePeakPPerKWh;
    case 'workplace':
      return prices.workplacePPerKWh;
    case 'publicRapid':
      return prices.publicRapidPPerKWh;
    case 'publicSlow':
      return prices.publicSlowPPerKWh;
  }
}
