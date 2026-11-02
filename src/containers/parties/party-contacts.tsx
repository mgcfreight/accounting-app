import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  BaseInput,
  BaseSwitch,
  BaseTable,
  ErrorState,
  FormModal,
  RowActions,
  StatusChip,
} from "@/components/common";
import { Add, EditSm } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { PartyType, Permission } from "@/lib/enums";
import { ContactView, PartyView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import {
  ContactChanges,
  createContact,
  errorMessage,
  listContacts,
  updateContact,
} from "@/services";

// The people at a shipper or carrier, and what each receives (/party/
// contacts). Statements go to the first active contact that receives
// statements, and the API emails them to shippers only, so a carrier's
// contacts don't offer the switch. Retiring a contact keeps it on file.

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "receives", label: "Receives" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "center" },
];

export default function PartyContacts({ party }: { party: PartyView }) {
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canEdit = can(Permission.PartiesEdit);
  const isShipper = party.type === PartyType.Shipper;
  // undefined: closed; null: adding; a contact: editing it.
  const [editing, setEditing] = useState<ContactView | null | undefined>();

  const contacts = useQuery({
    queryKey: ["parties", "contacts", party.id],
    queryFn: ({ signal }) => listContacts(party.id, signal),
  });

  const toggle = useMutation({
    mutationFn: (contact: ContactView) =>
      updateContact(contact.id, { isActive: !contact.isActive }),
    onSuccess: (contact) => {
      toast.success(`${contact.name} ${contact.isActive ? "reactivated" : "retired"}.`);
      void queryClient.invalidateQueries({ queryKey: ["parties", "contacts", party.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const noStatementContact =
    isShipper &&
    contacts.data !== undefined &&
    !contacts.data.some((c) => c.isActive && c.receivesStatements);

  const renderCell = (contact: ContactView, key: string) => {
    switch (key) {
      case "name":
        return <span className="font-semibold">{contact.name}</span>;
      case "email":
        return contact.email;
      case "phone":
        return contact.phone ?? <span className="text-gray-400">—</span>;
      case "receives": {
        const receives = [
          contact.receivesInvoices && "Invoices",
          contact.receivesReminders && "Reminders",
          isShipper && contact.receivesStatements && "Statements",
        ].filter((item): item is string => !!item);
        return receives.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {receives.map((item) => (
              <StatusChip key={item} text={item} tone="primary" />
            ))}
          </div>
        ) : (
          <span className="text-gray-400">Nothing</span>
        );
      }
      case "status":
        return contact.isActive ? (
          <StatusChip text="Active" tone="success" />
        ) : (
          <StatusChip text="Retired" tone="neutral" />
        );
      case "actions":
        return canEdit ? (
          <RowActions
            actions={[
              {
                key: "edit",
                label: "Edit",
                icon: <EditSm />,
                onPress: () => setEditing(contact),
              },
              {
                key: "toggle",
                label: contact.isActive ? "Retire" : "Reactivate",
                danger: contact.isActive,
                disabled: toggle.isPending,
                onPress: () => toggle.mutate(contact),
              },
            ]}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <BaseCardWrapper
      heading="Contacts"
      action={
        canEdit && (
          <BaseButton
            text="Add Contact"
            className="rounded-xl px-4"
            startContent={<Add />}
            onPress={() => setEditing(null)}
          />
        )
      }
    >
      <div className="flex flex-col gap-4">
        {noStatementContact && (
          <AlertBanner message="No active contact receives statements, so statements can't be emailed to this shipper." />
        )}
        {contacts.isError ? (
          <ErrorState
            message={`We couldn't load the contacts: ${errorMessage(contacts.error)}`}
            onAction={() => void contacts.refetch()}
          />
        ) : (
          <BaseTable<ContactView>
            ariaLabel="Contacts"
            columns={canEdit ? columns : columns.filter((c) => c.key !== "actions")}
            data={contacts.data ?? []}
            loading={contacts.isPending}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            emptyContent="No contacts yet"
          />
        )}
      </div>
      {editing !== undefined && (
        <ContactFormModal
          party={party}
          contact={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </BaseCardWrapper>
  );
}

type ContactValues = {
  name: string;
  email: string;
  phone: string;
  receivesInvoices: boolean;
  receivesReminders: boolean;
  receivesStatements: boolean;
};

// A light check for the form; the API validates the address itself.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adding a contact, or changing one. An edit sends only the fields that
// changed; a blank phone clears it.
function ContactFormModal({
  party,
  contact,
  onClose,
}: {
  party: PartyView;
  contact: ContactView | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isShipper = party.type === PartyType.Shipper;
  const { control, handleSubmit } = useForm<ContactValues>({
    defaultValues: {
      name: contact?.name ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      receivesInvoices: contact?.receivesInvoices ?? false,
      receivesReminders: contact?.receivesReminders ?? false,
      receivesStatements: contact?.receivesStatements ?? false,
    },
  });

  const save = useMutation({
    mutationFn: (values: ContactValues) => {
      const name = values.name.trim();
      const email = values.email.trim().toLowerCase();
      const phone = values.phone.trim();
      if (!contact) {
        return createContact({
          partyId: party.id,
          name,
          email,
          phone: phone || undefined,
          receivesInvoices: values.receivesInvoices,
          receivesReminders: values.receivesReminders,
          receivesStatements: isShipper && values.receivesStatements,
        });
      }
      const changes: ContactChanges = {};
      if (name !== contact.name) changes.name = name;
      if (email !== contact.email) changes.email = email;
      if (phone !== (contact.phone ?? "")) changes.phone = phone;
      if (values.receivesInvoices !== contact.receivesInvoices)
        changes.receivesInvoices = values.receivesInvoices;
      if (values.receivesReminders !== contact.receivesReminders)
        changes.receivesReminders = values.receivesReminders;
      if (isShipper && values.receivesStatements !== contact.receivesStatements)
        changes.receivesStatements = values.receivesStatements;
      return updateContact(contact.id, changes);
    },
    onSuccess: (saved) => {
      toast.success(contact ? `${saved.name} updated.` : `${saved.name} added.`);
      void queryClient.invalidateQueries({ queryKey: ["parties", "contacts", party.id] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={contact ? `Edit ${contact.name}` : `Add Contact for ${party.name}`}
      confirmText={contact ? "Save" : "Add Contact"}
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
      size="xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput
          name="name"
          control={control}
          label="Name"
          placeholder="Accounts Payable"
          rules={{
            required: "Enter a name",
            maxLength: { value: 100, message: "At most 100 characters" },
          }}
        />
        <BaseInput
          name="email"
          control={control}
          type="email"
          label="Email"
          rules={{
            required: "Enter an email address",
            maxLength: { value: 254, message: "At most 254 characters" },
            validate: (value) =>
              EMAIL_PATTERN.test(String(value).trim()) || "Enter an email address",
          }}
        />
        <BaseInput
          name="phone"
          control={control}
          label="Phone"
          placeholder="Optional"
          rules={{ maxLength: { value: 32, message: "At most 32 characters" } }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <BaseSwitch name="receivesInvoices" control={control}>
          Receives invoices
        </BaseSwitch>
        <BaseSwitch name="receivesReminders" control={control}>
          Receives payment reminders
        </BaseSwitch>
        {isShipper && (
          <BaseSwitch name="receivesStatements" control={control}>
            Receives statements
          </BaseSwitch>
        )}
      </div>
    </FormModal>
  );
}
