import { useState } from "react";
import { Switch } from "@heroui/react";
import { BaseButton, BaseCardWrapper, FormModal, StatusChip } from "@/components/common";
import { AutomationKind, InvoiceDeliveryMode, PartyType, StatementFrequency, StatementScope } from "@/lib/enums";
import { AutomationRule, ContactView, PartyAutomation } from "@/lib/interfaces";
import { torontoToday } from "@/lib/utils";
import {
  AutomationSpec,
  automationKinds,
  automationSpecs,
  describeRule,
  effectiveRule,
  hourText,
  isPaused,
  recipientText,
} from "./automation-rules";
import AutomationRuleModal from "./party-automation-modal";

// ---------------------------------------------------------------------------
// Pause banner + controls

function PauseSection({
  automation,
  onChange,
}: {
  automation: PartyAutomation;
  onChange: (next: Partial<PartyAutomation>) => void;
}) {
  const today = torontoToday();
  const paused = isPaused(automation, today);
  const [editing, setEditing] = useState(false);
  const [until, setUntil] = useState(automation.pausedUntil ?? "");
  const [reason, setReason] = useState(automation.pauseReason);

  const resume = () => onChange({ pausedUntil: null, pauseReason: "" });
  const save = () => {
    onChange({ pausedUntil: until || null, pauseReason: reason });
    setEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Switch
        isSelected={paused}
        onValueChange={(on) => (on ? setEditing(true) : resume())}
        size="sm"
      >
        <span className={paused ? "text-base-danger font-medium" : "text-content-5"}>
          {paused
            ? `Paused until ${automation.pausedUntil}`
            : "Pause all notifications"}
        </span>
      </Switch>
      {paused && (
        <BaseButton
          varient="light"
          className="h-7 px-2 text-xs"
          text="Edit pause"
          onPress={() => setEditing(true)}
        />
      )}
      {automation.pauseReason && (
        <span className="text-content-5 text-xs">— {automation.pauseReason}</span>
      )}

      {editing && (
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Pause until (inclusive)</label>
              <input
                type="date"
                value={until}
                min={today}
                onChange={(e) => setUntil(e.target.value)}
                className="border border-content-3 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-base-primary-300"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={200}
                className="border border-content-3 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-base-primary-300"
              />
            </div>
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
  onChange,
}: {
  automation: PartyAutomation;
  onChange: (next: Partial<PartyAutomation>) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-[#343A40]">
      <span className="text-content-5">Send at</span>
      <select
        value={automation.sendHour}
        onChange={(e) => onChange({ sendHour: Number(e.target.value) })}
        className="border border-content-3 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-base-primary-300"
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {hourText(h)}
          </option>
        ))}
      </select>
      <Switch
        isSelected={automation.skipWeekends}
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

function RuleRow({
  rule,
  spec,
  contacts,
  onToggle,
  onCustomise,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  contacts: ContactView[];
  onToggle: () => void;
  onCustomise: () => void;
}) {
  const effective = effectiveRule(rule);
  const description = describeRule(effective, spec);
  const recipients = recipientText(effective, spec, contacts);

  return (
    <div className="flex flex-wrap items-start gap-3 py-3 border-b border-content-10 last:border-0">
      <Switch isSelected={rule.enabled} onValueChange={onToggle} size="sm" className="mt-0.5" />
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
        {rule.enabled && (
          <p className="text-xs text-[#343A40] mt-1">
            {description}
            {recipients && (
              <span className="text-content-5"> · {recipients}</span>
            )}
          </p>
        )}
      </div>
      <BaseButton
        varient="bordered"
        className="h-7 px-3 text-xs shrink-0"
        text="Customise"
        onPress={onCustomise}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The card

export default function PartyAutomationCard({
  type,
  contacts,
}: {
  type: PartyType;
  contacts: ContactView[];
}) {
  const kinds = automationKinds(type);

  // Local state only — no API yet.
  const [automation, setAutomation] = useState<PartyAutomation>(() => ({
    pausedUntil: null,
    pauseReason: "",
    sendHour: 9,
    skipWeekends: true,
    rules: kinds.map((kind) => ({
      ...effectiveRule({
        kind,
        enabled: true,
        custom: false,
        steps: [],
        contactIds: [],
        notifyTeam: false,
        extraEmails: [],
        escalateFromDays: null,
        deliveryMode: InvoiceDeliveryMode.Manual,
        frequency: StatementFrequency.WeeklyAndMonthEnd,
        weekday: 5,
        statementScope: StatementScope.OpenInvoices,
        thresholdPercent: 80,
        subject: "",
        body: "",
      }),
    })),
  }));

  const [editingKind, setEditingKind] = useState<AutomationKind | null>(null);

  const updateAutomation = (next: Partial<PartyAutomation>) =>
    setAutomation((prev) => ({ ...prev, ...next }));

  const toggleRule = (kind: AutomationKind) =>
    setAutomation((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.kind === kind ? { ...r, enabled: !r.enabled } : r
      ),
    }));

  const saveRule = (updated: AutomationRule) =>
    setAutomation((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.kind === updated.kind ? updated : r)),
    }));

  const editingRule = editingKind
    ? automation.rules.find((r) => r.kind === editingKind)
    : null;

  return (
    <BaseCardWrapper heading="Notifications & Automation">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-content-5">
          Demo only — settings are not saved yet.
        </p>

        <PauseSection automation={automation} onChange={updateAutomation} />
        <ScheduleRow automation={automation} onChange={updateAutomation} />

        <div className="flex flex-col">
          {automation.rules.map((rule) => {
            const spec = automationSpecs[rule.kind];
            return (
              <RuleRow
                key={rule.kind}
                rule={rule}
                spec={spec}
                contacts={contacts}
                onToggle={() => toggleRule(rule.kind)}
                onCustomise={() => setEditingKind(rule.kind)}
              />
            );
          })}
        </div>
      </div>

      {editingRule && editingKind && (
        <AutomationRuleModal
          rule={editingRule}
          spec={automationSpecs[editingKind]}
          contacts={contacts}
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
