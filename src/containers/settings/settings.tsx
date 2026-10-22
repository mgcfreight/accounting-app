import { Accordion, AccordionItem } from "@heroui/react";
import { useState } from "react";
import CompanyInformation from "./company-information";
import ReminderSchedule from "./reminder-schedule";
import TaxRates from "./tax-rates";
import UsersSection from "./users-section";

const sections = [
  { key: "company", title: "Company Information", Body: CompanyInformation },
  { key: "tax", title: "Tax Rates", Body: TaxRates },
  { key: "schedule", title: "Reminders & Statements", Body: ReminderSchedule },
  { key: "users", title: "Users & Roles", Body: UsersSection },
];

// mokal-app's settings page: a split accordion, one open section at a time.
// Settings are Admin only (design §9): the roles are in lib/routes.config.ts
// and RouteGuard keeps other roles out; the API enforces it.
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
