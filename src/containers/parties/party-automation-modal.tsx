import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormModal } from "@/components/common";
import { BaseInput, BaseSelect, BaseSwitch, BaseTextArea } from "@/components/common/form";
import {
  AutomationKind,
  InvoiceDeliveryMode,
  StatementFrequency,
  StatementScope,
} from "@/lib/enums";
import { AutomationRule, ContactView } from "@/lib/interfaces";
import {
  AutomationSpec,
  frequencyLabels,
  parseEmails,
  parseSteps,
  scopeLabels,
  unknownPlaceholders,
  WEEKDAYS,
} from "./automation-rules";
import { companyAutomationDefaults } from "@/lib/mock/automation";

// ---------------------------------------------------------------------------
// Select options

const deliveryOptions = [
  { key: InvoiceDeliveryMode.Auto, label: "Email automatically when issued", value: InvoiceDeliveryMode.Auto },
  { key: InvoiceDeliveryMode.Manual, label: "Staff send from the invoice page", value: InvoiceDeliveryMode.Manual },
];

const frequencyOptions = (Object.entries(frequencyLabels) as [StatementFrequency, string][]).map(
  ([key, label]) => ({ key, label, value: key })
);

const scopeOptions = (Object.entries(scopeLabels) as [StatementScope, string][]).map(
  ([key, label]) => ({ key, label, value: key })
);

const weekdayOptions = WEEKDAYS.map((label, i) => ({
  key: String(i + 1),
  label,
  value: String(i + 1),
}));

// ---------------------------------------------------------------------------
// Form shape

type RuleFormValues = {
  enabled: boolean;
  custom: boolean;
  stepsText: string;
  contactIds: string[];
  notifyTeam: boolean;
  extraEmailsText: string;
  escalateFromDaysText: string;
  deliveryMode: InvoiceDeliveryMode;
  frequency: StatementFrequency;
  weekday: string;
  statementScope: StatementScope;
  thresholdPercent: string;
  subject: string;
  body: string;
};

type FieldValue = string | boolean | string[];

const toForm = (rule: AutomationRule): RuleFormValues => ({
  enabled: rule.enabled,
  custom: rule.custom,
  stepsText: rule.steps.join(", "),
  contactIds: rule.contactIds,
  notifyTeam: rule.notifyTeam,
  extraEmailsText: rule.extraEmails.join(", "),
  escalateFromDaysText: rule.escalateFromDays === null ? "" : String(rule.escalateFromDays),
  deliveryMode: rule.deliveryMode,
  frequency: rule.frequency,
  weekday: String(rule.weekday),
  statementScope: rule.statementScope,
  thresholdPercent: String(rule.thresholdPercent),
  subject: rule.subject,
  body: rule.body,
});

const fromForm = (values: RuleFormValues, rule: AutomationRule): AutomationRule => {
  const parsedSteps = (() => {
    if (!values.stepsText.trim()) return [];
    const parts = values.stepsText.split(",").map((p) => p.trim()).filter(Boolean);
    const nums = parts.map(Number);
    return nums.some(isNaN) ? rule.steps : nums;
  })();
  const parsedEmails = (() => {
    if (!values.extraEmailsText.trim()) return [];
    const result = parseEmails(values.extraEmailsText);
    return "emails" in result ? result.emails : [];
  })();
  return {
    ...rule,
    enabled: values.enabled,
    custom: values.custom,
    steps: parsedSteps,
    contactIds: values.contactIds,
    notifyTeam: values.notifyTeam,
    extraEmails: parsedEmails,
    escalateFromDays:
      values.escalateFromDaysText.trim() === "" ? null : Number(values.escalateFromDaysText),
    deliveryMode: values.deliveryMode,
    frequency: values.frequency,
    weekday: Number(values.weekday),
    statementScope: values.statementScope,
    thresholdPercent: Number(values.thresholdPercent),
    subject: values.subject,
    body: values.body,
  };
};

// ---------------------------------------------------------------------------

