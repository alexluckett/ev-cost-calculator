import { useId, useState, type ReactNode } from 'react';

export interface OverrideState {
  /** The preset's value, already formatted for display. */
  presetValue: string;
  onReset: () => void;
}

interface FieldProps {
  label: string;
  hint?: string;
  children?: ReactNode;
  /**
   * Present when this value came from a preset and has since been changed.
   * Shows what the preset said and offers a way back to it.
   */
  override?: OverrideState | null;
}

/** A labelled control with an optional explanation revealed on demand. */
export function Field({ label, hint, children, override }: FieldProps) {
  const id = useId();
  return (
    <div className={`field${override ? ' is-overridden' : ''}`}>
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {override ? (
          <span className="field-changed" title="You have changed this from the preset">
            changed
          </span>
        ) : null}
        {hint ? <InfoDot text={hint} /> : null}
      </div>
      <div className="field-control" id={id}>
        {children}
      </div>
      {override ? (
        <p className="field-preset-note">
          Preset: {override.presetValue}
          <button type="button" className="link-button" onClick={override.onReset}>
            Reset
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="info">
      <button
        type="button"
        className="info-button"
        aria-expanded={open}
        aria-label="What does this mean?"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open ? <span className="info-bubble">{text}</span> : null}
    </span>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  disabled,
  ariaLabel,
}: NumberInputProps) {
  // Held as text while editing so a half-typed number (or an empty box)
  // doesn't get rewritten under the cursor.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '');

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
  };

  return (
    <span className={`num-input${disabled ? ' is-disabled' : ''}`}>
      {prefix ? <span className="affix">{prefix}</span> : null}
      <input
        type="number"
        inputMode="decimal"
        value={shown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix ? <span className="affix affix-end">{suffix}</span> : null}
    </span>
  );
}

interface SelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  ariaLabel?: string;
}

export function Select<T extends string>({ value, onChange, options, disabled, ariaLabel }: SelectProps<T>) {
  return (
    <select
      className="select"
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="toggle-row">
      <label className={`toggle${disabled ? ' is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
        <span className="toggle-label">{label}</span>
      </label>
      {hint ? <InfoDot text={hint} /> : null}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
  actions,
  id,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="section-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Disclosure({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`disclosure${open ? ' is-open' : ''}`}>
      <button type="button" className="disclosure-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="disclosure-chevron" aria-hidden="true">
          ▸
        </span>
        <span className="disclosure-title">{title}</span>
        {badge ? <span className="disclosure-badge">{badge}</span> : null}
      </button>
      {open ? <div className="disclosure-body">{children}</div> : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button type="button" className={`btn btn-${variant}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
