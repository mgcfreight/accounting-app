import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CheckboxGroup } from "@heroui/react";
import { AlertBanner, FormModal } from "@/components/common";
import {
  BaseCheckbox,
  BaseInput,
  BaseSelect,
  BaseSwitch,
  BaseTextArea,
} from "@/components/common/form";
import {
  AutomationKind,
  InvoiceDeliveryMode,
  StatementFrequency,
  StatementScope,
} from "@/lib/enums";
import { AutomationRule } from "@/lib/interfaces";
import { errorMessage } from "@/services";
import {
  AutomationSpec,
  ContactsState,
  frequencyLabels,
  parseEmails,
  parseSteps,
  scopeLabels,
  unknownPlaceholders,
  WEEKDAYS,
} from "./automation-rules";

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

const WHOLE_NUMBER = /^\d+$/;

const fromForm = (
  values: RuleFormValues,
  rule: AutomationRule,
  spec: AutomationSpec
): AutomationRule => {
  // The steps field is validated with parseSteps before submit, so this only
  // keeps the old steps for kinds that have none.
  const parsedSteps = (() => {
    if (!spec.steps) return rule.steps;
    const result = parseSteps(
      values.stepsText,
      spec.steps,
      rule.kind === AutomationKind.BeforeDue
    );
    return "steps" in result ? result.steps : rule.steps;
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
  defaults,
  contacts,
  unavailable,
  onSave,
  onClose,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  // The company default for this message (its days from Settings).
  defaults: AutomationRule;
  contacts: ContactsState;
  // Why the rule can't be switched on, or null when it can.
  unavailable: string | null;
  // Resolves once saved. On failure the modal stays open with what was
  // typed, and says why.
  onSave: (updated: AutomationRule) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isCountDown = rule.kind === AutomationKind.BeforeDue;
  const activeContacts =
    contacts.status === "success" ? contacts.contacts.filter((c) => c.isActive) : [];

  const { control, handleSubmit, setValue } = useForm<RuleFormValues>({
    defaultValues: toForm(rule),
  });

  const custom = useWatch({ control, name: "custom" });
  const contactIds = useWatch({ control, name: "contactIds" });

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
      onConfirm={handleSubmit(async (values) => {
        setSaving(true);
        setSaveError(null);
        try {
          await onSave(fromForm(values, rule, spec));
        } catch (error) {
          setSaveError(errorMessage(error));
        } finally {
          setSaving(false);
        }
      })}
      isConfirming={saving}
      size="2xl"
    >
      {saveError && (
        <AlertBanner message={`Not saved: ${saveError} Your changes are still here.`} />
      )}
      <p className="text-xs text-content-5">{spec.help}</p>

      <BaseSwitch
        name="enabled"
        control={control}
        isDisabled={!!unavailable && !rule.enabled}
      >
        <span className="flex flex-col">
          <span>Enabled</span>
          {unavailable && !rule.enabled && (
            <span className="text-xs text-content-5">Unavailable: {unavailable}.</span>
          )}
        </span>
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
              const s = String(v).trim();
              const n = Number(s);
              return (
                (WHOLE_NUMBER.test(s) && n >= 1 && n <= 100) ||
                "Enter a whole number from 1 to 100"
              );
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
              return (
                (WHOLE_NUMBER.test(s) && Number(s) <= 120) || "Whole days from 0 to 120"
              );
            },
          }}
        />
      )}

      {spec.audience === "party" && contacts.status !== "success" && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-[#343A40]">Recipients</p>
          {contacts.status === "pending" ? (
            <p className="text-sm text-content-5">Loading the contacts…</p>
          ) : (
            <p className="text-sm">
              <span className="text-base-danger">Couldn&apos;t load the contacts.</span>{" "}
              <button
                type="button"
                className="text-base-primary underline text-sm"
                onClick={contacts.retry}
              >
                Try again
              </button>
            </p>
          )}
        </div>
      )}

      {spec.audience === "party" && activeContacts.length > 0 && (
        <CheckboxGroup
          label="Recipients"
          description="Leave all unchecked to use the contacts flagged for this message type."
          size="sm"
          value={contactIds}
          onValueChange={(ids) => setValue("contactIds", ids)}
          isDisabled={!custom}
          classNames={{ label: "text-sm font-medium text-[#343A40]", wrapper: "gap-1" }}
        >
          {activeContacts.map((c) => (
            <BaseCheckbox key={c.id} value={c.id}>
              <span className="text-sm">{c.name}</span>{" "}
              <span className="text-content-5 text-xs">{c.email}</span>
            </BaseCheckbox>
          ))}
        </CheckboxGroup>
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
