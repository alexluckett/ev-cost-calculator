# EV Cost Calculator — Requirements Analysis & Feature Specification

## 1. The brief, restated

> "I own a Tesla Model Y Premium Long Range AWD and live in the UK. I want to compare my cost
> of ownership — primarily energy — against other vehicles including petrol/diesel. I want to
> input my current car, an old car, my mileage, my electricity unit rate and my petrol costs.
> I want to pick vehicles from a list that autofills battery/tank capacity. I want to model
> company ownership with Benefit in Kind versus personal ownership, configurable per vehicle.
> For the EV I want to model occasional supercharging by percentage. It must be lightweight
> with little or no server-side setup."

## 2. Analysis of the stated requirements

| # | Stated requirement | Interpretation | Gaps / risks identified |
|---|---|---|---|
| R1 | Compare cost of ownership, energy-first | Energy is the headline, but "ownership" implies the standing costs too | Energy alone is a misleading comparison: an EV usually wins on energy and can still lose on total cost because of depreciation, insurance and the VED Expensive Car Supplement. The tool must lead with energy **and** show total cost so the comparison is honest. |
| R2 | Input current car, old car, mileage, electricity rate, petrol cost | Multi-vehicle comparison with shared usage assumptions | Two vehicles is the minimum, not the maximum. "Should I keep the old car or buy X?" needs 3+. Mileage and prices belong to *you*, not to a car, so they are global inputs; everything else is per-vehicle. |
| R3 | Pick from a preset list, autofilling battery/tank capacity | Vehicle library with sensible defaults | Battery and tank capacity alone don't determine cost — **efficiency** does (mi/kWh, mpg). The presets must carry real-world efficiency, and every autofilled number must stay editable, because published WLTP/NEDC figures are optimistic and your own numbers are better. |
| R4 | Company ownership with BiK vs personal ownership, per vehicle | Ownership model is a per-vehicle setting | "Company ownership" in the UK is really three different things: a company car (BiK on P11D), salary sacrifice (BiK *plus* income-tax and NI savings on the sacrificed salary), and a business buying a car outright. They produce very different answers. Also needs a marginal tax rate — and taking that as a simple 20/40/45 dropdown misses the 60% effective band between £100k and £125,140 and the Scottish rates. |
| R5 | Lightweight, no complex server | Static site | Rules out a database and user accounts. State must live in the browser (localStorage) and in the URL so scenarios can be shared. |
| R6 | EV charge split — home vs occasional rapid, by percentage | Weighted blended cost per kWh | A single "percentage" isn't how people actually think. "I charge at home most of the time and rapid-charge once a month" is a *frequency*, not a share. Support both entry modes. Also: home charging is rarely one rate — UK EV tariffs are time-of-use (e.g. a cheap overnight window and a much higher day rate), so home itself needs splitting. And **charging losses are real**: roughly 8–12% of AC grid energy never reaches the battery, so pence-per-mile computed from battery kWh understates the bill. |

## 3. What the brief did not ask for but the product needs

These were added because without them the answer the tool gives would be wrong, or too fragile to trust.

1. **Charging losses.** Energy billed at the meter > energy stored in the battery. Separate AC and DC efficiency factors.
2. **Time-of-use home tariffs.** An off-peak rate, a peak rate, and the share of home charging that lands off-peak. This is the single biggest lever on UK EV running cost.
3. **A full charging mix, not just two sources.** Home off-peak, home peak, workplace (often free), public rapid DC, public slow/destination AC.
4. **Real-world vs official efficiency.** A derating factor applied to both mpg and mi/kWh, plus a seasonal/winter penalty for EVs.
5. **VED including the Expensive Car Supplement.** Since April 2025 EVs pay VED, and any car with a list price over £40,000 — which includes the Model Y — pays a substantial supplement in years 2–6. Omitting this flatters the EV.
6. **Depreciation and finance.** For most people the largest line in true cost of ownership. Optional, because "energy only" is a legitimate view, but available.
7. **Correct marginal-rate derivation.** Compute income tax and NI on salary, and again on salary minus sacrifice, and take the difference. This handles the personal-allowance taper and the Scottish bands exactly, instead of approximating.
8. **Employer-side view.** If you own the company, the Class 1A NIC and corporation-tax relief decide whether a company car is actually cheaper.
9. **Business mileage reimbursement.** AMAP for personally-owned cars and the Advisory Electric Rate for company cars change the answer materially for high business mileage.
10. **PHEV and hybrid support.** A PHEV's cost depends entirely on the share of miles driven on electricity; treating it as either a petrol car or an EV is wrong.
11. **Break-even analysis.** "At what petrol price / electricity rate / annual mileage do these two cars cost the same?" is the question behind the question.
12. **Sensitivity charts.** One number with hidden assumptions is a trap. Show how the answer moves with mileage and with rapid-charging share.
13. **Every assumption visible and editable, and dated.** Tax rates change every April. The tool states what it assumed and when those figures were current.
14. **Shareable, saveable state.** URL-encoded scenarios and localStorage, plus CSV/JSON export.
15. **CO2 comparison.** Cheap to add once the energy model exists, and it is part of "which car should I run".

