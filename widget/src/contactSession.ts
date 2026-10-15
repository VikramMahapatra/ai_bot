export interface SessionContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  customFields: Record<string, string>;
}

export const emptyContact = (): SessionContact => ({
  name: "", email: "", phone: "", company: "", customFields: {},
});

export const contactSessionKey = (apiUrl: string, widgetId: string, sessionId: string) =>
  `chatbot_contact_${JSON.stringify([apiUrl.replace(/\/$/, ""), widgetId, sessionId])}`;

// PII belongs to this tab/session, not the durable localStorage session identifier.
export function readContact(storage: Storage, key: string, timeout: number, now = Date.now()): SessionContact {
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyContact();
    const entry = JSON.parse(raw);
    if (!Number.isFinite(entry.updatedAt) || now - entry.updatedAt >= timeout || entry.updatedAt > now) {
      storage.removeItem(key);
      return emptyContact();
    }
    const contact = emptyContact();
    for (const field of ["name", "email", "phone", "company"] as const) {
      contact[field] = typeof entry.contact?.[field] === "string" ? entry.contact[field].trim() : "";
    }
    const custom = entry.contact?.customFields;
    if (custom && typeof custom === "object" && !Array.isArray(custom)) {
      contact.customFields = Object.fromEntries(
        Object.entries(custom).filter(([, value]) => typeof value === "string" && value.trim()),
      ) as Record<string, string>;
    }
    return contact;
  } catch {
    try { storage.removeItem(key); } catch { /* Storage may be disabled. */ }
    return emptyContact();
  }
}

export function writeContact(storage: Storage, key: string, contact: SessionContact, now = Date.now()) {
  try { storage.setItem(key, JSON.stringify({ contact, updatedAt: now })); } catch { /* Keep in-memory context. */ }
}

export function clearContact(storage: Storage, key: string) {
  try { storage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

export const hasHandoffContact = (contact: SessionContact) =>
  Boolean(contact.name && (contact.email || contact.phone));