export default function AutomationRuleModal({
  rule,
  spec,
  contacts,
  onSave,
  onClose,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  contacts: ContactView[];
  onSave: (updated: AutomationRule) => void;
  onClose: () => void;
}) {
  const defaults = companyAutomationDefaults[rule.kind];
  const isCountDown = rule.kind === AutomationKind.BeforeDue;
  const activeContacts = contacts.filter((c) => c.isActive);

  const { control, handleSubmit, setValue, watch } = useForm<RuleFormValues>({
    defaultValues: toForm(rule),
  });

  const custom = useWatch({ control, name: "custom" });
  const contactIds = watch("contactIds");

  const toggleContact = (id: string) => {
    const next = contactIds.includes(id)
      ? contactIds.filter((c) => c !== id)
      : [...contactIds, id];
    setValue("contactIds", next);
  };

  useEffect(() => {
    if (!custom) {
      setValue("subject", defaults.subject);
      setValue("body", defaults.body);
      setValue("stepsText", defaults.steps.join(", "));
    }
  }, [custom, defaults, setValue]);

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={spec.label}
      confirmText="Save"
      onConfirm={handleSubmit((values) => onSave(fromForm(values, rule)))}
      size="2xl"
    >
      <p className="text-xs text-content-5">{spec.help}</p>

      <BaseSwitch name="enabled" control={control}>
        Enabled
      </BaseSwitch>

      <BaseSwitch name="custom" control={control}>
        <span className="flex flex-col">
          <span>Customise for this party</span>
          <span className="text-xs text-content-5">Off = use the company-wide default.</span>
        </span>
      </BaseSwitch>

      {rule.kind === AutomationKind.InvoiceDelivery && (
        <BaseSelect
          name="deliveryMode"
          control={control}
          label="Delivery mode"
          options={deliveryOptions}
          disallowEmptySelection
          isDisabled={!custom}
        />
      )}

      {rule.kind === AutomationKind.Statement && (
        <>
          <BaseSelect
            name="frequency"
            control={control}
            label="Frequency"
            options={frequencyOptions}
            disallowEmptySelection
            isDisabled={!custom}
          />
          <BaseSelect
            name="weekday"
            control={control}
            label="Day of week"
            options={weekdayOptions}
            disallowEmptySelection
            isDisabled={!custom}
          />
          <BaseSelect
            name="statementScope"
            control={control}
            label="Statement scope"
            options={scopeOptions}
            disallowEmptySelection
            isDisabled={!custom}
          />
        </>
      )}

      {rule.kind === AutomationKind.CreditLimit && (
        <BaseInput
          name="thresholdPercent"
          control={control}
          label="Alert threshold (%)"
          description="Send when the balance reaches this share of the credit limit."
          inputMode="numeric"
          isDisabled={!custom}
          rules={{
            validate: (v: FieldValue) => {
              const n = Number(v);
              return (n >= 1 && n <= 100) || "Enter a number from 1 to 100";
            },
          }}
        />
      )}

      {spec.steps && (
        <BaseInput
          name="stepsText"
          control={control}
          label={`${spec.steps.label} (comma-separated)`}
          description={`Up to ${spec.steps.maxSteps} whole numbers, 0–${spec.steps.max}. E.g. "7, 14"`}
          isDisabled={!custom}
          rules={{
            validate: (v: FieldValue) => {
              if (!custom) return true;
              const result = parseSteps(String(v), spec.steps!, isCountDown);
              return "error" in result ? result.error : true;
            },
          }}
        />
      )}

      {rule.kind === AutomationKind.Overdue && (
        <BaseInput
          name="escalateFromDaysText"
          control={control}
          label="Copy accounts team from (days overdue)"
          description="Leave blank to never copy the team."
          inputMode="numeric"
          isDisabled={!custom}
          rules={{
            validate: (v: FieldValue) => {
              const s = String(v).trim();
              if (!s) return true;
              const n = Number(s);
              return (!isNaN(n) && n >= 0 && n <= 120) || "0–120 days";
            },
          }}
        />
      )}

      {spec.audience === "party" && activeContacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-[#343A40]">Recipients</p>
          <p className="text-xs text-content-5">
            Leave all unchecked to use the contacts flagged for this message type.
          </p>
          <div className="flex flex-col gap-1">
            {activeContacts.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactIds.includes(c.id)}
                  onChange={() => toggleContact(c.id)}
                  disabled={!custom}
                  className="rounded"
                />
                <span>{c.name}</span>
                <span className="text-content-5 text-xs">{c.email}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <BaseSwitch name="notifyTeam" control={control} isDisabled={!custom}>
        Also notify the accounts team
      </BaseSwitch>

      <BaseInput
        name="extraEmailsText"
        control={control}
        label="Extra email addresses"
        description="Comma-separated. Up to 10."
        placeholder="extra@example.com"
        isDisabled={!custom}
        rules={{
          validate: (v: FieldValue) => {
            const s = String(v).trim();
            if (!s) return true;
            const result = parseEmails(s);
            return "error" in result ? result.error : true;
          },
        }}
      />

      <div className="flex flex-col gap-3 border-t border-content-3 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-base-primary-900">Email template</p>
          <span className="text-xs text-content-5">
            Placeholders: {spec.placeholders.map((p) => `{${p}}`).join(", ")}
          </span>
        </div>
        <BaseInput
          name="subject"
          control={control}
          label="Subject"
          isDisabled={!custom}
          rules={{
            validate: (v: FieldValue) => {
              const unknown = unknownPlaceholders(String(v), spec.placeholders);
              return unknown.length === 0 || `Unknown: ${unknown.map((p) => `{${p}}`).join(", ")}`;
            },
          }}
        />
        <BaseTextArea
          name="body"
          control={control}
          label="Body"
          isDisabled={!custom}
          rules={{
            validate: (v: FieldValue) => {
              const unknown = unknownPlaceholders(String(v), spec.placeholders);
              return unknown.length === 0 || `Unknown: ${unknown.map((p) => `{${p}}`).join(", ")}`;
            },
          }}
        />
      </div>
    </FormModal>
  );
}