## 4. Feature list (what was built)

### 4.1 Vehicle selection
- Searchable preset library of UK-market vehicles (BEV, PHEV, hybrid, petrol, diesel), including older used cars for the "my old car" comparison.
- Presets autofill: usable battery capacity, real-world and official efficiency, WLTP range, peak DC rate, tank capacity, mpg, CO2 g/km, list price / P11D, VED band and typical insurance and servicing costs.
- Every field remains editable; a preset is a starting point, not a constraint.
- Fully custom vehicles supported.
- Compare 2 to 4 vehicles side by side.

### 4.2 Usage and energy inputs (global)
- Annual mileage, comparison term in years, business-mileage share.
- Electricity: home off-peak rate, home peak rate, workplace rate, public rapid DC rate, public slow AC rate.
- Tariff presets for common UK EV tariffs, all editable.
- Petrol and diesel pence per litre.
- Optional annual price inflation for energy, applied over the comparison term.

### 4.3 Charging model (per EV/PHEV)
- Charging mix across five sources with shares that always total 100%.
- Two ways to express rapid charging: a percentage, or "N sessions per month of M kWh" which converts to a share automatically.
- Off-peak share of home charging.
- AC and DC charging-loss factors, so cost is computed on grid kWh, not battery kWh.
- Winter/real-world efficiency derating.
- Reports battery kWh, grid kWh, blended p/kWh and p/mile.

### 4.4 Ownership and tax model (per vehicle)
- Four ownership models: personal cash/owned, personal finance or lease, company car, salary sacrifice.
- BiK: zero-emission percentage schedule by tax year; CO2-banded table for ICE with the diesel surcharge; P11D value with optional capital contribution.
- Salary sacrifice: exact income tax and NI saving derived from the salary, including the 100k–125,140 taper and Scottish bands.
- Employer view: Class 1A NIC and corporation-tax relief.
- Business mileage reimbursement: AMAP 45p/25p for personal ownership, AER for company cars.
- Private fuel benefit charge for company ICE cars where the employer pays for private fuel.

### 4.5 Running costs (per vehicle)
- VED with automatic Expensive Car Supplement handling.
- Insurance, servicing and maintenance, tyres per mile, MOT, breakdown cover.
- Optional depreciation from list price and residual value.
- Optional finance: deposit, monthly payment, term.
- Optional congestion/clean-air-zone charge days per year.

### 4.6 Outputs
- Headline: pence per mile (energy), annual energy cost, annual total cost, cost over the term, and the delta against the chosen baseline vehicle.
- Stacked cost-breakdown chart by category, per vehicle.
- Sensitivity: cost vs annual mileage, and cost vs rapid-charging share.
- Break-even solver: the petrol price, electricity rate and annual mileage at which two vehicles cost the same.
- CO2 per year, tailpipe plus grid intensity for electricity.
- Full itemised table with every line shown.

### 4.7 Product and platform
- Pure static single-page app — no server, no build-time secrets, no database. Deployable to GitHub Pages or any static host.
- State persisted to localStorage and encoded in the URL for sharing.
- JSON export/import of a full comparison; CSV export of results.
- Light and dark themes, responsive down to phone width, print-friendly.
- Assumptions panel exposing every tax and physical constant with its "as of" date.
- Unit-tested calculation core, kept free of UI concerns.

## 5. Explicitly out of scope

- Live price feeds (fuel, electricity, used-car values) — that would need a server or a paid API, contradicting R5. Prices are inputs with sensible defaults.
- User accounts and cloud sync.
- Financial advice. The tool is a calculator; tax figures are defaults that the user is told to verify.

## 6. Accuracy stance

Tax and duty figures change every April, and vehicle efficiency varies with driving. Every constant used by
the calculator lives in one place (`src/data/tax.ts` and `src/data/assumptions.ts`), carries an `asOf` label,
and is surfaced in the Assumptions panel so it can be checked and overridden. The vehicle library holds
indicative real-world figures, not manufacturer claims, and is editable per comparison.
