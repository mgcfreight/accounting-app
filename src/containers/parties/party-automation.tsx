import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Switch } from "@heroui/react";
import { BaseButton, BaseCardWrapper, FormModal, StatusChip } from "@/components/common";
import { BaseInput, BaseSelect, BaseTextArea } from "@/components/common/form";
import { AutomationKind, PartyType } from "@/lib/enums";
import { AgreementView, AutomationRule, PartyAutomation } from "@/lib/interfaces";
import { torontoToday } from "@/lib/utils";
import {
  AutomationSpec,
  automationSpecs,
  ContactsState,
  describeRule,
  effectiveRule,
  hourText,
  isPaused,
  recipientText,
  seedAutomation,
  unavailableReason,
} from "./automation-rules";
import AutomationRuleModal from "./party-automation-modal";

// ---------------------------------------------------------------------------
// Pause banner + controls

type PauseFormValues = { until: string; reason: string };

const hourOptions = Array.from({ length: 24 }, (_, h) => ({
  key: String(h),
  label: hourText(h),
  value: String(h),
}));

function PauseSection({
  automation,
  canEdit,
  onChange,
}: {
  automation: PartyAutomation;
  canEdit: boolean;
  onChange: (next: Partial<PartyAutomation>) => void;
}) {
  const today = torontoToday();
  const paused = isPaused(automation, today);
  const [editing, setEditing] = useState(false);
  const { control, handleSubmit } = useForm<PauseFormValues>({
    values: { until: automation.pausedUntil ?? "", reason: automation.pauseReason },
  });

  const resume = () => onChange({ paused: false, pausedUntil: null, pauseReason: "" });
  const save = handleSubmit(({ until, reason }) => {
    onChange({ paused: true, pausedUntil: until || null, pauseReason: reason });
    setEditing(false);
  });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Switch
        isSelected={paused}
        isReadOnly={!canEdit}
        onValueChange={(on) => (on ? setEditing(true) : resume())}
        size="sm"
      >
        <span className={paused ? "text-base-danger font-medium" : "text-content-5"}>
          {!paused
            ? "Pause all notifications"
            : automation.pausedUntil === null
              ? "Paused indefinitely"
              : `Paused until ${automation.pausedUntil}`}
        </span>
      </Switch>
      {paused && canEdit && (
        <BaseButton
          varient="light"
          className="h-7 px-2 text-xs"
          text="Edit pause"
          onPress={() => setEditing(true)}
        />
      )}
      {paused && automation.pauseReason && (
        <span className="text-content-5 text-xs">— {automation.pauseReason}</span>
      )}

      {editing && canEdit && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && setEditing(false)}
          title="Pause notifications"
          confirmText="Save"
          onConfirm={save}
          size="sm"
        >
          <p className="text-xs text-content-5">
            No automated messages go out while paused. Leave the date blank to
            pause indefinitely.
          </p>
          <div className="flex flex-col gap-3">
            <BaseInput
              name="until"
              control={control}
              type="date"
              label="Pause until (inclusive)"
              min={today}
            />
            <BaseTextArea
              name="reason"
              control={control}
              label="Reason (optional)"
              minRows={2}
              maxLength={200}
            />
          </div>
        </FormModal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send schedule (hour + skip weekends)

function ScheduleRow({
  automation,
  canEdit,
  onChange,
}: {
  automation: PartyAutomation;
  canEdit: boolean;
  onChange: (next: Partial<PartyAutomation>) => void;
}) {
  const { control } = useForm<{ sendHour: string }>({
    values: { sendHour: String(automation.sendHour) },
  });
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-[#343A40]">
      <BaseSelect
        name="sendHour"
        control={control}
        label="Send at"
        labelPlacement="outside-left"
        options={hourOptions}
        disallowEmptySelection
        isDisabled={!canEdit}
        className="w-auto"
        classNames={{ label: "text-content-5 text-sm", trigger: "min-w-28", value: "text-xs" }}
        rules={{
          // Applies the hour as soon as it is picked; there is no Save here.
          onChange: (e: { target: { value: string } }) =>
            onChange({ sendHour: Number(e.target.value) }),
        }}
      />
      <Switch
        isSelected={automation.skipWeekends}
        isReadOnly={!canEdit}
        onValueChange={(on) => onChange({ skipWeekends: on })}
        size="sm"
      >
        <span className="text-sm">Skip weekends</span>
      </Switch>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One rule row

// As on the Profile contacts lines, so Try again looks the same in both.
const linkButton = "text-base-primary underline text-xs";

function RuleRow({
  rule,
  spec,
  contacts,
  unavailable,
  canEdit,
  onToggle,
  onCustomise,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  contacts: ContactsState;
  // Why the rule can't be switched on, or null when it can.
  unavailable: string | null;
  canEdit: boolean;
  onToggle: () => void;
  onCustomise: () => void;
}) {
  const effective = effectiveRule(rule);
  const description = describeRule(effective, spec);
  // Until the contacts load, a party message's recipients aren't known; saying
  // "the accounts team" alone would read as "no contacts get it".
  const contactsUnknown = spec.audience === "party" && contacts.status !== "success";
  const recipients = recipientText(
    effective,
    spec,
    contacts.status === "success" ? contacts.contacts : []
  );

  return (
    <div className="flex flex-wrap items-start gap-3 py-3 border-b border-content-10 last:border-0">
      <Switch
        isSelected={rule.enabled}
        isDisabled={!!unavailable && !rule.enabled}
        isReadOnly={!canEdit}
        onValueChange={onToggle}
        size="sm"
        className="mt-0.5"
        aria-label={spec.label}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#343A40]">{spec.label}</span>
          {rule.custom && (
            <span className="text-xs bg-base-primary-50 text-base-primary-600 rounded px-1.5 py-0.5">
              Custom
            </span>
          )}
          {spec.audience === "team" && (
            <StatusChip text="Team alert" tone="warning" />
          )}
        </div>
        <p className="text-xs text-content-5 mt-0.5">{spec.help}</p>
        {unavailable && !rule.enabled && (
          <p className="text-xs text-content-5 mt-1">Unavailable: {unavailable}.</p>
        )}
        {rule.enabled && (
          <p className="text-xs text-[#343A40] mt-1">
            {description}
            {contacts.status === "pending" && contactsUnknown ? (
              <span className="text-content-5"> · Loading recipients…</span>
            ) : contacts.status === "error" && contactsUnknown ? (
              <>
                {" · "}
                <span className="text-base-danger">Couldn&apos;t load the recipients.</span>{" "}
                <button type="button" className={linkButton} onClick={contacts.retry}>
                  Try again
                </button>
              </>
            ) : (
              recipients && <span className="text-content-5"> · {recipients}</span>
            )}
          </p>
        )}
      </div>
      {canEdit && (
        <BaseButton
          varient="bordered"
          className="h-7 px-3 text-xs shrink-0"
          text="Customise"
          onPress={onCustomise}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The card

// Seeded once from the agreement in force; mount it with `key` set to that
// agreement's id so a different agreement re-seeds it. Without `canEdit`
// (parties.edit) the settings are shown read-only.
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
  // Local state only — no API yet.
  const [automation, setAutomation] = useState<PartyAutomation>(() =>
    seedAutomation(type, agreement)
  );

  const [editingKind, setEditingKind] = useState<AutomationKind | null>(null);

  // Every change says it wasn't saved, as on the other not-yet-wired screens.
  const demoOnly = (what: string) =>
    toast.info(`${what} — demo only, nothing was saved.`);

  const updateAutomation = (next: Partial<PartyAutomation>) => {
    setAutomation((prev) => ({ ...prev, ...next }));
    if ("paused" in next) {
      demoOnly(next.paused ? "Notifications paused" : "Notifications resumed");
    } else if ("sendHour" in next) {
      demoOnly("Send time");
    } else if ("skipWeekends" in next) {
      demoOnly("Weekend setting");
    }
  };

  // Switching off is always allowed; switching on only when available.
  const toggleRule = (kind: AutomationKind) => {
    const rule = automation.rules.find((r) => r.kind === kind);
    if (!rule || (!rule.enabled && unavailableReason(kind, agreement))) return;
    setAutomation((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.kind === kind ? { ...r, enabled: !r.enabled } : r)),
    }));
    demoOnly(`${automationSpecs[kind].label} ${rule.enabled ? "off" : "on"}`);
  };

  const saveRule = (updated: AutomationRule) => {
    setAutomation((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.kind === updated.kind ? updated : r)),
    }));
    demoOnly(automationSpecs[updated.kind].label);
  };

  const editingRule = editingKind
    ? automation.rules.find((r) => r.kind === editingKind)
    : null;

  return (
    <BaseCardWrapper heading="Notifications & Automation">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-content-5">
          Demo only — settings are not saved yet.
        </p>

        <PauseSection automation={automation} canEdit={canEdit} onChange={updateAutomation} />
        <ScheduleRow automation={automation} canEdit={canEdit} onChange={updateAutomation} />

        <div className="flex flex-col">
          {automation.rules.map((rule) => {
            const spec = automationSpecs[rule.kind];
            return (
              <RuleRow
                key={rule.kind}
                rule={rule}
                spec={spec}
                contacts={contacts}
                unavailable={unavailableReason(rule.kind, agreement)}
                canEdit={canEdit}
                onToggle={() => toggleRule(rule.kind)}
                onCustomise={() => setEditingKind(rule.kind)}
              />
            );
          })}
        </div>
      </div>

      {canEdit && editingRule && editingKind && (
        <AutomationRuleModal
          rule={editingRule}
          spec={automationSpecs[editingKind]}
          contacts={contacts}
          unavailable={unavailableReason(editingKind, agreement)}
          onSave={(updated) => {
            saveRule(updated);
            setEditingKind(null);
          }}
          onClose={() => setEditingKind(null)}
        />
      )}
    </BaseCardWrapper>
  );
}
