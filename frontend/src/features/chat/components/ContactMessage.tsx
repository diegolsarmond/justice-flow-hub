import type { ContactPayload } from "../types";
import { User2 } from "lucide-react";

interface ContactMessageProps {
  contact: ContactPayload;
}

export const ContactMessage = ({ contact }: ContactMessageProps) => {
  return (
    <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <User2 className="h-4 w-4" />
        <span>{contact.name}</span>
      </div>
      {contact.organization && (
        <p className="text-xs opacity-80">{contact.organization}</p>
      )}
      {Array.isArray(contact.phones) && contact.phones.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs opacity-75">
          {contact.phones.map((phone) => (
            <li key={`${phone.phone}-${phone.label ?? phone.type ?? "phone"}`}>
              {phone.phone}
              {phone.label ? ` • ${phone.label}` : phone.type ? ` • ${phone.type}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
