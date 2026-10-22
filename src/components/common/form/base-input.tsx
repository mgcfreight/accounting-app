import { Input, InputProps } from "@heroui/react";
import {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
  useController,
} from "react-hook-form";

export interface BaseInputProps<T extends FieldValues>
  extends Omit<InputProps, "name" | "value" | "onChange" | "defaultValue"> {
  name: Path<T>;
  control: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
}

// mokal-app's BaseInput: a bordered HeroUI Input bound to react-hook-form.
export default function BaseInput<T extends FieldValues>({
  name,
  control,
  rules,
  variant = "bordered",
  classNames = {
    label: "text-base-primary text-xs",
    input: "text-xs",
  },
  ...props
}: BaseInputProps<T>) {
  // Destructured: the hooks lint treats any read from an object that holds a
  // `ref` as reading a ref during render.
  const {
    field: { name: fieldName, value, onChange, onBlur, ref },
    fieldState: { error },
  } = useController({ name, control, rules });
  return (
    <Input
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
