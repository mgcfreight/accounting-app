import FormModal from "./form-modal";

// Asks before leaving a form with unsaved edits (see useUnsavedChanges).
// Cancel, Esc or a click outside keeps the user on the page.
export default function LeavePageModal({
  isOpen,
  onStay,
  onLeave,
}: {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onStay()}
      title="Leave without saving?"
      confirmText="Leave"
      onConfirm={onLeave}
      size="sm"
    >
      <p className="text-sm">
        Your changes on this page haven&apos;t been saved. If you leave now,
        they&apos;ll be lost.
      </p>
    </FormModal>
  );
}
