"use client";

import { useId } from "react";
import { byteLength } from "@/lib/format";

/**
 * Form primitives shared by the school and verifier consoles.
 *
 * `maxBytes` counts UTF-8 bytes because that is what the contracts check. The counter
 * turns amber before the limit and the field blocks submission at it, so a school never
 * pays gas to learn a description was two bytes too long.
 */
export function TextField({
  label,
  hint,
  value,
  onChange,
  maxBytes,
  placeholder,
  required = false,
  disabled = false,
  error,
  mono = false,
  inputMode,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxBytes?: number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  mono?: boolean;
  inputMode?: "text" | "decimal" | "numeric" | "url";
}) {
  const id = useId();
  const used = maxBytes ? byteLength(value) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-text">
          {label}
          {required ? <span className="ml-1 text-fault">*</span> : null}
        </label>
        {maxBytes ? <ByteCounter used={used} max={maxBytes} /> : null}
      </div>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        className={`field ${mono ? "font-mono text-[0.875rem]" : ""} ${error ? "field-invalid" : ""}`}
      />
      {error ? (
        <p id={`${id}-help`} role="alert" className="mt-1.5 text-[0.75rem] text-fault">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-help`} className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  maxBytes,
  rows = 5,
  placeholder,
  required = false,
  disabled = false,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxBytes?: number;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const id = useId();
  const used = maxBytes ? byteLength(value) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-text">
          {label}
          {required ? <span className="ml-1 text-fault">*</span> : null}
        </label>
        {maxBytes ? <ByteCounter used={used} max={maxBytes} /> : null}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        className={`field min-h-24 resize-y leading-relaxed ${error ? "field-invalid" : ""}`}
      />
      {error ? (
        <p id={`${id}-help`} role="alert" className="mt-1.5 text-[0.75rem] text-fault">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-help`} className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField<T extends string | number>({
  label,
  hint,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (value: string) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label-text">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="field cursor-pointer pr-8"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function ByteCounter({ used, max }: { used: number; max: number }) {
  const over = used > max;
  const near = !over && used > max * 0.85;
  return (
    <span
      className={`tabular text-[0.6875rem] ${over ? "text-fault" : near ? "text-notice" : "text-ink-faint"}`}
      title="The contract limits this field by UTF-8 bytes, not characters."
    >
      {used}/{max} bytes
    </span>
  );
}

export function ConsoleSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-serif text-[1.0625rem] font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
