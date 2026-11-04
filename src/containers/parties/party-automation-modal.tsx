import { FocusEvent, KeyboardEvent, useRef, useState } from "react";
import { Control, FieldErrors, useController, useForm, useWatch } from "react-hook-form";
import { Input, Radio, RadioGroup, Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { toast } from "sonner";
import { BaseButton, FormModal, Money } from "@/components/common";
import {
  BaseCheckbox,
  BaseInput,
  BaseSelect,
  BaseSwitch,
  BaseTextArea,
} from "@/components/common/form";
import { CREDIT_LIMIT_PATTERN } from "@/lib/constants";
import { toAmount } from "@/lib/money";
import {
  AutomationKind,
  Currency,
  InvoiceDeliveryMode,
  StatementFrequency,
  StatementScope,
} from "@/lib/enums";
import { AutomationRule, AutomationTemplate, ContactView } from "@/lib/interfaces";
import { companyAutomationDefaults } from "@/lib/mock/automation";
import {
  addStep,
  ATTACHABLE,
  AutomationSpec,
  contactFlagLabels,
  ContactsState,
  describeRule,
  fillTemplate,
  frequencyLabels,
  HAS_MIN_BALANCE,
  keepStepTemplates,
  parseEmails,
  recipientText,
  scopeLabels,
  sortSteps,
  stepPresets,
  unknownPlaceholders,
  WEEKDAYS,
} from "./automation-rules";

// Sets up one automated message for a shipper or carrier: the company
// default, or the party's own timing, recipients and wording, across three
// tabs. Demo only — the card keeps the result until the page is left.

const toOptions = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([key, label]) => ({ key, label, value: key }));

// Auto-send stays locked until issue #1 decides whether it's allowed.
const deliveryOptions = [
  { key: InvoiceDeliveryMode.Manual, label: "Staff send it from the invoice page", value: InvoiceDeliveryMode.Manual },
  { key: InvoiceDeliveryMode.Auto, label: "Email automatically when issued (not decided yet)", value: InvoiceDeliveryMode.Auto },
];

const weekdayOptions = WEEKDAYS.map((label, i) => ({
  key: String(i + 1),
  label,
  value: String(i + 1),
}));

type TabKey = "when" | "who" | "message";

// "all" is the rule's own message; "d7" is step 7's. Not a bare number:
// react-hook-form reads a numeric path segment as an array index.
type MessageKey = "all" | `d${number}`;
const stepKey = (day: number): MessageKey => `d${day}`;

type RuleFormValues = {
  enabled: boolean;
  custom: boolean;
  steps: number[];
  recipientMode: "flagged" | "chosen";
  contactIds: string[];
  notifyTeam: boolean;
  extraEmails: string[];
  escalateFromDays: string;
  deliveryMode: InvoiceDeliveryMode;
  frequency: StatementFrequency;
  weekday: string;
  statementScope: StatementScope;
  thresholdPercent: string;
  attachPdf: boolean;
  minBalance: string;
  subject: string;
  body: string;
  stepTemplates: Record<string, AutomationTemplate>;
};

// Every value a field of the form can hold, for the shared validators.
type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | AutomationTemplate
  | Record<string, AutomationTemplate>;

const WHOLE_NUMBER = /^\d+$/;

// The "copy the accounts team" select's "never" choice.
const NEVER = "never";

const toForm = (rule: AutomationRule): RuleFormValues => ({
  enabled: rule.enabled,
  custom: rule.custom,
  steps: rule.steps,
  recipientMode: rule.contactIds.length ? "chosen" : "flagged",
  contactIds: rule.contactIds,
  notifyTeam: rule.notifyTeam,
  extraEmails: rule.extraEmails,
  escalateFromDays: rule.escalateFromDays === null ? NEVER : String(rule.escalateFromDays),
  deliveryMode: rule.deliveryMode,
  frequency: rule.frequency,
  weekday: String(rule.weekday),
  statementScope: rule.statementScope,
  thresholdPercent: String(rule.thresholdPercent),
  attachPdf: rule.attachPdf,
  minBalance: rule.minBalance ?? "",
  subject: rule.subject,
  body: rule.body,
  stepTemplates: Object.fromEntries(
    Object.entries(rule.stepTemplates).map(([day, template]) => [`d${day}`, template])
  ),
});

