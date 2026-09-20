# EV Cost Calculator

Work out what an electric car actually costs to run in the UK, and compare it honestly
against petrol, diesel and hybrid alternatives — under personal ownership, as a company car,
or on salary sacrifice.

A single static page. No server, no database, no account: everything is calculated in your
browser, saved to local storage, and encoded in the URL so you can bookmark a comparison or
send it to someone.

**Live: https://alexluckett.github.io/ev-cost-calculator/**

## What it does

**Starts empty.** No sample cars, no assumed mileage, no invented tariff. Nothing describes
you until you say so, and the results stay hidden until the inputs behind them exist — a
calculator that answers "£0 a year" from blank fields is worse than one that says what it
still needs.

**115 UK cars that fill themselves in.** Pick one and its efficiency, emissions, list price
and typical running costs autofill. Every figure stays editable, because your own trip
computer beats anything in a table.

**Energy modelled properly.** A home-versus-rapid charging split, billed on **grid** kWh
rather than battery kWh — roughly a tenth of what you buy on a home charger never reaches the
battery, and that shows up on your bill.

**The tax that actually applies.** Company car tax on the published schedule, with plug-in
hybrids banded by electric range and the diesel surcharge. Salary sacrifice relief derived
from your salary, so the 60% band between £100,000 and £125,140 falls out correctly. The car
fuel benefit charge for employer-paid petrol — and correctly *no* charge for electricity,
which is what makes employer-paid charging such a good perk on an EV. Road tax including the
Expensive Car Supplement, with the £50,000 threshold that zero-emission cars have had since
April 2026.

## Running it

```bash
npm install
npm run dev        # development server
npm test           # calculation test suite
npm run build      # static bundle in dist/
```

Push to `main` deploys to GitHub Pages automatically.

## How it is put together

```
src/
  model/       calculation core — no UI, fully unit tested
    energy.ts    miles to kWh and litres, charging losses
    tax.ts       income tax, NI, company car tax, road tax
    tco.ts       assembles a scenario into itemised annual costs
  data/        vehicle library and tax constants
  state/       store, defaults, URL encoding, readiness checks
  components/  React UI
```

About 2,100 lines of source and 440 of tests. The calculation core has no React in it, so the
numbers can be tested directly.

## About the numbers — provenance

**Tax and duty constants** (`src/data/tax.ts`) are statutory figures checked against published
2026/27 rates. They change every April; verify anything load-bearing.

**The vehicle library** (`src/data/vehicles.ts`) is *estimated, not sourced*. Efficiency,
emissions and prices are close to published specifications, but the real-world mpg and mi/kWh
figures — and the typical insurance and servicing costs — are indicative rather than measured.
The two fields that most affect the answer, real-world efficiency and insurance, are the two
least reliable. That is why every field is editable: treat the library as a way to avoid a
blank form, not as a source of truth.

This is a calculator, not financial or tax advice.

## Deliberately not included

An earlier version had break-even solving, sensitivity charts, an employer cost view, CO2
output, depreciation and finance modelling, congestion charges, the announced 2028 per-mile
road charge, mileage-allowance claims, CSV export and a panel of editable assumptions. All of
it worked; none of it earned the complexity it added to a tool whose job is to answer "what
does each of these cars cost me". It is in the git history if it is ever wanted back.
