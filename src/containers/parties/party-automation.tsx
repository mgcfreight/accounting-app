import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Switch } from "@heroui/react";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  FormModal,
  Money,
  StatusChip,
} from "@/components/common";
import { BaseInput, BaseSelect, BaseSwitch, BaseTextArea } from "@/components/common/form";
import { AutomationKind, PartyType } from "@/lib/enums";
import { AgreementView, AutomationRule, PartyAutomation } from "@/lib/interfaces";
import { companyAutomationDefaults } from "@/lib/mock/automation";
import { addDays, formatDate, torontoToday } from "@/lib/utils";
import {
  ATTACHABLE,
  AutomationSpec,
  automationSpecs,
  ContactsState,
  describeRule,
  effectiveRule,
  HAS_MIN_BALANCE,
  hourText,
  isPaused,
  reachesNobody,
  recipientText,
  reminderTimeline,
  seedAutomation,
  timelineLabel,
  unavailableReason,
} from "./automation-rules";
import AutomationRuleModal from "./party-automation-modal";

// A shipper's or carrier's automated messages: what goes out, when, to
// whom, and in what words. Demo only — kept in page state until the page is
// left; no API stores these yet. The on/off of the messages the agreement has
// a switch for starts from the agreement in force.

const confirmSaved = (what: string) => toast.success(`${what}.`);

const hourOptions = Array.from({ length: 24 }, (_, h) => ({
  key: String(h),
  label: hourText(h),
  value: String(h),
}));

// ---------------------------------------------------------------------------
// Pause

type PauseValues = { until: string; reason: string };

const pausePresets = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

