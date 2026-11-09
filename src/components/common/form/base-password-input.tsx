import { useState } from "react";
import { FieldValues } from "react-hook-form";
import { EyeIcon } from "../../icons";
import BaseInput, { BaseInputProps } from "./base-input";

// BaseInput for a password, with the eye toggle RHFPasswordField has, so
// someone typing a password can check it before saving.
export default function BasePasswordInput<T extends FieldValues>(
  props: Omit<BaseInputProps<T>, "type" | "endContent">
) {
  const [isRevealed, setIsRevealed] = useState(false);
  return (
    <BaseInput
      {...props}
      type={isRevealed ? "text" : "password"}
      endContent={
        <button
          type="button"
          onClick={() => setIsRevealed((revealed) => !revealed)}
          aria-label={isRevealed ? "Hide password" : "Show password"}
          aria-pressed={isRevealed}
          className="rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-base-primary"
        >
          <EyeIcon className={isRevealed ? "opacity-100" : "opacity-40"} />
        </button>
      }
    />
  );
}
