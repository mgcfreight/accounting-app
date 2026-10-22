import { Textarea, TextAreaProps } from "@heroui/react";
import {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
  useController,
} from "react-hook-form";

export interface BaseTextAreaProps<T extends FieldValues>
  extends Omit<TextAreaProps, "name" | "value" | "onChange" | "defaultValue"> {
  name: Path<T>;
  control: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
}

export default function BaseTextArea<T extends FieldValues>({
  name,
  control,
  rules,
  variant = "bordered",
  classNames = { label: "text-base-primary text-xs", input: "text-xs" },
  ...props
}: BaseTextAreaProps<T>) {
  const {
    field: { name: fieldName, value, onChange, onBlur, ref },
    fieldState: { error },
  } = useController({ name, control, rules });
  return (
    <Textarea
      variant={variant}
      classNames={classNames}
      isInvalid={!!error}
      errorMessage={error?.message}
      {...props}
      name={fieldName}
      value={value ?? ""}
      onValueChange={onChange}
      onBlur={onBlur}
      ref={ref}
    />
  );
}
