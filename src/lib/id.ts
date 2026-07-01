// Small unique-id helper for locally-created records.
export const uid = (prefix = ""): string =>
  `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
