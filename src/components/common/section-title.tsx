import { ReactNode } from "react";

// The icon + bold heading over a dashboard panel ("Recent Shipment" in
// mokal-app).
export default function SectionTitle({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pb-4 border-b-2 border-base-default">
      <div className="flex items-center gap-2">
        {icon && <span className="text-base-primary-200 text-xl">{icon}</span>}
        <p className="text-xl font-semibold text-base-primary-900">{title}</p>
      </div>
      {action}
    </div>
  );
}
