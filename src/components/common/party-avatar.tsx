import { createInitials } from "@/lib/utils";

// The initials circle and name/sub-line used in mokal-app's table cells.
export default function PartyAvatar({
  name,
  subtitle,
  tone = "primary",
}: {
  name: string;
  subtitle?: string;
  tone?: "primary" | "success";
}) {
  return (
    <div className="flex items-center gap-3 min-w-44">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs text-white uppercase ${
          tone === "success" ? "bg-base-success" : "bg-base-primary-500"
        }`}
      >
        {createInitials(name)}
      </div>
      <div className="flex flex-col">
        <span className="font-medium text-sm text-[#343A40]">{name}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
    </div>
  );
}
