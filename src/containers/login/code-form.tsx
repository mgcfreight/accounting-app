import { useForm } from "react-hook-form";
import { BaseButton, RHFTextField } from "@/components/common";

interface CodeFormValues {
  code: string;
}

// Authenticator apps show codes as "123 456", and people paste them so.
const stripSpaces = (value: string) => value.replace(/\s+/g, "");

// One code field and a submit button, for each sign-in step that asks for a
// code (app, recovery or email).
export default function CodeForm({
  label,
  placeholder,
  pattern,
  patternMessage,
  numeric = true,
  submitText = "Verify",
  isSubmitting,
  onSubmit,
}: {
  label: string;
  placeholder?: string;
  pattern: RegExp;
  patternMessage: string;
  // False when the field also takes a recovery code, which has letters.
  numeric?: boolean;
  submitText?: string;
  isSubmitting: boolean;
  onSubmit: (code: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CodeFormValues>({ mode: "onTouched" });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(({ code }) => onSubmit(stripSpaces(code)))}
    >
      <RHFTextField<CodeFormValues>
        name="code"
        register={register}
        error={errors.code}
        rules={{
          required: "Enter the code",
          validate: (value) => pattern.test(stripSpaces(value)) || patternMessage,
        }}
        label={label}
        placeholder={placeholder}
        autoComplete="one-time-code"
        inputMode={numeric ? "numeric" : "text"}
        className="mb-4"
      />
      <BaseButton
        type="submit"
        text={submitText}
        isLoading={isSubmitting}
        className="my-4 w-full"
      />
    </form>
  );
}
