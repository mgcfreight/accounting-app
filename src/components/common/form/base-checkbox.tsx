import { Checkbox, CheckboxProps } from "@heroui/react";

// The app's one checkbox look: HeroUI's small primary checkbox with the tick
// drawn in white. Works on its own or inside a CheckboxGroup. A `wrapper`
// class passed in is added to the white tick, not put in its place.
export default function BaseCheckbox({
  size = "sm",
  color = "primary",
  classNames,
  ...props
}: CheckboxProps) {
  return (
    <Checkbox
      size={size}
      color={color}
      {...props}
      classNames={{
        ...classNames,
        wrapper: `text-white ${classNames?.wrapper ?? ""}`,
      }}
    />
  );
}
