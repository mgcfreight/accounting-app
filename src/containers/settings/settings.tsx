import { Accordion, AccordionItem } from "@heroui/react";
import { useState } from "react";
import AccountingPeriods from "./accounting-periods";
import ChargeTypes from "./charge-types";
import CompanyInformation from "./company-information";
import NoticeSettingsSection from "./notice-settings";
import TaxRates from "./tax-rates";

// The "Settings and lookups" module of the v5 database document.
const sections = [
  {
    key: "company",
    title: "Company Information",
    subtitle: "Legal name, GST/HST number and address printed on invoices",
    Body: CompanyInformation,
  },
  {
    key: "tax",
    title: "Tax Rates",
    subtitle: "Tax codes, their rates and the dates they apply",
    Body: TaxRates,
  },
  {
    key: "charges",
    title: "Charge Types",
    subtitle: "The kinds of charge an invoice line can be",
    Body: ChargeTypes,
  },
  {
    key: "notices",
    title: "Notices & Alerts",
    subtitle: "Default notice days for billing and carrier payments",
    Body: NoticeSettingsSection,
  },
  {
    key: "periods",
    title: "Accounting Periods",
    subtitle: "Month-end close: closed months can't be changed",
    Body: AccountingPeriods,
  },
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
      onSelectionChange={(keys) => {
        const [key] = Array.from(keys as Set<string>);
        setOpened(key ?? "");
      }}
    >
      {sections.map(({ key, title, subtitle, Body }) => (
        <AccordionItem
          key={key}
          aria-label={title}
          title={title}
          subtitle={subtitle}
          className={`${
            opened !== key
              ? "border-base-secondary-200 hover:border-base-primary"
              : "border-base-primary"
          } border-1 shadow-none bg-white transition-colors`}
          classNames={{
            title: `${
              opened !== key ? "text-base-secondary-800" : "text-base-primary"
            } text-base sm:text-lg font-semibold`,
            subtitle: "text-xs sm:text-sm text-content-5",
            trigger:
              "py-4 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-base-primary",
            indicator: `${
              opened !== key ? "text-base-secondary-800" : "text-base-primary"
            } text-lg`,
          }}
        >
          <Body />
        </AccordionItem>
      ))}
    </Accordion>
  );
}
