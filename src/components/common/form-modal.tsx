import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { FormEvent, ReactNode } from "react";
import BaseButton from "./base-button";

// The modal mokal-app builds by hand for each form (partial payment, card
// payment, ...): bold blue title, body, Cancel / confirm footer.
export default function FormModal({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmText,
  onConfirm,
  isConfirming = false,
  confirmColor = "primary",
  requireConfirm = false,
  size = "md",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmText?: string;
  // Leave unset for a modal that only shows something: its footer is then
  // one button that closes it, rather than a Cancel and a Close that do the
  // same thing.
  onConfirm?: () => void;
  isConfirming?: boolean;
  // "danger" for a confirm that removes, ends or voids something, so it
  // doesn't look like an ordinary Save.
  confirmColor?: "primary" | "danger";
  // Only the confirm button closes it: no Cancel, Esc or close button. For
  // something shown once that the user must act on, like recovery codes.
  requireConfirm?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "5xl";
}) {
  // While saving, the modal stays open — Cancel, Esc, the close button and a
  // click outside are all ignored — so the outcome is seen and the form can't
  // be reopened and sent twice.
  const locked = isConfirming || requireConfirm;
  const handleOpenChange = (open: boolean) => {
    if (!open && isConfirming) return;
    onOpenChange(open);
  };

  // A real form, so Enter in a field submits. `contents` keeps the modal's
  // own layout (the body scrolls between a fixed header and footer). Modals
  // render in a portal but React still bubbles the submit up the component
  // tree, so it stops here rather than reaching a form the page has open.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isConfirming) onConfirm?.();
  };

  return (
    // `inside`: on a short phone a long form scrolls within the body, keeping
    // the title and buttons on screen rather than pushing the top off it.
    // A form ignores a click outside, so a stray click doesn't throw away
    // what was typed; Cancel, Esc and the close button still close it.
    <Modal
      isOpen={isOpen}
      size={size}
      scrollBehavior="inside"
      onOpenChange={handleOpenChange}
      isDismissable={!locked && !onConfirm}
      isKeyboardDismissDisabled={locked}
      hideCloseButton={locked}
    >
      <ModalContent>
        {(onClose) => {
          const content = (
            <>
              <ModalHeader>
                <h2 className="text-2xl text-base-primary-500 font-bold">
                  {title}
                </h2>
              </ModalHeader>
              <ModalBody className="gap-4">{children}</ModalBody>
              <ModalFooter>
                {onConfirm ? (
                  <div className="flex gap-3">
                    {!requireConfirm && (
                      <BaseButton
                        text="Cancel"
                        varient="bordered"
                        className="text-base-primary px-6"
                        isDisabled={isConfirming}
                        onPress={onClose}
                      />
                    )}
                    <BaseButton
                      type="submit"
                      text={confirmText ?? "Save"}
                      color={confirmColor}
                      className="px-6"
                      isLoading={isConfirming}
                    />
                  </div>
                ) : (
                  <BaseButton
                    text={confirmText ?? "Close"}
                    className="px-6"
                    onPress={onClose}
                  />
                )}
              </ModalFooter>
            </>
          );
          return onConfirm ? (
            <form noValidate className="contents" onSubmit={submit}>
              {content}
            </form>
          ) : (
            content
          );
        }}
      </ModalContent>
    </Modal>
  );
}
