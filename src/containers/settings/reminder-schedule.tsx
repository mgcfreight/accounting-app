import { useDisclosure } from "@heroui/react";
import { useForm } from "react-hook-form";
import {
  BaseButton,
  BaseInput,
  BaseSwitch,
  SuccessModal,
} from "@/components/common";
import { DownArrow } from "@/components/icons";

type Schedule = {
  reminderDaysBefore: string;
  remindOnDueDate: boolean;
  remindAt7Overdue: boolean;
  remindAt30Overdue: boolean;
  weeklyStatements: boolean;
  statementTime: string;
  creditCustomersOnly: boolean;
  autoIssue: boolean;
  emailsEnabled: boolean;
};

// Design §8.6. All times are Toronto time. Emails stay off for the trial run
// (§13 phase 4) and are switched on at go-live.
export default function ReminderSchedule() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { control, handleSubmit } = useForm<Schedule>({
    defaultValues: {
      reminderDaysBefore: "7",
      remindOnDueDate: true,
      remindAt7Overdue: true,
      remindAt30Overdue: true,
      weeklyStatements: true,
      statementTime: "08:00",
      creditCustomersOnly: false,
      autoIssue: false,
      emailsEnabled: false,
    },
  });

  return (
    <>
      <form className="border-t-1 grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
        <div className="flex flex-col gap-4">
          <h3 className="text-base-primary font-semibold">Payment reminders (daily, 09:00)</h3>
          <BaseInput
            name="reminderDaysBefore"
            control={control}
            type="number"
            label="Days before due date"
            className="max-w-xs"
            rules={{ required: "Enter a number of days", min: { value: 1, message: "At least 1 day" } }}
          />
          <BaseSwitch name="remindOnDueDate" control={control}>Also remind on the due date</BaseSwitch>
          <BaseSwitch name="remindAt7Overdue" control={control}>Remind at 7 days overdue</BaseSwitch>
          <BaseSwitch name="remindAt30Overdue" control={control}>Remind at 30 days overdue</BaseSwitch>
          <p className="text-xs text-content-5">Disputed invoices are always skipped.</p>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-base-primary font-semibold">Statements & sending</h3>
          <BaseSwitch name="weeklyStatements" control={control}>Weekly statements every Friday</BaseSwitch>
          <BaseInput
            name="statementTime"
            control={control}
            type="time"
            label="Friday statement time"
            className="max-w-xs"
          />
          <BaseSwitch name="creditCustomersOnly" control={control}>Credit customers only (open question 12)</BaseSwitch>
          <BaseSwitch name="autoIssue" control={control}>Auto-issue new shipper invoices</BaseSwitch>
          <BaseSwitch name="emailsEnabled" control={control} color="danger">
            Send emails to customers (off during the trial run)
          </BaseSwitch>
        </div>
        <div className="md:col-span-2 border-t-1 border-dashed pt-6 flex justify-end">
          <BaseButton
            text="Save"
            startContent={<DownArrow />}
            className="rounded-xl! px-6"
            onPress={() => handleSubmit(onOpen)()}
          />
        </div>
      </form>
      <SuccessModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        message="This is a demo — the schedule is not saved yet."
        buttonText="Return to Settings"
      />
    </>
  );
}
