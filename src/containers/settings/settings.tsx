import { Accordion, AccordionItem } from "@heroui/react";
import { ComponentType, useMemo, useState } from "react";
import { LeavePageModal } from "@/components/common";
import { useUnsavedChanges } from "@/hooks";
import AccountingPeriods from "./accounting-periods";
import ChargeTypes from "./charge-types";
import CompanyInformation from "./company-information";
import NoticeSettingsSection from "./notice-settings";
import TaxRates from "./tax-rates";

type Section = {
  key: string;
  title: string;
  subtitle: string;
  Body: ComponentType<{ onDirtyChange: (dirty: boolean) => void }>;
};

// The "Settings and lookups" module of the v5 database document.
const sections: Section[] = [
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
// Closed sections stay mounted, so opening another section doesn't throw away
// unsaved edits in this one; `inert` keeps a closed section out of the tab
// order.
//
// Because every section is mounted at once, the page — not each section —
// asks before leaving: a router keeps only one blocker, so a section's own
// would silently replace another's. Sections with a form report whether they
// have unsaved edits through `onDirtyChange`.
export default function Settings() {
  const [opened, setOpened] = useState<string>("company");
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const leaving = useUnsavedChanges(Object.values(dirty).some(Boolean));

  // One stable callback per section, so a section's effect runs only when
  // its own dirty state changes.
  const onDirtyChange = useMemo(
    () =>
      Object.fromEntries(
        sections.map(({ key }) => [
          key,
          (isDirty: boolean) =>
            setDirty((prev) =>
              prev[key] === isDirty ? prev : { ...prev, [key]: isDirty }
            ),
        ])
      ),
    []
  );

  return (
    <>
      <Accordion
        variant="splitted"
        className="gap-4 px-0"
        keepContentMounted
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
            <div inert={opened !== key}>
              <Body onDirtyChange={onDirtyChange[key]} />
            </div>
          </AccordionItem>
        ))}
      </Accordion>
      <LeavePageModal
        isOpen={leaving.blocked}
        onStay={leaving.stay}
        onLeave={leaving.leave}
      />
    </>
  );
}
