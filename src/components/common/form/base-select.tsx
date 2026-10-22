import { Select, SelectItem, SelectProps } from "@heroui/react";
import {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
  useController,
} from "react-hook-form";
import { SelectOption } from "@/lib/types";

export interface BaseSelectProps<T extends FieldValues>
  extends Omit<
    SelectProps,
    "name" | "children" | "selectedKeys" | "onSelectionChange"
  > {
  name: Path<T>;
  control: Control<T>;
  options: SelectOption[];
  rules?: RegisterOptions<T, Path<T>>;
}

// mokal-app's BaseSelect (single selection), bound to react-hook-form. The
// field holds the option's `key`.
export default function BaseSelect<T extends FieldValues>({
  name,
  control,
  options,
  rules,
  variant = "bordered",
  className = "w-full",
  classNames = {
    label: "text-base-primary text-xs",
    value: "text-xs",
  },
  ...props
}: BaseSelectProps<T>) {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({ name, control, rules });

  return (
    <Select
      ref={ref}
      variant={variant}
      className={className}
      classNames={classNames}
      isInvalid={!!error}
      errorMessage={error?.message}
      selectedKeys={value ? [String(value)] : []}
      onSelectionChange={(keys) => {
        const [key] = Array.from(keys);
        onChange(key === undefined ? "" : String(key));
      }}
      onClose={onBlur}
      {...props}
    >
      {options.map((option) => (
        <SelectItem key={option.key}>{option.label}</SelectItem>
      ))}
    </Select>
  );
}
