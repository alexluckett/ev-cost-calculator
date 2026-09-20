const gbp0 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const gbp2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return decimals > 0 ? gbp2.format(value) : gbp0.format(value);
}

/** Signed money, for differences where the direction is the point. */
export function moneyDelta(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const formatted = money(Math.abs(value));
  if (Math.round(value) === 0) return 'the same';
  return value > 0 ? `+${formatted}` : `−${formatted}`;
}

export function pence(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}p`;
}

export function number(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function percent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function kg(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} t` : `${Math.round(value)} kg`;
}
