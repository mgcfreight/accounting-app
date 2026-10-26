import { Accordion, AccordionItem } from "@heroui/react";
import { useState } from "react";
import AccountingPeriods from "./accounting-periods";
import ChargeTypes from "./charge-types";
import CompanyInformation from "./company-information";
import NoticeSettingsSection from "./notice-settings";
import TaxRates from "./tax-rates";

// The "Settings and lookups" module of the v5 database document.
const sections = [
  { key: "company", title: "Company Information", Body: CompanyInformation },
  { key: "tax", title: "Tax Rates", Body: TaxRates },
  { key: "charges", title: "Charge Types", Body: ChargeTypes },
  { key: "notices", title: "Notices & Alerts", Body: NoticeSettingsSection },
  { key: "periods", title: "Accounting Periods", Body: AccountingPeriods },
];

// mokal-app's settings page: a split accordion, one open section at a time.
// Settings are Admin only (design §9): the roles are in lib/routes.config.ts
// and RouteGuard keeps other roles out; the API enforces it. Users have their
// own page (/users/), and the audit report is at /settings/audit-log/.
export default function Settings() {
  const [opened, setOpened] = useState<string>("company");

  return (
    <Accordion
      variant="splitted"
      className="gap-4 px-0"
      defaultSelectedKeys={["company"]}
      hideIndicator
      onSelectionChange={(keys) => {
        const [key] = Array.from(keys as Set<string>);
        setOpened(key ?? "");
      }}
    >
      {sections.map(({ key, title, Body }) => (
        <AccordionItem
          key={key}
          aria-label={title}
          title={title}
          className={`${
            opened !== key ? "border-base-secondary-200 border-1" : ""
          } shadow-none bg-white`}
          classNames={{
            title: `${
              opened !== key ? "text-base-secondary-800" : "text-base-primary"
            } text-xl sm:text-3xl`,
            trigger: "py-6",
          }}
        >
          <Body />
        </AccordionItem>
      ))}
    </Accordion>
  );
}
