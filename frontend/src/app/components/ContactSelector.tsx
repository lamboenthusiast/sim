import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  service: string;
}

interface ContactSelectorProps {
  contacts: Contact[];
  selectedContact?: Contact;
  onSelectContact: (contact: Contact) => void;
  loading: boolean;
}

export function ContactSelector({ contacts, selectedContact, onSelectContact, loading }: ContactSelectorProps) {
  if (loading) {
    return <div className="text-sm text-gray-500">Loading contacts...</div>;
  }

  if (contacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Select Contact</h3>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelectContact(contact)}
            className={cn(
              "w-full px-3 py-2 text-left rounded-lg transition-colors",
              selectedContact?.id === contact.id
                ? "bg-blue-50 text-blue-700"
                : "hover:bg-gray-100"
            )}
          >
            {contact.name}
          </button>
        ))}
      </div>
    </div>
  );
} 