// Custom values are kept even when "company default" is chosen, so
// switching back restores them; the card shows the default meanwhile.
const fromForm = (values: RuleFormValues, rule: AutomationRule): AutomationRule => {
  const stepTemplates = Object.fromEntries(
    Object.entries(values.stepTemplates).map(([key, template]) => [key.slice(1), template])
  );
  return {
    ...rule,
    enabled: values.enabled,
    custom: values.custom,
    steps: values.steps,
    contactIds: values.recipientMode === "chosen" ? values.contactIds : [],
    notifyTeam: values.notifyTeam,
    extraEmails: values.extraEmails,
    // Only a day that is still a step: the select can't show any other.
    escalateFromDays: values.steps.includes(Number(values.escalateFromDays))
      ? Number(values.escalateFromDays)
      : null,
    deliveryMode: values.deliveryMode,
    frequency: values.frequency,
    weekday: Number(values.weekday),
    statementScope: values.statementScope,
    thresholdPercent: Number(values.thresholdPercent),
    attachPdf: values.attachPdf,
    minBalance: toAmount(values.minBalance.trim()),
    subject: values.subject,
    body: values.body,
    stepTemplates: keepStepTemplates(stepTemplates, values.steps),
  };
};

// Which tab a failed field is on, to open it after a failed save.
const tabOfField = (name: string): TabKey =>
  ["contactIds", "extraEmails"].includes(name)
    ? "who"
    : ["subject", "body", "stepTemplates"].includes(name)
      ? "message"
      : "when";

// "7 days before due", "On the due date", "14 days after delivery".
const stepLabel = (
  day: number,
  countDown: boolean,
  spec: NonNullable<AutomationSpec["steps"]>
) =>
  countDown && day === 0 ? "On the due date" : `${day} day${day === 1 ? "" : "s"} ${spec.unit}`;

// ---------------------------------------------------------------------------
// Steps: chips with a remove button, an "add a day" box, and presets.