function PauseModal({
  automation,
  onSave,
  onClose,
}: {
  automation: PartyAutomation;
  onSave: (values: PauseValues) => void;
  onClose: () => void;
}) {
  const today = torontoToday();
  const { control, handleSubmit, setValue } = useForm<PauseValues>({
    defaultValues: { until: automation.pausedUntil ?? "", reason: automation.pauseReason },
  });
  const until = useWatch({ control, name: "until" });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Pause All Messages"
      confirmText="Pause"
      onConfirm={handleSubmit(onSave)}
      size="lg"
    >
      <p className="text-xs text-content-5">
        Nothing automated goes to this party or about it while paused. Messages
        that fall due in the pause are skipped, not sent late.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-content-5">Pause for:</span>
        {pausePresets.map((preset) => (
          <BaseButton
            key={preset.label}
            varient="bordered"
            className="h-7 px-3 text-xs text-base-primary"
            text={preset.label}
            onPress={() =>
              setValue("until", addDays(today, preset.days), { shouldValidate: true })
            }
          />
        ))}
        <BaseButton
          varient="bordered"
          className="h-7 px-3 text-xs text-base-primary"
          text="Until I resume"
          onPress={() => setValue("until", "", { shouldValidate: true })}
        />
      </div>
      <BaseInput
        name="until"
        control={control}
        type="date"
        label="Paused through (inclusive)"
        min={today}
        description={until ? `Messages start again on ${formatDate(addDays(until, 1))}.` : "No end date: paused until someone resumes it."}
        rules={{
          validate: (value: string) =>
            value === "" || value >= today || "Choose today or a later date",
        }}
      />
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason"
        placeholder="e.g. Payment plan agreed by phone, 4 Nov"
        minRows={2}
        rules={{
          required: "Say why it's paused",
          maxLength: { value: 255, message: "At most 255 characters" },
        }}
      />
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Send time

type ScheduleValues = { sendHour: string; skipWeekends: boolean };

function ScheduleModal({
  automation,
  onSave,
  onClose,
}: {
  automation: PartyAutomation;
  onSave: (values: ScheduleValues) => void;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm<ScheduleValues>({
    defaultValues: { sendHour: String(automation.sendHour), skipWeekends: automation.skipWeekends },
  });
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Send Time"
      confirmText="Save"
      onConfirm={handleSubmit(onSave)}
      size="md"
    >
      <p className="text-xs text-content-5">
        When this party&apos;s scheduled messages go out. Alerts about something
        that just happened, like a payment, go out straight away.
      </p>
      <BaseSelect
        name="sendHour"
        control={control}
        label="Send at (Toronto time)"
        options={hourOptions}
        disallowEmptySelection
      />
      <BaseSwitch name="skipWeekends" control={control}>
        <span className="flex flex-col">
          <span>Weekdays only</span>
          <span className="text-xs text-content-5">
            A message due on a Saturday or Sunday goes out the Monday after.
          </span>
        </span>
      </BaseSwitch>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Timeline: every reminder step around the due date, at a glance.

function ReminderTimeline({ rules, isShipper }: { rules: AutomationRule[]; isShipper: boolean }) {
  const points = reminderTimeline(rules);
  if (points.length === 0) return null;
  const hasDue = points.some((p) => p.offset === 0);
  const items = hasDue
    ? points
    : [...points, { offset: 0, kind: null, teamCopied: false }].sort((a, b) => a.offset - b.offset);

  return (
    <section aria-label="Reminder timeline" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-[#343A40]">
        {isShipper ? "What the shipper hears, around each due date" : "Alerts around each carrier bill's due date"}
      </h3>
      <ol className="flex flex-wrap items-start gap-y-3">
        {items.map((point, index) => {
          // The due date's own marker, added when no step falls on it.
          const isDue = point.kind === null;
          const before = point.offset < 0;
          const dot = isDue
            ? "bg-[#343A40]"
            : before
              ? "bg-base-primary-500"
              : "bg-base-danger";
          return (
            <li key={`${point.kind}-${point.offset}`} className="flex items-start">
              {index > 0 && <span aria-hidden className="mt-1.5 h-0.5 w-6 sm:w-10 bg-content-4" />}
              <span className="flex flex-col items-center gap-1 min-w-20 text-center">
                <span aria-hidden className={`h-3.5 w-3.5 rounded-full ${dot}`} />
                <span className="text-xs text-[#343A40]">
                  {isDue ? "Due date" : timelineLabel(point.offset)}
                </span>
                {!isDue && point.kind && (
                  <span className="text-[11px] text-content-5">
                    {automationSpecs[point.kind].audience === "team" ? "Team alert" : "Email"}
                    {point.teamCopied && automationSpecs[point.kind].audience === "party" ? " + team" : ""}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// One message

const linkButton = "text-base-primary underline text-xs";

function RuleRow({
  rule,
  spec,
  contacts,
  unavailable,
  currency,
  canEdit,
  onToggle,
  onEdit,
  onReset,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  contacts: ContactsState;
  unavailable: string | null;
  currency: AgreementView["currency"] | undefined;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const effective = effectiveRule(rule);
  const loaded = contacts.status === "success" ? contacts.contacts : [];
  const contactsKnown = spec.audience === "team" || contacts.status === "success";
  const recipients = recipientText(effective, spec, loaded);
  const nobody = contactsKnown && reachesNobody(effective, spec, loaded);
  const ownMessages = effective.custom ? Object.keys(effective.stepTemplates).length : 0;

  return (
    <li className="flex flex-wrap sm:flex-nowrap items-start gap-3 py-3 border-b border-content-10 last:border-0">
      <Switch
        isSelected={rule.enabled}
        isDisabled={!!unavailable && !rule.enabled}
        isReadOnly={!canEdit}
        onValueChange={onToggle}
        size="sm"
        className="mt-0.5"
        aria-label={`${spec.label}: ${rule.enabled ? "on" : "off"}`}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${rule.enabled ? "text-[#343A40]" : "text-content-5"}`}>
            {spec.label}
          </span>
          {rule.custom ? (
            <StatusChip text="Custom" tone="secondary" />
          ) : (
            <StatusChip text="Company default" tone="neutral" />
          )}
        </div>
        {!rule.enabled ? (
          <p className="text-xs text-content-5">
            {unavailable ? `Can't be turned on: ${unavailable}.` : `Off. ${spec.help}`}
          </p>
        ) : (
          <>
            <p className="text-xs text-[#343A40]">{describeRule(effective, spec)}</p>
            <p className="text-xs text-content-5 break-all">
              {!contactsKnown ? (
                contacts.status === "pending" ? (
                  "Loading recipients…"
                ) : (
                  <>
                    <span className="text-base-danger">Couldn&apos;t load the recipients.</span>{" "}
                    {contacts.status === "error" && (
                      <button type="button" className={linkButton} onClick={contacts.retry}>
                        Try again
                      </button>
                    )}
                  </>
                )
              ) : nobody ? (
                <span className="text-base-danger">
                  Reaches no one: no contact is set to receive it. Edit to choose recipients.
                </span>
              ) : (
                <>To {recipients}</>
              )}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-content-5">
              {ATTACHABLE.has(rule.kind) && <span>{effective.attachPdf ? "PDF attached" : "No attachment"}</span>}
              {HAS_MIN_BALANCE.has(rule.kind) && effective.minBalance && currency && (
                <span>
                  Skips balances under <Money amount={effective.minBalance} currency={currency} />
                </span>
              )}
              {ownMessages > 0 && (
                <span>
                  {ownMessages} step{ownMessages === 1 ? " has its" : "s have their"} own message
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {canEdit && (
        <div className="flex gap-1 shrink-0 ml-auto">
          {rule.custom && (
            <BaseButton
              varient="light"
              className="h-8 px-2 text-xs text-base-primary"
              text="Reset"
              aria-label={`Reset ${spec.label} to the company default`}
              onPress={onReset}
            />
          )}
          <BaseButton
            varient="bordered"
            className="h-8 px-3 text-xs text-base-primary"
            text="Edit"
            aria-label={`Edit ${spec.label}`}
            onPress={onEdit}
          />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// The card

type OpenModal = { modal: "rule"; kind: AutomationKind } | { modal: "pause" | "schedule" | "resetAll" };

// Seeded once from the agreement in force; mount it with `key` set to that
// agreement's id so a different agreement re-seeds it. Without `canEdit`
// (parties.edit) everything is read-only.
export default function PartyAutomationCard({
  type,
  agreement,
  contacts,
  canEdit,
}: {
  type: PartyType;
  agreement: AgreementView | undefined;
  contacts: ContactsState;
  canEdit: boolean;
}) {
  const [automation, setAutomation] = useState<PartyAutomation>(() =>
    seedAutomation(type, agreement)
  );
  const [open, setOpen] = useState<OpenModal | null>(null);
  const close = () => setOpen(null);
  const isShipper = type === PartyType.Shipper;
  const today = torontoToday();
  const paused = isPaused(automation, today);

  const setRule = (kind: AutomationKind, change: (rule: AutomationRule) => AutomationRule) =>
    setAutomation((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.kind === kind ? change(r) : r)),
    }));

  // Switching off is always allowed; switching on only when available.
  const toggleRule = (rule: AutomationRule) => {
    if (!rule.enabled && unavailableReason(rule.kind, agreement)) return;
    setRule(rule.kind, (r) => ({ ...r, enabled: !r.enabled }));
    confirmSaved(`${automationSpecs[rule.kind].label} turned ${rule.enabled ? "off" : "on"}`);
  };

  const resetRule = (kind: AutomationKind) => {
    setRule(kind, (r) => ({ ...companyAutomationDefaults[kind], enabled: r.enabled }));
    confirmSaved(`${automationSpecs[kind].label} reset to the company default`);
  };

  const customCount = automation.rules.filter((r) => r.custom).length;
  const onCount = automation.rules.filter((r) => r.enabled).length;
  const partyRules = automation.rules.filter((r) => automationSpecs[r.kind].audience === "party");
  const teamRules = automation.rules.filter((r) => automationSpecs[r.kind].audience === "team");
  const editingRule =
    open?.modal === "rule" ? automation.rules.find((r) => r.kind === open.kind) : undefined;

  const renderRows = (rules: AutomationRule[]) => (
    <ul className="flex flex-col">
      {rules.map((rule) => (
        <RuleRow
          key={rule.kind}
          rule={rule}
          spec={automationSpecs[rule.kind]}
          contacts={contacts}
          unavailable={unavailableReason(rule.kind, agreement)}
          currency={agreement?.currency}
          canEdit={canEdit}
          onToggle={() => toggleRule(rule)}
          onEdit={() => setOpen({ modal: "rule", kind: rule.kind })}
          onReset={() => resetRule(rule.kind)}
        />
      ))}
    </ul>
  );

  return (
    <BaseCardWrapper
      heading="Notifications & Automation"
      action={
        canEdit &&
        customCount > 0 && (
          <BaseButton
            varient="bordered"
            className="h-8 px-3 text-xs text-base-primary"
            text="Reset all to defaults"
            onPress={() => setOpen({ modal: "resetAll" })}
          />
        )
      }
    >
      <div className="flex flex-col gap-4">
        {paused && (
          <AlertBanner
            message={
              <>
                All messages are paused
                {automation.pausedUntil ? ` through ${formatDate(automation.pausedUntil)}` : " until someone resumes them"}
                {automation.pauseReason && `: ${automation.pauseReason}`}
              </>
            }
            action={
              canEdit && (
                <div className="flex gap-2">
                  <BaseButton
                    varient="bordered"
                    className="h-8 px-3 text-xs text-base-primary bg-white"
                    text="Change"
                    onPress={() => setOpen({ modal: "pause" })}
                  />
                  <BaseButton
                    className="h-8 px-3 text-xs"
                    text="Resume now"
                    onPress={() => {
                      setAutomation((prev) => ({ ...prev, paused: false, pausedUntil: null, pauseReason: "" }));
                      confirmSaved("Messages resumed");
                    }}
                  />
                </div>
              )
            }
          />
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-content-10 bg-content-12 p-3 text-xs text-[#343A40]">
          <span>
            <strong>{onCount}</strong> of {automation.rules.length} messages on
          </span>
          <span>
            <strong>{customCount}</strong> customised
          </span>
          <span>
            Sends at {hourText(automation.sendHour)} Toronto
            {automation.skipWeekends ? ", weekdays only" : ", every day"}
          </span>
          {canEdit && (
            <span className="flex gap-2 sm:ml-auto">
              <BaseButton
                varient="light"
                className="h-7 px-2 text-xs text-base-primary"
                text="Send time"
                onPress={() => setOpen({ modal: "schedule" })}
              />
              {!paused && (
                <BaseButton
                  varient="bordered"
                  className="h-7 px-3 text-xs text-base-primary"
                  text="Pause all"
                  onPress={() => setOpen({ modal: "pause" })}
                />
              )}
            </span>
          )}
        </div>

        <div className={paused ? "opacity-60" : undefined}>
          <ReminderTimeline rules={automation.rules.map(effectiveRule)} isShipper={isShipper} />
        </div>

        <section aria-label={isShipper ? "Sent to the shipper" : "Sent to the carrier"} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[#343A40]">
            {isShipper ? "Sent to the shipper" : "Sent to the carrier"}
          </h3>
          {renderRows(partyRules)}
        </section>
        <section aria-label="Alerts to MGC's accounts team" className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[#343A40]">Alerts to MGC&apos;s accounts team</h3>
          {renderRows(teamRules)}
        </section>
      </div>

      {canEdit && editingRule && (
        <AutomationRuleModal
          rule={editingRule}
          spec={automationSpecs[editingRule.kind]}
          contacts={contacts}
          unavailable={unavailableReason(editingRule.kind, agreement)}
          currency={agreement?.currency}
          onSave={(updated) => {
            setRule(updated.kind, () => updated);
            confirmSaved(`${automationSpecs[updated.kind].label} saved`);
            close();
          }}
          onClose={close}
        />
      )}
      {canEdit && open?.modal === "pause" && (
        <PauseModal
          automation={automation}
          onSave={({ until, reason }) => {
            setAutomation((prev) => ({
              ...prev,
              paused: true,
              pausedUntil: until || null,
              pauseReason: reason.trim(),
            }));
            confirmSaved("Messages paused");
            close();
          }}
          onClose={close}
        />
      )}
      {canEdit && open?.modal === "schedule" && (
        <ScheduleModal
          automation={automation}
          onSave={({ sendHour, skipWeekends }) => {
            setAutomation((prev) => ({ ...prev, sendHour: Number(sendHour), skipWeekends }));
            confirmSaved("Send time saved");
            close();
          }}
          onClose={close}
        />
      )}
      {canEdit && open?.modal === "resetAll" && (
        <FormModal
          isOpen
          onOpenChange={(isOpen) => !isOpen && close()}
          title="Reset All to Defaults"
          confirmText="Reset all"
          confirmColor="danger"
          onConfirm={() => {
            setAutomation((prev) => ({
              ...prev,
              rules: prev.rules.map((r) => ({ ...companyAutomationDefaults[r.kind], enabled: r.enabled })),
            }));
            confirmSaved("All messages reset to the company defaults");
            close();
          }}
        >
          <p className="text-sm">
            {customCount} customised message{customCount === 1 ? "" : "s"} will go back to the
            company default, losing their timing, recipients and wording. Which
            messages are on stays as it is.
          </p>
        </FormModal>
      )}
    </BaseCardWrapper>
  );
}
