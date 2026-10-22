import { InputHTMLAttributes, useState } from "react";
import {
  FieldError,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form";
import { EyeIcon } from "../../icons";
import {
  fieldErrorClass,
  fieldInputClass,
  fieldLabelClass,
  fieldWrapperClass,
} from "./rhf-field-styles";

// mokal-app's RHFTextField / RHFPasswordField. They render a native input
// bound with `register`, so a value the browser autofills before hydration is
// read off the node instead of being overwritten by a controlled "". The form
// must not declare `defaultValues` for these fields, for the same reason.

export interface RHFFieldProps<T extends FieldValues>
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "name" | "value" | "defaultValue" | "onChange" | "onBlur"
  > {
  name: Path<T>;
  register: UseFormRegister<T>;
  rules?: RegisterOptions<T, Path<T>>;
  error?: FieldError;
  label: string;
}

export function RHFTextField<T extends FieldValues>({
  name,
  register,
  rules,
  error,
  label,
  className = "",
  type = "text",
  ...props
}: RHFFieldProps<T>) {
  const errorId = `${name}-error`;
  return (
    <div className={className}>
      <div className={fieldWrapperClass}>
        <input
          {...props}
          id={name}
          type={type}
          className={fieldInputClass(!!error)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...register(name, rules)}
        />
        <label htmlFor={name} className={fieldLabelClass(!!error)}>
          {label}
        </label>
      </div>
      {error?.message ? (
        <p id={errorId} className={fieldErrorClass}>
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export function RHFPasswordField<T extends FieldValues>({
  name,
  register,
  rules,
  error,
  label,
  className = "",
  ...props
}: Omit<RHFFieldProps<T>, "type">) {
  const [isRevealed, setIsRevealed] = useState(false);
  const errorId = `${name}-error`;
  return (
    <div className={className}>
      <div className={fieldWrapperClass}>
        <input
          {...props}
          id={name}
          type={isRevealed ? "text" : "password"}
          className={`${fieldInputClass(!!error)} pr-10`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...register(name, rules)}
        />
        <label htmlFor={name} className={fieldLabelClass(!!error)}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsRevealed((revealed) => !revealed)}
          aria-label={isRevealed ? "Hide password" : "Show password"}
          aria-pressed={isRevealed}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-base-primary"
        >
          <EyeIcon className={isRevealed ? "opacity-100" : "opacity-40"} />
        </button>
      </div>
      {error?.message ? (
        <p id={errorId} className={fieldErrorClass}>
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
