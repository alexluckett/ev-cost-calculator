# EV Cost Calculator

Work out what an electric car actually costs you to run in the UK, and compare it honestly
against petrol, diesel, hybrid and plug-in hybrid alternatives — including the company car
and salary sacrifice routes.

It is a single static page. There is no server, no database and no account: everything is
calculated in your browser, saved to local storage, and encoded in the URL so you can
bookmark a comparison or send it to someone.

## What it does

**Energy, properly modelled.** Most calculators multiply miles by a single unit rate. This one
splits your charging across home off-peak, home peak, workplace, public rapid DC and public
slow AC, and bills you for **grid** kWh rather than battery kWh — roughly a tenth of what you
buy on a home charger never reaches the battery, and that shows up on your bill.

**Rapid charging described the way people actually think about it.** Either as a percentage of
your charging, or as "one session a month of 45 kWh", which the calculator converts into a
share and rebalances the rest of the mix around.

**A vehicle library that autofills the numbers.** Sixty-odd UK-market cars with usable battery
capacity, real-world efficiency, tank size, mpg, CO2, list price and typical insurance and
servicing — including older used cars for the "should I just keep my current one" comparison.
Every autofilled value stays editable, because your own mi/kWh beats anything in a table.

**Personal versus company ownership.** Four models — owned outright, personal finance or lease,
company car, and salary sacrifice — each with the tax that actually applies:

- Benefit in Kind on the published appropriate-percentage schedule, with plug-in hybrids banded
  by electric range and the diesel surcharge where it applies.
- Salary sacrifice relief computed from your salary rather than a 20/40/45 dropdown, so the 60%
  effective band between £100,000 and £125,140 and the Scottish rates fall out correctly.
- The car fuel benefit charge when an employer pays for private petrol — and correctly *no*
  charge for electricity.
- AMAP and Advisory Electric Rate mileage reimbursement.
- An employer view with Class 1A NIC and corporation tax relief.

**The costs people forget.** VED including the Expensive Car Supplement, which catches almost
every new EV, depreciation, tyres per mile, and the announced per-mile road charge for plug-in
cars (off by default, because it is not yet in force).

**Answers, not just numbers.** Break-even solving — the petrol price, electricity rate, rapid
share and annual mileage at which two cars cost the same — plus sensitivity charts and a full
itemised table.

## Running it

```bash
npm install
npm run dev        # development server
npm test           # calculation test suite
npm run build      # static bundle in dist/
npm run preview    # serve the built bundle
```

The build output is plain static files. Drop `dist/` on any static host, or let the included
GitHub Actions workflow publish it to GitHub Pages.

## How it is put together

```
src/
  model/       calculation core — no UI, fully unit tested
    energy.ts    miles to kWh and litres, charging mix, losses
    tax.ts       income tax, NI, BiK, VED, mileage allowances
    tco.ts       assembles a scenario into itemised annual costs
    compare.ts   break-even solving and sensitivity sweeps
  data/        vehicle library, tariff presets, tax constants
  state/       store, defaults, URL encoding
  components/  React UI, including hand-rolled SVG charts
```

The calculation core is deliberately separate from the UI and has no React in it, so the
numbers can be tested directly. `npm test` covers the energy model, the tax rules and the
scenario assembly.

## About the numbers

Vehicle figures are indicative real-world values, not manufacturer claims — official
consumption tests are optimistic, and comparing optimistic numbers to each other tells you
nothing useful.

Tax and duty constants live in `src/data/tax.ts` and `src/data/assumptions.ts`, each with an
"as of" label, and all of them are exposed and editable in the app's Assumptions panel.
They are current for the 2025/26 tax year with later years following the published schedule.
**Rates change every April.** Check anything you are about to make an expensive decision on,
and override it in the app if it has moved.

This is a calculator, not financial or tax advice.

## Requirements

The full analysis of the brief, the gaps found in it and the resulting feature list are in
[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md).
