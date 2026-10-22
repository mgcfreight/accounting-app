// The rounded status pill from mokal-app's tables and invoice detail page
// (`bg-base-primary-500 text-xs text-white rounded-2xl px-3 py-1`), with one
// tone per kind of status.

export type ChipTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "secondary";

const toneClass: Record<ChipTone, string> = {
  primary: "bg-base-primary-500 text-white",
  success: "bg-base-success text-white",
  warning: "bg-base-warning text-white",
  danger: "bg-base-danger text-white",
  secondary: "bg-base-secondary-500 text-white",
  neutral: "bg-content-3 text-content-6",
};

export default function StatusChip({
  text,
  tone = "primary",
  className = "",
}: {
  text: string;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-2xl px-3 py-1 text-xs ${toneClass[tone]} ${className}`}
    >
      {text}
    </span>
  );
}
