import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Switch } from "@heroui/react";
import { BaseButton, BaseCardWrapper, FormModal, StatusChip } from "@/components/common";
import { BaseInput, BaseSelect, BaseTextArea } from "@/components/common/form";
import { AutomationKind, PartyType } from "@/lib/enums";
import { AgreementView, AutomationRule, PartyAutomation } from "@/lib/interfaces";
import { torontoToday } from "@/lib/utils";
import { ApiError, errorMessage, saveAutomation } from "@/services";
import {
  automationFor,
  AutomationSpec,
  automationSpecs,
  companyDefault,
  ContactsState,
  defaultSource,
  describeRule,
  effectiveRule,
  hourText,
  isPaused,
  recipientText,
  SettingsDays,
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

// The pause form stays open until its save is confirmed, so a failure keeps
// what was typed. The card holds `editing`, so newer settings arriving from
// elsewhere wait while it is open.
function PauseSection({
  automation,
  canEdit,
  busy,
  editing,
  setEditing,
  onChange,
}: {
  automation: PartyAutomation;
  canEdit: boolean;
  // A save is pending: the controls wait.
  busy: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  onChange: (next: Partial<PartyAutomation>) => Promise<boolean>;
}) {
  const today = torontoToday();
  const paused = isPaused(automation, today);
  const resume = () => void onChange({ paused: false, pausedUntil: null, pauseReason: "" });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Switch
        isSelected={paused}
        isReadOnly={!canEdit || busy}
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
          isDisabled={busy}
          onPress={() => setEditing(true)}
        />
      )}
      {paused && automation.pauseReason && (
        <span className="text-content-5 text-xs">— {automation.pauseReason}</span>
      )}

      {editing && canEdit && (
        <PauseModal
          automation={automation}
          busy={busy}
          onSave={async (until, reason) => {
            const saved = await onChange({ paused: true, pausedUntil: until || null, pauseReason: reason });
            if (saved) setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// Mounted with the modal and filled once, from `defaultValues`: the
// optimistic update and its rollback change `automation` while it is open,
// and following them (`values`) would wipe what was typed, so a second Save
// would pause indefinitely (PR #41 review).
function PauseModal({
  automation,
  busy,
  onSave,
  onClose,
}: {
  automation: PartyAutomation;
  busy: boolean;
  onSave: (until: string, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const today = torontoToday();
  const { control, handleSubmit } = useForm<PauseFormValues>({
    defaultValues: { until: automation.pausedUntil ?? "", reason: automation.pauseReason },
  });
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Pause notifications"
      confirmText="Save"
      onConfirm={handleSubmit(({ until, reason }) => onSave(until, reason))}
      isConfirming={busy}
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
  onChange: (next: Partial<PartyAutomation>) => Promise<boolean>;
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
            void onChange({ sendHour: Number(e.target.value) }),
        }}
      />
      <Switch
        isSelected={automation.skipWeekends}
        isReadOnly={!canEdit}
        onValueChange={(on) => void onChange({ skipWeekends: on })}
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
  days,
  contacts,
  unavailable,
  canEdit,
  busy,
  onToggle,
  onCustomise,
}: {
  rule: AutomationRule;
  spec: AutomationSpec;
  days: SettingsDays;
  contacts: ContactsState;
  // Why the rule can't run for this party, or null when it can.
  unavailable: string | null;
  canEdit: boolean;
  // A save is pending: the controls wait, but stay where they are.
  busy: boolean;
  onToggle: () => void;
  onCustomise: () => void;
}) {
  const effective = effectiveRule(rule, days);
  // Contacts chosen for this message that are no longer active (the list
  // holds active contacts only). The API refuses a rule naming one, so they
  // are dropped at the next save.
  const goneContacts =
    rule.custom && contacts.status === "success"
      ? rule.contactIds.filter((id) => !contacts.contacts.some((contact) => contact.id === id))
      : [];
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
        isReadOnly={!canEdit || busy}
        onValueChange={onToggle}
        size="sm"
        className="mt-0.5"
        aria-label={spec.label}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#343A40]">{spec.label}</span>
          {rule.custom ? (
            <span className="text-xs bg-base-primary-50 text-base-primary-600 rounded px-1.5 py-0.5">
              Custom
            </span>
          ) : (
            <span className="text-xs text-content-5">
              {defaultSource(rule.kind, days) === "settings"
                ? "Default, days from Settings"
                : "Built-in default"}
            </span>
          )}
          {spec.audience === "team" && (
            <StatusChip text="Team alert" tone="warning" />
          )}
        </div>
        <p className="text-xs text-content-5 mt-0.5">{spec.help}</p>
        {/* Also when it is still switched on: the agreement in force changed
            after it was saved, so it can't run (decision pending on whether
            a new agreement should switch it off). */}
        {unavailable && (
          <p className={`text-xs mt-1 ${rule.enabled ? "text-base-danger" : "text-content-5"}`}>
            Unavailable: {unavailable}.
            {rule.enabled && " It is switched on but won't run."}
          </p>
        )}
        {goneContacts.length > 0 && (
          <p className="text-xs text-base-danger mt-1">
            {goneContacts.length === 1
              ? "A contact chosen here is no longer active."
              : `${goneContacts.length} contacts chosen here are no longer active.`}{" "}
            {goneContacts.length === rule.contactIds.length
              ? "With none left, the message is switched off at the next save, so nobody is sent it unasked. Choose contacts again to send it."
              : "They are removed at the next save."}
          </p>
        )}
        {rule.enabled && !unavailable && (
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
          isDisabled={busy}
          onPress={onCustomise}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The card

// Whether `next` is a later save than `seen` (ISO timestamps from the API).
const isNewer = (next: string | null, seen: string | null) =>
  next !== null && (seen === null || Date.parse(next) > Date.parse(seen));

// Starts from the settings saved on the API (`saved`), or, until there are
// any, seeded from the agreement in force and the days in Settings; mount it
// with `key` set to that agreement's id so a different agreement re-seeds
// unsaved settings. Saved settings are kept as saved: a later agreement
// doesn't change them, and a rule it no longer supports shows as
// unavailable. Every change saves the whole settings (PUT /party/automation),
// one save at a time: the controls wait while one is pending, and a save that
// fails puts the card back to what the server last confirmed. A newer save
// from elsewhere (a refetch) is taken in when nothing is pending or open.
// Without `canEdit` (parties.edit) the settings are shown read-only.
export default function PartyAutomationCard({
  partyId,
  type,
  agreement,
  saved,
  savedAt,
  days,
  contacts,
  canEdit,
}: {
  partyId: string;
  type: PartyType;
  agreement: AgreementView | undefined;
  saved: PartyAutomation | null;
  // When `saved` was saved; a change means newer settings arrived.
  savedAt: string | null;
  days: SettingsDays;
  contacts: ContactsState;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["parties", "automation", partyId];
  const [automation, setAutomation] = useState<PartyAutomation>(() =>
    automationFor(type, agreement, saved, days)
  );
  // What the server last confirmed: where a failed save goes back to.
  const [confirmed, setConfirmed] = useState(automation);
  const [seenSavedAt, setSeenSavedAt] = useState(savedAt);
  const [editingKind, setEditingKind] = useState<AutomationKind | null>(null);
  const [editingPause, setEditingPause] = useState(false);

  const save = useMutation({
    // A GET already in flight would put the settings from before this save
    // back into the cache when it lands.
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    mutationFn: ({ next }: { next: PartyAutomation; what: string }) =>
      saveAutomation(partyId, next, seenSavedAt),
    onSuccess: async (view, { what }) => {
      // And one that started during the save (a refetch on focus, say).
      await queryClient.cancelQueries({ queryKey });
      const now = automationFor(type, agreement, view.automation, days);
      setConfirmed(now);
      setAutomation(now);
      setSeenSavedAt(view.updatedAt);
      queryClient.setQueryData(queryKey, view);
      toast.success(`${what} saved.`);
    },
    onError: (error) => {
      setAutomation(confirmed);
      // Someone else saved first (accounts, 13 Nov 2026: stop the second
      // save and reload). An open form was built from the older settings,
      // so it closes; the newer ones are fetched and taken in.
      if (error instanceof ApiError && error.status === 409) {
        setEditingKind(null);
        setEditingPause(false);
        toast.error(
          "Someone else changed these settings while you were working. They have been reloaded: check them, then make your change again."
        );
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(errorMessage(error));
    },
  });

  // Settings saved elsewhere arrived: take them in, unless a save is pending
  // or a modal is open, which would lose what the user is doing. Only newer
  // ones: a GET answered from before the last save carries an older
  // `savedAt`, and taking it in would write the old settings back with the
  // next change.
  if (
    isNewer(savedAt, seenSavedAt) &&
    !save.isPending &&
    editingKind === null &&
    !editingPause
  ) {
    const fresh = automationFor(type, agreement, saved, days);
    setSeenSavedAt(savedAt);
    setConfirmed(fresh);
    setAutomation(fresh);
  }

  const busy = save.isPending;

  // What a change saves: every rule as it is in force, so a rule left at the
  // company default carries today's Settings days rather than those from
  // when the card loaded; and no contact that is no longer active, which the
  // API would refuse (it isn't known until the contacts load). A message
  // whose chosen contacts are all gone is switched off rather than sent to
  // the flagged contacts (product answer Q11: stop and warn staff).
  const toSave = (next: PartyAutomation) => {
    const active =
      contacts.status === "success"
        ? new Set(contacts.contacts.map((contact) => contact.id))
        : null;
    const switchedOff: string[] = [];
    const rules = next.rules.map((rule) => {
      const effective = effectiveRule(rule, days);
      if (!active) return effective;
      const contactIds = effective.contactIds.filter((id) => active.has(id));
      const noneLeft = effective.contactIds.length > 0 && contactIds.length === 0;
      if (noneLeft && effective.enabled) switchedOff.push(automationSpecs[rule.kind].label);
      return { ...effective, contactIds, enabled: effective.enabled && !noneLeft };
    });
    return { automation: { ...next, rules }, switchedOff };
  };

  const commit = (next: PartyAutomation, what: string) => {
    const { automation: sent, switchedOff } = toSave(next);
    setAutomation(sent);
    return save.mutateAsync({ next: sent, what }).then((view) => {
      if (switchedOff.length) {
        toast.warning(
          `Switched off, as none of their chosen contacts is active: ${switchedOff.join(", ")}. Choose contacts again to send them.`
        );
      }
      return view;
    });
  };

  // Resolves true once saved, false if it wasn't (the toast says why).
  const updateAutomation = async (next: Partial<PartyAutomation>): Promise<boolean> => {
    if (save.isPending) return false;
    const what =
      "paused" in next
        ? next.paused
          ? "Notifications paused"
          : "Notifications resumed"
        : "sendHour" in next
          ? "Send time"
          : "Weekend setting";
    // The error is shown by the mutation's toast.
    return commit({ ...automation, ...next }, what).then(
      () => true,
      () => false
    );
  };

  // Switching off is always allowed; switching on only when available.
  const toggleRule = (kind: AutomationKind) => {
    if (save.isPending) return;
    const rule = automation.rules.find((r) => r.kind === kind);
    if (!rule || (!rule.enabled && unavailableReason(kind, agreement))) return;
    commit(
      {
        ...automation,
        rules: automation.rules.map((r) =>
          r.kind === kind ? { ...r, enabled: !r.enabled } : r
        ),
      },
      `${automationSpecs[kind].label} ${rule.enabled ? "off" : "on"}`
    ).catch(() => {});
  };

  // Resolves once saved; rejects on failure, so the modal stays open with
  // what was typed.
  const saveRule = (updated: AutomationRule) =>
    commit(
      {
        ...automation,
        rules: automation.rules.map((r) => (r.kind === updated.kind ? updated : r)),
      },
      automationSpecs[updated.kind].label
    );

  const editingRule = editingKind
    ? automation.rules.find((r) => r.kind === editingKind)
    : null;

  return (
    <BaseCardWrapper heading="Notifications & Automation">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-content-5">
          {saved
            ? "Saved for this party."
            : "Company defaults: changing anything saves this party's own settings."}{" "}
          Messages aren&apos;t sent from these settings yet.
        </p>

        <PauseSection
          automation={automation}
          canEdit={canEdit}
          busy={busy}
          editing={editingPause}
          setEditing={setEditingPause}
          onChange={updateAutomation}
        />
        <ScheduleRow automation={automation} canEdit={canEdit && !busy} onChange={updateAutomation} />

        <div className="flex flex-col">
          {automation.rules.map((rule) => {
            const spec = automationSpecs[rule.kind];
            return (
              <RuleRow
                key={rule.kind}
                rule={rule}
                spec={spec}
                days={days}
                contacts={contacts}
                unavailable={unavailableReason(rule.kind, agreement)}
                canEdit={canEdit}
                busy={busy}
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
          defaults={companyDefault(editingKind, days)}
          contacts={contacts}
          unavailable={unavailableReason(editingKind, agreement)}
          onSave={async (updated) => {
            await saveRule(updated);
            setEditingKind(null);
          }}
          onClose={() => setEditingKind(null)}
        />
      )}
    </BaseCardWrapper>
  );
}
