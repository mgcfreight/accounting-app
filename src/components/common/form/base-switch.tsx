import { Switch, SwitchProps } from "@heroui/react";
import { Control, FieldValues, Path, useController } from "react-hook-form";

export interface BaseSwitchProps<T extends FieldValues>
  extends Omit<SwitchProps, "name" | "isSelected" | "onValueChange"> {
  name: Path<T>;
  control: Control<T>;
}

export default function BaseSwitch<T extends FieldValues>({
  name,
  control,
  children,
  ...props
}: BaseSwitchProps<T>) {
  const { field } = useController({ name, control });
  return (
    <Switch
      size="sm"
      {...props}
      isSelected={!!field.value}
      onValueChange={field.onChange}
    >
      <span className="text-sm text-content-6">{children}</span>
    </Switch>
  );
}
