'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

const LENGTH = 6;

export interface OtpInputProps {
  /** Chiffres saisis (0 à 6 caractères). */
  value: string;
  onChange: (value: string) => void;
  /** Libellé accessible de la case `n` (1 à 6). */
  cellLabel: (n: number) => string;
  /** Libellé du groupe de cases. */
  groupLabel: string;
  invalid?: boolean;
}

/** Saisie d'un code à 6 chiffres en 6 cases, avec avance automatique et collage. */
export function OtpInput({ value, onChange, cellLabel, groupLabel, invalid }: OtpInputProps) {
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const focusCell = (index: number) => cells.current[Math.min(index, LENGTH - 1)]?.focus();

  const setDigit = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') return;
    const next = value.slice(0, index) + digits + value.slice(index + digits.length);
    onChange(next.slice(0, LENGTH));
    focusCell(index + digits.length);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) onChange(value.slice(0, index) + value.slice(index + 1));
      else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focusCell(index - 1);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) focusCell(index - 1);
    else if (event.key === 'ArrowRight') focusCell(index + 1);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (digits === '') return;
    event.preventDefault();
    onChange(digits);
    focusCell(digits.length);
  };

  return (
    <div className="otp" role="group" aria-label={groupLabel}>
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            cells.current[index] = element;
          }}
          className="otp-cell"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={cellLabel(index + 1)}
          aria-invalid={invalid ? true : undefined}
          maxLength={LENGTH}
          value={value[index] ?? ''}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
        />
      ))}
    </div>
  );
}
