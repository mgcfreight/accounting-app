import { Card, CardBody } from "@heroui/react";
import { ReactNode } from "react";
import { Link } from "react-router";
import { DashboardCardItem } from "@/lib/types";

// mokal-app's dashboard KPI card (containers/dashboard/admin/
// admin-dashboard-card.tsx): tinted icon tile, grey label, bold value, and a
// "View" link — or a footer slot, which the totals card uses for its
// currency toggle.
export default function StatCard({
  card,
  footer,
  className = "",
}: {
  card: DashboardCardItem;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`bg-white ${className}`}>
      <CardBody className="flex flex-col justify-between gap-3 px-4 py-3">
        <div className="flex">
          <div
            className={`min-w-14 rounded-2xl p-2 flex items-center justify-center text-3xl ${card.iconBgClass}`}
          >
            {card.icon}
          </div>
          <div className="ml-4">
            <p className="text-sm font-semibold text-[#8F9494]">{card.name}</p>
            <h4 className="mt-1 text-lg font-bold">{card.value}</h4>
            {card.caption && (
              <p className="text-xs text-[#8F9494]">{card.caption}</p>
            )}
          </div>
        </div>
        {/* w-fit: the body is a flex column, which would stretch a chip or
            button in the footer to the card's full width. */}
        {footer ? (
          <div className="w-fit">{footer}</div>
        ) : (
          card.pageLink && (
            <Link
              to={card.pageLink}
              className="flex items-center gap-2 cursor-pointer w-fit"
            >
              <p className="ml-3 text-sm text-[#8F9494]">View</p>
              <img src="/icons/export.svg" alt="" width={15} height={15} />
            </Link>
          )
        )}
      </CardBody>
    </Card>
  );
}
