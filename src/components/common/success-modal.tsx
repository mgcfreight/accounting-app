import { Modal, ModalContent } from "@heroui/react";
import { ModalClaimConfirmation } from "../icons";
import BaseButton from "./base-button";

// The "Thank You" confirmation mokal-app shows after saving settings.
export default function SuccessModal({
  isOpen,
  onOpenChange,
  title = "Thank You",
  message,
  buttonText = "Close",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  buttonText?: string;
}) {
  return (
    <Modal isOpen={isOpen} size="lg" onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <div className="flex flex-col items-center justify-center gap-6 m-4">
            <ModalClaimConfirmation />
            <div className="text-base-primary text-3xl">{title}</div>
            <div className="text-xl text-center">{message}</div>
            <BaseButton text={buttonText} onPress={onClose} className="w-full" />
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
