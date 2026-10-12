"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const SLOTS = [0, 1, 2, 3, 4, 5];

/**
 * Six-digit authenticator code input. Always left-to-right (digits), large touch targets,
 * paste-friendly, and calls `onComplete` as soon as the sixth digit is typed.
 */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus = true,
  label,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Accessible name when no visible <label htmlFor={id}> exists. */
  label?: string;
  className?: string;
}) {
  return (
    <div dir="ltr" className={cn("flex justify-center", className)}>
      <InputOTP
        id={id}
        maxLength={6}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
      >
        <InputOTPGroup className="gap-1.5 sm:gap-2">
          {SLOTS.map((index) => (
            <InputOTPSlot
              key={index}
              index={index}
              aria-invalid={invalid || undefined}
              className="size-11 rounded-lg border bg-card text-lg font-semibold shadow-xs first:rounded-lg last:rounded-lg sm:size-12"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
