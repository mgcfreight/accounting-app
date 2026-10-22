import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { ReactNode } from "react";
import BaseButton from "./base-button";

// The modal mokal-app builds by hand for each form (partial payment, card
// payment, ...): bold blue title, body, Cancel / confirm footer.
export default function FormModal({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmText = "Save",
  onConfirm,
  isConfirming = false,
  size = "md",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmText?: string;
  onConfirm: () => void;
  isConfirming?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}) {
  return (
    // `inside`: on a short phone a long form scrolls within the body, keeping
    // the title and buttons on screen rather than pushing the top off it.
    <Modal
      isOpen={isOpen}
      size={size}
      scrollBehavior="inside"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>
              <h2 className="text-2xl text-base-primary-500 font-bold">
                {title}
              </h2>
            </ModalHeader>
            <ModalBody className="gap-4">{children}</ModalBody>
            <ModalFooter>
              <div className="flex gap-3">
                <BaseButton
                  text="Cancel"
                  varient="bordered"
                  className="text-base-primary px-6"
                  onPress={onClose}
                />
                <BaseButton
                  text={confirmText}
                  className="px-6"
                  isLoading={isConfirming}
                  onPress={onConfirm}
                />
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
