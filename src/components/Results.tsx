import { useMemo } from 'react';
import { kg, money, moneyDelta, number, pence, percent } from '../lib/format';
import { AXES, type BreakEvenAxis, breakEven, describeBreakEven, sensitivitySeries } from '../model/compare';
import type { AppState, CostLine, ScenarioResult } from '../model/types';
import { GROUP_LABELS, GROUP_ORDER, LineChart, StackedBarChart, type StackedBarDatum } from './charts';
import { Pill, Select } from './ui';

function groupTotals(lines: CostLine[]): Record<CostLine['group'], number> {
  const totals = { energy: 0, tax: 0, fixed: 0, capital: 0, reimbursement: 0 };
  for (const line of lines) totals[line.group] += line.annualGBP;
  return totals;
}

export function HeadlineCards({
  state,
  results,
}: {
  state: AppState;
  results: ScenarioResult[];
}) {
  const baseline = results.find((r) => r.scenarioId === state.baselineId) ?? results[0];
  if (!baseline) return null;

  return (
    <div className="headline-grid">
      {results.map((r) => {
        const isBaseline = r.scenarioId === baseline.scenarioId;
        const delta = r.annualTotalGBP - baseline.annualTotalGBP;
        const energyDelta = r.annualEnergyGBP - baseline.annualEnergyGBP;
        return (
          <div key={r.scenarioId} className="headline-card" style={{ borderTopColor: r.colour }}>
            <div className="headline-card-head">
              <h3>{r.label}</h3>
              {isBaseline ? <Pill tone="neutral">Baseline</Pill> : null}
            </div>

            <div className="headline-primary">
              <span className="headline-number">{pence(r.energy.pencePerMile, 1)}</span>
              <span className="headline-unit">per mile on energy</span>
            </div>

            <dl className="headline-list">
              <div>
                <dt>Energy a year</dt>
                <dd>
                  {money(r.annualEnergyGBP)}
                  {!isBaseline ? <small className={energyDelta > 0 ? 'worse' : 'better'}> {moneyDelta(energyDelta)}</small> : null}
                </dd>
              </div>
              <div>
                <dt>Everything a year</dt>
                <dd>
                  {money(r.annualTotalGBP)}
                  {!isBaseline ? <small className={delta > 0 ? 'worse' : 'better'}> {moneyDelta(delta)}</small> : null}
                </dd>
              </div>
              <div>
                <dt>Per month</dt>
                <dd>{money(r.monthlyTotalGBP)}</dd>
              </div>
              <div>
                <dt>Over {state.usage.termYears} years</dt>
                <dd>
                  {money(r.termTotalGBP)}
                  {!isBaseline ? (
                    <small className={r.termTotalGBP - baseline.termTotalGBP > 0 ? 'worse' : 'better'}>
                      {' '}
                      {moneyDelta(r.termTotalGBP - baseline.termTotalGBP)}
                    </small>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>All-in per mile</dt>
                <dd>{pence(r.costPerMilePence, 1)}</dd>
              </div>
              <div>
                <dt>CO2 a year</dt>
                <dd>{kg(r.annualCO2Kg)}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

export function BreakdownSection({ results }: { results: ScenarioResult[] }) {
  const data: StackedBarDatum[] = results.map((r) => ({
    id: r.scenarioId,
    label: r.label,
    groups: groupTotals(r.lines),
    total: r.annualTotalGBP,
  }));
  return <StackedBarChart data={data} unitLabel="per year" />;
}

export function DetailTable({ results }: { results: ScenarioResult[] }) {
  const keys = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of results) for (const l of r.lines) if (!seen.has(l.key)) seen.set(l.key, l.label);
    return [...seen.entries()];
  }, [results]);

  return (
    <div className="table-wrap">
      <table className="detail-table">
        <thead>
          <tr>
            <th scope="col">Annual cost</th>
            {results.map((r) => (
              <th key={r.scenarioId} scope="col">
                <span className="th-swatch" style={{ background: r.colour }} aria-hidden="true" />
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">
                {label}
                <small>{results.find((r) => r.lines.some((l) => l.key === key))?.lines.find((l) => l.key === key)?.detail}</small>
              </th>
              {results.map((r) => {
                const line = r.lines.find((l) => l.key === key);
                return (
                  <td key={r.scenarioId} className={line && line.annualGBP < 0 ? 'better' : undefined}>
                    {line ? money(line.annualGBP) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total a year</th>
            {results.map((r) => (
              <td key={r.scenarioId}>
                <strong>{money(r.annualTotalGBP)}</strong>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Pence per mile</th>
            {results.map((r) => (
              <td key={r.scenarioId}>{pence(r.costPerMilePence, 1)}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function EnergyDetail({ results }: { results: ScenarioResult[] }) {
  return (
    <div className="table-wrap">
      <table className="detail-table">
        <thead>
          <tr>
            <th scope="col">Energy</th>
            {results.map((r) => (
              <th key={r.scenarioId} scope="col">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              Into the battery<small>Energy the car actually stores</small>
            </th>
            {results.map((r) => (
              <td key={r.scenarioId}>{r.energy.annualBatteryKWh > 0 ? `${number(r.energy.annualBatteryKWh)} kWh` : '—'}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">
              Bought at the meter<small>What you are billed for, after charging losses</small>
            </th>
            {results.map((r) => (
              <td key={r.scenarioId}>{r.energy.annualGridKWh > 0 ? `${number(r.energy.annualGridKWh)} kWh` : '—'}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Blended electricity rate</th>
            {results.map((r) => (
              <td key={r.scenarioId}>{r.energy.annualGridKWh > 0 ? `${pence(r.energy.blendedPPerKWh, 1)}/kWh` : '—'}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Fuel used</th>
            {results.map((r) => (
              <td key={r.scenarioId}>{r.energy.annualLitres > 0 ? `${number(r.energy.annualLitres)} litres` : '—'}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Electric miles</th>
            {results.map((r) => (
              <td key={r.scenarioId}>{r.energy.electricMiles > 0 ? number(r.energy.electricMiles) : '—'}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Energy cost a year</th>
            {results.map((r) => (
              <td key={r.scenarioId}>
                <strong>{money(r.energy.totalCostGBP)}</strong>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SensitivitySection({
  state,
  axis,
  onAxisChange,
}: {
  state: AppState;
  axis: BreakEvenAxis;
  onAxisChange: (axis: BreakEvenAxis) => void;
}) {
  const series = useMemo(() => {
    const points = sensitivitySeries(state, axis, 30);
    return state.scenarios.map((s) => ({
      id: s.id,
      label: s.label,
      colour: s.colour,
      points: points.map((p) => ({ x: p.x, y: p.values[s.id] ?? 0 })),
    }));
  }, [state, axis]);

  const crossings = useMemo(() => {
    const baseline = state.baselineId;
    return state.scenarios
      .filter((s) => s.id !== baseline)
      .map((s) => breakEven(state, baseline, s.id, axis))
      .filter((b) => b.value !== null && b.inRange)
      .map((b) => ({ x: b.value as number, label: AXES[axis].format(b.value as number) }));
  }, [state, axis]);

  return (
    <>
      <div className="axis-picker">
        <Select
          value={axis}
          onChange={onAxisChange}
          ariaLabel="What to vary"
          options={(Object.keys(AXES) as BreakEvenAxis[]).map((a) => ({ value: a, label: AXES[a].label }))}
        />
        <p className="axis-hint">
          Everything else is held at the values you entered. Where two lines cross, the two cars cost the same.
        </p>
      </div>
      <LineChart
        series={series}
        xLabel={`${AXES[axis].label} (${AXES[axis].unit})`}
        yLabel="Total cost a year"
        formatX={AXES[axis].format}
        crossings={crossings}
      />
    </>
  );
}

export function BreakEvenSection({ state, results }: { state: AppState; results: ScenarioResult[] }) {
  const baseline = results.find((r) => r.scenarioId === state.baselineId) ?? results[0];
  if (!baseline) return <p className="empty-note">Add a car to see this.</p>;
  const others = results.filter((r) => r.scenarioId !== baseline.scenarioId);
  const axes: BreakEvenAxis[] = ['petrolPrice', 'homeOffPeakRate', 'publicRapidRate', 'annualMiles', 'rapidSharePct'];

  if (others.length === 0) {
    return <p className="empty-note">Add a second vehicle to see where the two break even.</p>;
  }

  return (
    <div className="breakeven-grid">
      {others.map((other) => (
        <div key={other.scenarioId} className="breakeven-card">
          <h3>
            <span className="th-swatch" style={{ background: baseline.colour }} aria-hidden="true" />
            {baseline.label} <span className="vs">vs</span>{' '}
            <span className="th-swatch" style={{ background: other.colour }} aria-hidden="true" />
            {other.label}
          </h3>
          <p className="breakeven-lead">
            {(() => {
              const gap = baseline.annualTotalGBP - other.annualTotalGBP;
              if (Math.round(gap) === 0) return `On your figures the two cost the same today.`;
              const cheaper = gap < 0 ? baseline.label : other.label;
              return (
                <>
                  Today <strong>{cheaper}</strong> is{' '}
                  <strong className="better">{money(Math.abs(gap))} a year cheaper</strong>.
                </>
              );
            })()}
          </p>
          <ul className="breakeven-list">
            {axes.map((axis) => {
              const result = breakEven(state, baseline.scenarioId, other.scenarioId, axis);
              return (
                <li key={axis}>
                  <span className="be-axis">{AXES[axis].label}</span>
                  <span className={`be-value${result.inRange ? '' : ' is-muted'}`}>
                    {describeBreakEven(result, baseline.label, other.label, baseline.scenarioId)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function GroupSummary({ results }: { results: ScenarioResult[] }) {
  return (
    <div className="group-summary">
      {GROUP_ORDER.map((group) => {
        const values = results.map((r) => ({ r, v: groupTotals(r.lines)[group] }));
        if (values.every((v) => Math.abs(v.v) < 0.5)) return null;
        return (
          <div key={group} className="group-summary-row">
            <span className="gs-label">{GROUP_LABELS[group]}</span>
            {values.map(({ r, v }) => (
              <span key={r.scenarioId} className="gs-value">
                <span className="th-swatch" style={{ background: r.colour }} aria-hidden="true" />
                {money(v)}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function EmployerView({ results }: { results: ScenarioResult[] }) {
  const relevant = results.filter((r) => r.tax.bikValueGBP > 0);
  if (relevant.length === 0) {
    return <p className="empty-note">Set a vehicle to company car or salary sacrifice to see what it costs the business.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="detail-table">
        <thead>
          <tr>
            <th scope="col">To the employer</th>
            {relevant.map((r) => (
              <th key={r.scenarioId} scope="col">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Taxable benefit</th>
            {relevant.map((r) => (
              <td key={r.scenarioId}>{money(r.tax.bikValueGBP)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">
              Class 1A NIC<small>Employer NI on the benefit</small>
            </th>
            {relevant.map((r) => (
              <td key={r.scenarioId}>{money(r.tax.employerClass1aGBP)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">
              Net cost after corporation tax relief<small>Negative means the arrangement saves the business money</small>
            </th>
            {relevant.map((r) => (
              <td key={r.scenarioId} className={r.tax.employerNetCostGBP < 0 ? 'better' : undefined}>
                <strong>{money(r.tax.employerNetCostGBP)}</strong>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Your marginal rate</th>
            {relevant.map((r) => (
              <td key={r.scenarioId}>{percent(r.tax.marginalRatePct, 1)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
