import { money, pence } from '../lib/format';
import type { AppState, ScenarioResult } from '../model/types';

/** The headline each car earns: cost per mile and what a year costs. */
export function HeadlineCards({ state, results }: { state: AppState; results: ScenarioResult[] }) {
  const cheapest = results.reduce((best, r) => (r.annualTotalGBP < best.annualTotalGBP ? r : best), results[0]);

  return (
    <div className="headline-grid">
      {results.map((r) => {
        const delta = r.annualTotalGBP - cheapest.annualTotalGBP;
        return (
          <div key={r.scenarioId} className="headline-card" style={{ borderTopColor: r.colour }}>
            <h3>{r.label}</h3>

            <div className="headline-primary">
              <span className="headline-number">{pence(r.energy.pencePerMile, 1)}</span>
              <span className="headline-unit">per mile on energy</span>
            </div>

            <dl className="headline-list">
              <div>
                <dt>Energy a year</dt>
                <dd>{money(r.annualEnergyGBP)}</dd>
              </div>
              <div>
                <dt>Everything a year</dt>
                <dd>
                  {money(r.annualTotalGBP)}
                  {delta > 0 ? <small className="worse"> +{money(delta)}</small> : null}
                </dd>
              </div>
              <div>
                <dt>Per month</dt>
                <dd>{money(r.monthlyTotalGBP)}</dd>
              </div>
              <div>
                <dt>Over {state.termYears} years</dt>
                <dd>{money(r.termTotalGBP)}</dd>
              </div>
              <div>
                <dt>All-in per mile</dt>
                <dd>{pence(r.costPerMilePence, 1)}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

/** Every line, so no number in the headline is unexplained. */
export function DetailTable({ results }: { results: ScenarioResult[] }) {
  const keys = new Map<string, string>();
  for (const r of results) for (const l of r.lines) if (!keys.has(l.key)) keys.set(l.key, l.label);

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
          {[...keys].map(([key, label]) => {
            const detail = results.flatMap((r) => r.lines).find((l) => l.key === key)?.detail;
            return (
              <tr key={key}>
                <th scope="row">
                  {label}
                  {detail ? <small>{detail}</small> : null}
                </th>
                {results.map((r) => {
                  const line = r.lines.find((l) => l.key === key);
                  return <td key={r.scenarioId}>{line ? money(line.annualGBP) : '—'}</td>;
                })}
              </tr>
            );
          })}
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
