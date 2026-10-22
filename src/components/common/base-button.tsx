import { Button, ButtonProps } from "@heroui/react";

// mokal-app's BaseButton: a HeroUI Button with the app's height, radius and
// type size. `varient` keeps mokal-app's spelling so call sites port as-is.
export interface BaseButtonProps extends Omit<ButtonProps, "variant"> {
  text?: string;
  varient?: ButtonProps["variant"];
  // With `as={Link}` from react-router: the link's destination, passed
  // through to it. Leave unset on a plain button.
  to?: string;
}

export default function BaseButton({
  text,
  color = "primary",
  size,
  varient = "solid",
  className = "",
  startContent,
  children,
  ...props
}: BaseButtonProps) {
  return (
    <Button
      color={color}
      variant={varient}
      size={size}
      className={`h-10 rounded-md text-xs ${
        varient === "solid" ? "text-white" : ""
      } ${className}`}
      startContent={startContent}
      {...props}
    >
      {text ?? children}
    </Button>
  );
}
