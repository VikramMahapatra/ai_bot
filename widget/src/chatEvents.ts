// SSE frames can span reads, use CRLF, or end without the optional blank line.
export class ChatEventDecoder {
  private buffer = "";

  push(text: string, final = false): any[] {
    this.buffer += text;
    const events: any[] = [];
    const parse = (frame: string) => {
      const data = frame.split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, "")).join("\n");
      if (!data) return;
      try { events.push(JSON.parse(data)); } catch { /* Ignore malformed frames. */ }
    };
    let separator: RegExpExecArray | null;
    while ((separator = /\r?\n\r?\n/.exec(this.buffer))) {
      parse(this.buffer.slice(0, separator.index));
      this.buffer = this.buffer.slice(separator.index + separator[0].length);
    }
    if (final) {
      parse(this.buffer);
      this.buffer = "";
    }
    return events;
  }
}

export function submittedContactMessages(contact: {
  name: string; email: string; phone: string; company: string;
  customFields: Record<string, string>;
}): string[] {
  const formatValue = (value: string) => value !== value.trim() || /[|:"\\\x00-\x1f]/.test(value) ||
    value.startsWith("[") || value.startsWith("{") || ["null", "true", "false"].includes(value)
    ? JSON.stringify(value) : value;
  const fields = [
    ...(["name", "email", "phone", "company"] as const)
      .filter((key) => contact[key].trim())
      .map((key) => `${key[0].toUpperCase()}${key.slice(1)}: ${formatValue(contact[key].trim())}`),
    ...Object.entries(contact.customFields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) =>
      `Custom field ${JSON.stringify(key)}: ${JSON.stringify(value)}`),
  ];
  return [`Quick Connect Details: ${fields.join(" | ")}`];
}