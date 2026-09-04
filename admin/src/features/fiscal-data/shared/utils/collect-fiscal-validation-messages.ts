function messagesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = Reflect.get(item, "message");
    if (typeof message !== "string" || message.trim().length === 0) return [];
    const severity = Reflect.get(item, "severity");
    return [typeof severity === "string" ? `${severity}: ${message}` : message];
  });
}

export function collectFiscalValidationMessages(
  validationSummary: unknown
): string[] {
  return [...new Set(messagesFrom(validationSummary))];
}