function StepEditor({
  control,
  spec,
  kind,
  countDown,
  isDisabled,
}: {
  control: Control<RuleFormValues>;
  spec: NonNullable<AutomationSpec["steps"]>;
  kind: AutomationKind;
  countDown: boolean;
  isDisabled: boolean;
}) {
  const {
    field: { value: steps, onChange },
    fieldState: { error },
  } = useController({
    name: "steps",
    control,
    rules: { validate: (v: FieldValue) => (v as number[]).length > 0 || "Add at least one day" },
  });
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  const add = () => {
    const result = addStep(steps, draft, spec, countDown);
    if ("error" in result) return setDraftError(result.error);
    onChange(result.steps);
    setDraft("");
    setDraftError(null);
  };
  // Enter adds the day rather than submitting the whole form.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };
  const presets = stepPresets[kind] ?? [];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-base-primary">{spec.label}</p>
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {steps.length === 0 && (
          <span className="text-xs text-content-5">No days yet.</span>
        )}
        {steps.map((day) => (
          <span
            key={day}
            className="inline-flex items-center gap-1 rounded-full bg-base-primary-50 text-base-primary-600 text-xs pl-3 pr-1 py-1"
          >
            {stepLabel(day, countDown, spec)}
            {!isDisabled && (
              <button
                type="button"
                className="rounded-full w-5 h-5 leading-none hover:bg-base-primary-100"
                aria-label={`Remove ${day} days`}
                onClick={() => onChange(steps.filter((d) => d !== day))}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!isDisabled && (
        <div className="flex flex-wrap items-start gap-2">
          <Input
            size="sm"
            variant="bordered"
            aria-label={`Add a day (${spec.label.toLowerCase()})`}
            placeholder="Days"
            inputMode="numeric"
            className="w-24"
            value={draft}
            onValueChange={(text) => {
              setDraft(text);
              setDraftError(null);
            }}
            onKeyDown={onKeyDown}
            isInvalid={!!draftError}
            errorMessage={draftError}
          />
          <BaseButton
            varient="bordered"
            className="h-8 px-3 text-xs text-base-primary"
            text="Add"
            isDisabled={!draft.trim() || steps.length >= spec.maxSteps}
            onPress={add}
          />
          {presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
              <span className="text-xs text-content-5">Quick set:</span>
              {presets.map((preset) => (
                <BaseButton
                  key={preset.label}
                  varient="light"
                  className="h-7 px-2 text-xs text-base-primary"
                  text={preset.label}
                  onPress={() => onChange(sortSteps(preset.steps, countDown))}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-content-5">
        Up to {spec.maxSteps} {spec.maxSteps === 1 ? "day" : "days"}, 0–{spec.max}.
      </p>
      {error && <p className="text-xs text-base-danger">{error.message}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extra addresses: typed one at a time, shown as removable chips.

function EmailChips({ control, isDisabled }: { control: Control<RuleFormValues>; isDisabled: boolean }) {
  const {
    field: { value: emails, onChange },
  } = useController({ name: "extraEmails", control });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const result = parseEmails([...emails, draft].join(","));
    if ("error" in result) return setError(result.error);
    onChange(result.emails);
    setDraft("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-base-primary">Other addresses</p>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-content-3 text-content-6 text-xs pl-3 pr-1 py-1 break-all"
            >
              {email}
              {!isDisabled && (
                <button
                  type="button"
                  className="rounded-full w-5 h-5 leading-none hover:bg-content-4"
                  aria-label={`Remove ${email}`}
                  onClick={() => onChange(emails.filter((e) => e !== email))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!isDisabled && (
        <div className="flex items-start gap-2">
          <Input
            size="sm"
            variant="bordered"
            type="email"
            aria-label="Add an email address"
            placeholder="name@example.com"
            className="max-w-72"
            value={draft}
            onValueChange={(text) => {
              setDraft(text);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            isInvalid={!!error}
            errorMessage={error}
          />
          <BaseButton
            varient="bordered"
            className="h-8 px-3 text-xs text-base-primary"
            text="Add"
            isDisabled={!draft.trim()}
            onPress={add}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function AutomationRuleModal({
  rule,
  spec,
  contacts,
  unavailable,
  currency,
  onSave,
  onClose,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  contacts: ContactsState;
  // Why the rule can't be switched on, or null when it can.
  unavailable: string | null;
  // The agreement's currency, for the minimum balance; unset without one.
  currency: Currency | undefined;
  onSave: (updated: AutomationRule) => void;
  onClose: () => void;
}) {
  const defaults = companyAutomationDefaults[rule.kind];
  const countDown =
    rule.kind === AutomationKind.BeforeDue || rule.kind === AutomationKind.CarrierBillDue;
  const activeContacts: ContactView[] =
    contacts.status === "success" ? contacts.contacts.filter((c) => c.isActive) : [];

  const { control, handleSubmit, setValue, getValues, reset } = useForm<RuleFormValues>({
    defaultValues: toForm(rule),
  });
  const [tab, setTab] = useState<TabKey>("when");
  const [messageKey, setMessageKey] = useState<MessageKey>("all");

  const values = useWatch({ control }) as RuleFormValues;
  const custom = values.custom;
  const editable = custom;

  // The last subject or body the cursor was in, and where, so a placeholder
  // button inserts there rather than at the end.
  const cursor = useRef<{ name: string; position: number } | null>(null);
  const rememberCursor = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.name && "selectionStart" in target) {
      cursor.current = { name: target.name, position: target.selectionStart ?? target.value.length };
    }
  };

  // A step that was removed can't stay selected.
  const activeKey: MessageKey =
    messageKey !== "all" && !values.steps.includes(Number(messageKey.slice(1)))
      ? "all"
      : messageKey;
  const subjectName =
    activeKey === "all" ? "subject" : (`stepTemplates.${activeKey}.subject` as const);
  const bodyName = activeKey === "all" ? "body" : (`stepTemplates.${activeKey}.body` as const);
  const stepTemplate = activeKey === "all" ? undefined : values.stepTemplates?.[activeKey];
  const editingOwnMessage = activeKey === "all" || !!stepTemplate;

  const insertPlaceholder = (placeholder: string) => {
    const into =
      cursor.current && [subjectName, bodyName].includes(cursor.current.name as typeof bodyName)
        ? cursor.current
        : { name: bodyName, position: String(getValues(bodyName) ?? "").length };
    const text = String(getValues(into.name as typeof bodyName) ?? "");
    const next = `${text.slice(0, into.position)}{${placeholder}}${text.slice(into.position)}`;
    setValue(into.name as typeof bodyName, next, { shouldDirty: true, shouldValidate: true });
    cursor.current = { name: into.name, position: into.position + placeholder.length + 2 };
  };

  const ownMessageForStep = (key: MessageKey) =>
    setValue(
      "stepTemplates",
      { ...getValues("stepTemplates"), [key]: { subject: getValues("subject"), body: getValues("body") } },
      { shouldDirty: true }
    );
  const dropStepMessage = (key: MessageKey) => {
    const rest = { ...getValues("stepTemplates") };
    delete rest[key];
    setValue("stepTemplates", rest, { shouldDirty: true });
  };

  // Starts the custom fields again from the company default.
  const copyDefault = () => {
    reset({ ...toForm(defaults), enabled: getValues("enabled"), custom: true });
    setMessageKey("all");
    toast.info("Copied the company default. Change what you need, then save.");
  };

  const onInvalid = (errors: FieldErrors<RuleFormValues>) => {
    const first = Object.keys(errors)[0];
    if (first) setTab(tabOfField(first));
  };

  const placeholderRule = (v: FieldValue) => {
    const unknown = unknownPlaceholders(String(v), spec.placeholders);
    return unknown.length === 0 || `Can't fill ${unknown.map((p) => `{${p}}`).join(", ")}`;
  };

  // What's in force if saved now, for the summary line at the top.
  const preview: AutomationRule = custom
    ? fromForm(values, rule)
    : { ...defaults, enabled: values.enabled };
  const recipients = recipientText(preview, spec, activeContacts);
  const hasSteps = !!spec.steps;
  const stepOptions = [
    { key: "all", label: hasSteps && values.steps.length > 1 ? "Every step (main message)" : "Main message", value: "all" },
    ...(hasSteps && spec.steps!.maxSteps > 1
      ? values.steps.map((day) => ({
          key: stepKey(day),
          label: `${stepLabel(day, countDown, spec.steps!)}${values.stepTemplates?.[stepKey(day)] ? " (own message)" : ""}`,
          value: stepKey(day),
        }))
      : []),
  ];

  const shownTemplate: AutomationTemplate = custom
    ? stepTemplate ?? { subject: values.subject, body: values.body }
    : { subject: defaults.subject, body: defaults.body };

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={spec.label}
      confirmText="Save"
      onConfirm={handleSubmit((v) => onSave(fromForm(v, rule)), onInvalid)}
      size="3xl"
      className="xl:max-w-4xl"
    >
      <p className="text-xs text-content-5">
        {spec.help}
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <BaseSwitch name="enabled" control={control} isDisabled={!!unavailable && !rule.enabled}>
          {values.enabled ? "On" : "Off"}
        </BaseSwitch>
        <RadioGroup
          orientation="horizontal"
          size="sm"
          aria-label="Settings to use"
          value={custom ? "custom" : "default"}
          onValueChange={(v) => setValue("custom", v === "custom", { shouldDirty: true })}
        >
          <Radio value="default">Company default</Radio>
          <Radio value="custom">Custom for this party</Radio>
        </RadioGroup>
        {custom && (
          <BaseButton
            varient="light"
            className="h-7 px-2 text-xs text-base-primary sm:ml-auto"
            text="Start from the company default"
            onPress={copyDefault}
          />
        )}
      </div>
      {unavailable && !rule.enabled && (
        <p className="text-xs text-content-5">Can&apos;t be turned on: {unavailable}.</p>
      )}

      {/* What saving would put in force, in one line. */}
      <div className="rounded-lg border border-content-10 bg-content-12 p-3 text-xs text-[#343A40]">
        <strong>{custom ? "This party:" : "Company default:"}</strong>{" "}
        {describeRule(preview, spec)}
        {values.enabled && (
          contacts.status !== "success" && spec.audience === "party" ? (
            <span className="text-content-5"> · recipients not loaded</span>
          ) : recipients ? (
            <span className="text-content-5"> · to {recipients}</span>
          ) : (
            <span className="text-base-danger"> · reaches no one: choose a recipient</span>
          )
        )}
      </div>

      <Tabs
        aria-label="Message settings"
        color="primary"
        variant="underlined"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as TabKey)}
        classNames={{ base: "max-w-full", cursor: "bg-base-primary" }}
      >
        <Tab key="when" title="When" />
        <Tab key="who" title="Who" />
        <Tab key="message" title="Message" />
      </Tabs>

      {/* The panels stay mounted (hidden) so every field's rules run on save. */}
      <div className={tab === "when" ? "flex flex-col gap-4" : "hidden"}>
        {!custom && (
          <p className="text-xs text-content-5">
            Uses the company default. Choose &quot;Custom for this party&quot; to change it.
          </p>
        )}
        {rule.kind === AutomationKind.InvoiceDelivery && (
          <BaseSelect
            name="deliveryMode"
            control={control}
            label="How invoices are sent"
            options={deliveryOptions}
            disallowEmptySelection
            disabledKeys={[InvoiceDeliveryMode.Auto]}
            description="Auto-send is still an open decision (issue #1)."
            isDisabled={!editable}
          />
        )}
        {rule.kind === AutomationKind.Statement && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BaseSelect
              name="frequency"
              control={control}
              label="How often"
              options={toOptions(frequencyLabels)}
              disallowEmptySelection
              isDisabled={!editable}
            />
            {values.frequency !== StatementFrequency.MonthEnd && (
              <BaseSelect
                name="weekday"
                control={control}
                label="On"
                options={weekdayOptions}
                disallowEmptySelection
                isDisabled={!editable}
              />
            )}
            <BaseSelect
              name="statementScope"
              control={control}
              label="What it lists"
              options={toOptions(scopeLabels)}
              disallowEmptySelection
              isDisabled={!editable}
            />
          </div>
        )}
        {rule.kind === AutomationKind.CreditLimit && (
          <BaseInput
            name="thresholdPercent"
            control={control}
            label="Alert at (% of the credit limit)"
            inputMode="numeric"
            endContent={<span className="text-xs text-content-5">%</span>}
            className="max-w-56"
            isDisabled={!editable}
            rules={{
              validate: (v: FieldValue) => {
                const s = String(v).trim();
                return (
                  !getValues("custom") ||
                  (WHOLE_NUMBER.test(s) && Number(s) >= 1 && Number(s) <= 100) ||
                  "A whole number from 1 to 100"
                );
              },
            }}
          />
        )}
        {spec.steps && (
          <StepEditor
            control={control}
            spec={spec.steps}
            kind={rule.kind}
            countDown={countDown}
            isDisabled={!editable}
          />
        )}
        {rule.kind === AutomationKind.Overdue && (
          <BaseSelect
            name="escalateFromDays"
            control={control}
            label="Copy the accounts team"
            options={[
              { key: NEVER, label: "Never", value: NEVER },
              ...values.steps.map((day) => ({
                key: String(day),
                label: `From ${day} day${day === 1 ? "" : "s"} overdue`,
                value: String(day),
              })),
            ]}
            className="max-w-64"
            disallowEmptySelection
            isDisabled={!editable}
          />
        )}
        {HAS_MIN_BALANCE.has(rule.kind) && currency && (
          <BaseInput
            name="minBalance"
            control={control}
            label="Skip balances under"
            placeholder="Remind for any balance"
            inputMode="decimal"
            className="max-w-64"
            endContent={<span className="text-xs text-content-5">{currency}</span>}
            description={
              values.minBalance?.trim() && CREDIT_LIMIT_PATTERN.test(values.minBalance.trim()) ? (
                <>
                  No reminder while less than{" "}
                  <Money amount={toAmount(values.minBalance.trim())} currency={currency} /> is owed.
                </>
              ) : (
                "Leave empty to remind about any unpaid balance."
              )
            }
            isDisabled={!editable}
            rules={{
              validate: (v: FieldValue) => {
                const s = String(v).trim();
                return (
                  !getValues("custom") ||
                  s === "" ||
                  CREDIT_LIMIT_PATTERN.test(s) ||
                  "An amount of 0 or more, up to 2 decimals"
                );
              },
            }}
          />
        )}
        {ATTACHABLE.has(rule.kind) && (
          <BaseSwitch name="attachPdf" control={control} isDisabled={!editable}>
            {rule.kind === AutomationKind.Statement ? "Attach the statement PDF" : "Attach the invoice PDF"}
          </BaseSwitch>
        )}
        {!spec.steps &&
          !ATTACHABLE.has(rule.kind) &&
          rule.kind !== AutomationKind.CreditLimit && (
            <p className="text-xs text-content-5">Sent when it happens; there is no timing to set.</p>
          )}
      </div>

      <div className={tab === "who" ? "flex flex-col gap-4" : "hidden"}>
        {spec.audience === "party" &&
          (contacts.status === "pending" ? (
            <p className="text-sm text-content-5">Loading the contacts…</p>
          ) : contacts.status === "error" ? (
            <p className="text-sm">
              <span className="text-base-danger">Couldn&apos;t load the contacts.</span>{" "}
              <button type="button" className="text-base-primary underline text-sm" onClick={contacts.retry}>
                Try again
              </button>
            </p>
          ) : (
            <ContactPicker
              control={control}
              spec={spec}
              contacts={activeContacts}
              isDisabled={!editable}
            />
          ))}
        <BaseSwitch name="notifyTeam" control={control} isDisabled={!editable}>
          <span className="flex flex-col">
            <span>{spec.audience === "team" ? "Send to the accounts team inbox" : "Copy the accounts team"}</span>
            <span className="text-xs text-content-5">
              The accounts notification email in Settings → Company.
            </span>
          </span>
        </BaseSwitch>
        <EmailChips control={control} isDisabled={!editable} />
      </div>

      <div className={tab === "message" ? "flex flex-col gap-4" : "hidden"}>
        {custom && stepOptions.length > 1 && (
          <div className="flex flex-wrap items-end gap-3">
            <MessagePicker
              value={activeKey}
              options={stepOptions}
              onChange={(key: string) => {
                cursor.current = null;
                setMessageKey(key as MessageKey);
              }}
            />
            {activeKey !== "all" &&
              (stepTemplate ? (
                <BaseButton
                  varient="light"
                  className="h-8 px-2 text-xs text-base-primary"
                  text="Use the main message for this step"
                  onPress={() => dropStepMessage(activeKey)}
                />
              ) : (
                <BaseButton
                  varient="bordered"
                  className="h-8 px-3 text-xs text-base-primary"
                  text="Write a different message for this step"
                  onPress={() => ownMessageForStep(activeKey)}
                />
              ))}
          </div>
        )}

        {custom && editingOwnMessage ? (
          <div className="flex flex-col gap-3" onBlur={rememberCursor}>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-content-5 mr-1">Insert:</span>
              {spec.placeholders.map((placeholder) => (
                <button
                  key={placeholder}
                  type="button"
                  className="rounded-md border border-content-4 px-2 py-0.5 text-xs text-base-primary hover:bg-base-primary-50"
                  // Keep the cursor where it was in the field.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertPlaceholder(placeholder)}
                >
                  {`{${placeholder}}`}
                </button>
              ))}
            </div>
            <BaseInput
              key={subjectName}
              name={subjectName}
              control={control}
              label="Subject"
              rules={{
                validate: (v: FieldValue) =>
                  !getValues("custom") ||
                  (String(v).trim() !== "" ? placeholderRule(v) : "Enter a subject"),
                maxLength: { value: 200, message: "At most 200 characters" },
              }}
            />
            <BaseTextArea
              key={bodyName}
              name={bodyName}
              control={control}
              label="Message"
              minRows={6}
              rules={{
                validate: (v: FieldValue) =>
                  !getValues("custom") ||
                  (String(v).trim() !== "" ? placeholderRule(v) : "Enter a message"),
                maxLength: { value: 5000, message: "At most 5,000 characters" },
              }}
            />
          </div>
        ) : custom ? (
          <p className="text-xs text-content-5">
            This step sends the main message, shown below.
          </p>
        ) : (
          <p className="text-xs text-content-5">
            Uses the company&apos;s wording. Choose &quot;Custom for this party&quot; to write your own.
          </p>
        )}

        <section aria-label="Preview" className="rounded-lg border border-content-10 p-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#343A40]">Preview, with example values</p>
            <BaseButton
              varient="light"
              className="h-7 px-2 text-xs text-base-primary"
              text="Send me a test"
              onPress={() => toast.success("Test email sent.")}
            />
          </div>
          <p className="text-sm font-medium text-[#343A40] wrap-break-word">
            {fillTemplate(shownTemplate.subject)}
          </p>
          <p className="text-sm text-[#343A40] whitespace-pre-wrap wrap-break-word">
            {fillTemplate(shownTemplate.body)}
          </p>
          <p className="text-xs text-content-5">
            Amounts in brackets are filled in from the invoice when it&apos;s sent.
          </p>
        </section>
      </div>
    </FormModal>
  );
}

// The contacts a party message goes to: those flagged for this kind on the
// contact, or a chosen few.
function ContactPicker({
  control,
  spec,
  contacts,
  isDisabled,
}: {
  control: Control<RuleFormValues>;
  spec: AutomationSpec;
  contacts: ContactView[];
  isDisabled: boolean;
}) {
  const {
    field: { value: mode, onChange: setMode },
  } = useController({ name: "recipientMode", control });
  const {
    field: { value: ids, onChange: setIds },
    fieldState: { error },
  } = useController({
    name: "contactIds",
    control,
    rules: {
      validate: (v: FieldValue, all: RuleFormValues) =>
        !all.custom || all.recipientMode !== "chosen" || (v as string[]).length > 0 || "Pick at least one contact",
    },
  });
  const flag = spec.contactFlag;
  const flagged = flag ? contacts.filter((c) => c[flag]) : [];

  if (contacts.length === 0) {
    return (
      <p className="text-sm text-content-5">
        This party has no active contacts. Add one from Profile, or send to the team or other addresses below.
      </p>
    );
  }

  return (
    <RadioGroup
      size="sm"
      label="Contacts"
      value={mode}
      onValueChange={setMode}
      isDisabled={isDisabled}
      classNames={{ label: "text-xs text-base-primary" }}
    >
      <Radio value="flagged" description={
        flagged.length
          ? flagged.map((c) => c.email).join(", ")
          : `No contact is set to receive ${flag ? contactFlagLabels[flag] : "this"}.`
      }>
        Contacts set to receive {flag ? contactFlagLabels[flag] : "this"}
      </Radio>
      <Radio value="chosen">Choose contacts</Radio>
      {mode === "chosen" && (
        <div className="flex flex-col gap-1 pl-7">
          {contacts.map((contact) => (
            <BaseCheckbox
              key={contact.id}
              isSelected={ids.includes(contact.id)}
              isDisabled={isDisabled}
              onValueChange={(on) =>
                setIds(on ? [...ids, contact.id] : ids.filter((id) => id !== contact.id))
              }
            >
              <span className="text-sm">{contact.name}</span>{" "}
              <span className="text-content-5 text-xs break-all">{contact.email}</span>
            </BaseCheckbox>
          ))}
          {error && <p className="text-xs text-base-danger">{error.message}</p>}
        </div>
      )}
    </RadioGroup>
  );
}

// Which message is being edited: the main one or a step's. Not a form
// field, so a plain HeroUI Select styled like BaseSelect.
function MessagePicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  return (
    <Select
      variant="bordered"
      label="Edit the message for"
      className="w-full sm:w-72"
      classNames={{ label: "text-base-primary text-xs", value: "text-xs" }}
      selectedKeys={[value]}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const [key] = Array.from(keys);
        if (key !== undefined) onChange(String(key));
      }}
    >
      {options.map((option) => (
        <SelectItem key={option.key}>{option.label}</SelectItem>
      ))}
    </Select>
  );
}
